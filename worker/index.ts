import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition, ensureBrowser } from '@remotion/renderer'
import type { Caption } from '@remotion/captions'

// ─── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PEXELS_KEY   = process.env.PEXELS_API_KEY ?? ''
const POLL_MS      = 5_000
const TMP          = '/tmp/videoworker'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

// ─── Remotion bundle cache ─────────────────────────────────────────────────────
// Re-used across jobs in server mode so we only webpack-bundle once per process.

let cachedBundlePath: string | null = null

async function getBundle(): Promise<string> {
  if (cachedBundlePath) return cachedBundlePath
  console.log('Bundling Remotion composition...')
  cachedBundlePath = await bundle({
    entryPoint: resolve(process.cwd(), 'remotion/index.ts'),
  })
  console.log('Bundle ready:', cachedBundlePath)
  return cachedBundlePath
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VideoJob {
  id: string
  package_id: string
  script: string
  audio_url: string
  bg_video_url: string | null
}

interface WordTiming { word: string; start: number; end: number }

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function downloadFile(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url)
    if (!res.ok) return false
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1024) return false
    writeFileSync(dest, buf)
    return true
  } catch { return false }
}

// ─── Job processor ─────────────────────────────────────────────────────────────

async function processJob(job: VideoJob) {
  const id        = job.package_id
  const audioPath = join(TMP, `${id}.mp3`)
  const videoPath = join(TMP, `${id}.mp4`)

  console.log(`[job ${job.id}] starting for package ${id}`)

  try {
    // 1. Download audio (needed locally for duration detection)
    if (!await downloadFile(job.audio_url, audioPath)) throw new Error('Failed to download audio')

    // 2. Audio duration
    const { parseFile } = await import('music-metadata')
    const meta = await parseFile(audioPath)
    const duration = meta.format.duration
    if (!duration || isNaN(duration)) throw new Error('Could not determine audio duration')

    // 3. Highlight words via Claude Haiku (non-fatal)
    let highlightWords: string[] = []
    if (anthropic) {
      try {
        const hlRes = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 200,
          messages: [{ role: 'user', content: `Pick 6-8 high-impact words from this TikTok script to highlight in red. Return ONLY a JSON array of lowercase words:\n\n${job.script}` }],
        })
        const raw = hlRes.content[0].type === 'text' ? (hlRes.content[0] as { type: 'text'; text: string }).text : '[]'
        highlightWords = JSON.parse(raw.match(/\[[\s\S]*?\]/)?.[0] ?? '[]')
      } catch { /* non-fatal */ }
    }

    // 4. Pexels background image URL (no download needed — Remotion fetches directly)
    let bgImageUrl: string | null = null
    if (PEXELS_KEY) {
      try {
        const topic = job.script.split(/\s+/).slice(0, 5).join(' ')
        const res = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(topic)}&orientation=portrait&per_page=3`,
          { headers: { Authorization: PEXELS_KEY } }
        )
        if (res.ok) {
          const pdata = await res.json()
          const photos: Array<{ src?: { large2x?: string; large?: string; original?: string } }> = pdata.photos ?? []
          if (photos.length > 0) {
            const photo = photos[Math.floor(Math.random() * photos.length)]
            bgImageUrl = photo.src?.large2x ?? photo.src?.large ?? photo.src?.original ?? null
          }
        }
      } catch { /* fall through to solid color */ }
    }

    // 5. Word timings → Remotion Caption[]
    let captions: Caption[] = []
    try {
      const { data: { publicUrl: timingsUrl } } = supabase.storage
        .from('voiceovers').getPublicUrl(`${id}_timestamps.json`)
      const timingsRes = await fetch(timingsUrl)
      if (!timingsRes.ok) throw new Error('no timings')
      const wordTimings: WordTiming[] = await timingsRes.json()
      if (!Array.isArray(wordTimings) || wordTimings.length === 0) throw new Error('empty timings')
      captions = wordTimings.map((w, i) => ({
        text: (i === 0 ? '' : ' ') + w.word,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        timestampMs: Math.round(w.start * 1000),
        confidence: null,
      }))
    } catch {
      // Even-split fallback
      const words = job.script.split(/\s+/).filter(Boolean)
      const wordDurMs = (duration * 1000) / words.length
      captions = words.map((word, i) => ({
        text: (i === 0 ? '' : ' ') + word,
        startMs: Math.round(i * wordDurMs),
        endMs: Math.round((i + 1) * wordDurMs),
        timestampMs: Math.round(i * wordDurMs),
        confidence: null,
      }))
    }

    // 6. Bundle Remotion composition (cached after first call)
    const serveUrl = await getBundle()

    // 7. Resolve browser executable
    const browserExecutable = process.env.CI
      ? '/usr/bin/google-chrome-stable'
      : (await ensureBrowser()).executablePath

    // 8. Render
    const inputProps = {
      audioUrl: job.audio_url,
      captions,
      highlightWords,
      bgColor: '#0e0820',
      bgImageUrl,
      durationInSeconds: duration,
    }

    const composition = await selectComposition({ serveUrl, id: 'TikTokVideo', inputProps })

    await renderMedia({
      composition: { ...composition, durationInFrames: Math.ceil(duration * 30) },
      serveUrl,
      codec: 'h264',
      outputLocation: videoPath,
      inputProps,
      browserExecutable,
      onProgress: ({ progress }) => {
        process.stdout.write(`\r[job ${job.id}] rendering ${Math.round(progress * 100)}%  `)
      },
    })
    process.stdout.write('\n')
    console.log(`[job ${job.id}] render complete`)

    // 9. Upload to Supabase Storage
    const videoBytes = readFileSync(videoPath)
    const { error: uploadErr } = await supabase.storage
      .from('videos')
      .upload(`${id}.mp4`, videoBytes, { contentType: 'video/mp4', upsert: true })
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

    const { data: { publicUrl: videoUrl } } = supabase.storage.from('videos').getPublicUrl(`${id}.mp4`)

    // 10. Mark complete
    await supabase.from('content_packages').update({ video_url: videoUrl }).eq('id', id)
    await supabase.from('video_jobs').update({
      status: 'complete',
      video_url: videoUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)

    console.log(`[job ${job.id}] ✓ complete: ${videoUrl}`)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[job ${job.id}] ✗ failed: ${msg}`)
    await supabase.from('video_jobs').update({
      status: 'failed',
      error: msg,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)
  } finally {
    for (const p of [audioPath, videoPath]) {
      if (existsSync(p)) unlinkSync(p)
    }
  }
}

// ─── Entry point ───────────────────────────────────────────────────────────────
// CI mode (GitHub Actions): claim and process one job, then exit.
// Server mode (Railway etc.): poll continuously.

async function run() {
  mkdirSync(TMP, { recursive: true })
  const ci = !!process.env.CI

  if (ci) {
    console.log('CI mode: processing one pending job then exiting.')
    const { data: jobs } = await supabase
      .from('video_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)

    if (!jobs || jobs.length === 0) {
      console.log('No pending jobs.')
      return
    }

    const job = jobs[0]
    const { error: claimErr } = await supabase
      .from('video_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'pending')

    if (!claimErr) await processJob(job as VideoJob)
    return
  }

  console.log('Server mode: polling every', POLL_MS / 1000, 's...')
  while (true) {
    try {
      const { data: jobs } = await supabase
        .from('video_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)

      if (jobs && jobs.length > 0) {
        const job = jobs[0]
        const { error: claimErr } = await supabase
          .from('video_jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id)
          .eq('status', 'pending')

        if (!claimErr) await processJob(job as VideoJob)
      } else {
        await new Promise(r => setTimeout(r, POLL_MS))
      }
    } catch (err) {
      console.error('Poll error:', err)
      await new Promise(r => setTimeout(r, POLL_MS))
    }
  }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1) })
