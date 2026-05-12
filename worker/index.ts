import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition, ensureBrowser } from '@remotion/renderer'
import type { Caption } from '@remotion/captions'
import type { SceneData } from '../remotion/TikTokVideo'

// ─── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PEXELS_KEY   = process.env.PEXELS_API_KEY ?? ''
const POLL_MS      = 5_000
const TMP          = '/tmp/videoworker'
const UUID_RE      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

// ─── Bundle cache ──────────────────────────────────────────────────────────────
// Webpack bundling takes ~45 seconds. We cache the result in memory so server
// mode only pays that cost once, not on every job.
let cachedBundlePath: string | null = null

async function getBundle(): Promise<string> {
  if (cachedBundlePath) return cachedBundlePath
  console.log('Bundling Remotion composition...')
  cachedBundlePath = await bundle({ entryPoint: resolve(process.cwd(), 'remotion/index.ts') })
  console.log('Bundle ready.')
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

// What Claude returns when we ask it to break the script into scenes
interface SceneDef {
  voiceLine: string       // The words spoken during this scene
  visualKeywords: string[] // Search terms for Pexels Videos
  motionStyle: string     // 'slow-zoom' | 'pan-left' | etc.
}

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

// ─── Scene breakdown ───────────────────────────────────────────────────────────
// Ask Claude Haiku to split the script into scenes.
// We use Haiku (not Sonnet) here because it's 5x faster and this is a
// simple extraction task, not creative writing.
async function breakIntoScenes(script: string, durationInSeconds: number): Promise<SceneDef[]> {
  if (!anthropic) return [{ voiceLine: script, visualKeywords: ['nature landscape'], motionStyle: 'slow-zoom' }]

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `Break this TikTok script into 4-6 visual scenes for video production.

Script:
"""
${script}
"""

Rules:
- Cover the ENTIRE script in order. Every line must be in a scene.
- voiceLine: copy the exact words from the script for each scene
- visualKeywords: 2 specific search terms for stock VIDEO (e.g. "barbell gym", "city street crowd")
- motionStyle: slow-zoom | pan-left | pan-right | punch-in | quick-cut
  Use punch-in for the opening hook. slow-zoom for emotional moments. pan for transitions.

Return ONLY a JSON array, nothing else:
[{"voiceLine":"...","visualKeywords":["...","..."],"motionStyle":"slow-zoom"}]`,
      }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text : '[]'
    const parsed: SceneDef[] = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('empty scene list')
    return parsed
  } catch (e) {
    console.warn('Scene breakdown failed, using single scene:', e)
    return [{ voiceLine: script, visualKeywords: ['cinematic nature'], motionStyle: 'slow-zoom' }]
  }
}

// ─── Scene timing ──────────────────────────────────────────────────────────────
// Map each scene to a start time and duration.
// We divide time proportionally based on how many characters each scene has.
// A scene with more words gets more screen time — simple but effective.
function distributeSceneTiming(
  scenes: SceneDef[],
  durationInSeconds: number,
): Array<{ startMs: number; durationMs: number }> {
  const totalChars = scenes.reduce((sum, s) => sum + s.voiceLine.length, 0)
  const result: Array<{ startMs: number; durationMs: number }> = []
  let currentMs = 0

  for (const scene of scenes) {
    // Each scene's share of time = its share of total characters
    const proportion = scene.voiceLine.length / totalChars
    const durationMs = Math.round(proportion * durationInSeconds * 1000)
    result.push({ startMs: currentMs, durationMs })
    currentMs += durationMs
  }

  return result
}

// ─── Pexels Video search ───────────────────────────────────────────────────────
// Search Pexels for a real video clip matching the scene's visual keywords.
// We try each keyword in order and return the first good result.
// Returns null if nothing is found (caller falls back to image or solid color).
async function searchPexelsVideo(keywords: string[]): Promise<string | null> {
  if (!PEXELS_KEY) return null

  for (const query of keywords) {
    try {
      // orientation=portrait gets vertical videos — perfect for TikTok
      const res = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`,
        { headers: { Authorization: PEXELS_KEY } }
      )
      if (!res.ok) continue

      const data = await res.json()
      const videos: Array<{
        video_files: Array<{ file_type: string; quality: string; width: number; height: number; link: string }>
      }> = data.videos ?? []
      if (!videos.length) continue

      // Pick a random video from the results (variety keeps the content fresh)
      const video = videos[Math.floor(Math.random() * videos.length)]
      const files = video.video_files ?? []

      // Filter for MP4 files only — broadest compatibility
      const mp4Files = files.filter(f => f.file_type === 'video/mp4')

      // Prefer portrait-oriented files (height > width)
      const portraitFiles = mp4Files.filter(f => f.height && f.width && f.height > f.width)

      // Fall back to any HD file if no portrait available
      const selected = portraitFiles[0]
        ?? mp4Files.find(f => f.quality === 'hd')
        ?? mp4Files[0]

      if (selected?.link) {
        console.log(`  Video found for "${query}": ${selected.width}x${selected.height}`)
        return selected.link
      }
    } catch { continue }
  }

  console.warn(`  No video found for keywords: ${keywords.join(', ')}`)
  return null
}

// ─── Pexels Image fallback ─────────────────────────────────────────────────────
// If Pexels Videos returns nothing, fall back to a photo with motion effect.
async function searchPexelsImage(keywords: string[]): Promise<string | null> {
  if (!PEXELS_KEY) return null

  for (const query of keywords) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=3`,
        { headers: { Authorization: PEXELS_KEY } }
      )
      if (!res.ok) continue
      const data = await res.json()
      const photos: Array<{ src?: { large2x?: string; large?: string } }> = data.photos ?? []
      if (!photos.length) continue
      const photo = photos[Math.floor(Math.random() * photos.length)]
      const url = photo.src?.large2x ?? photo.src?.large ?? null
      if (url) return url
    } catch { continue }
  }

  return null
}

// ─── Job processor ─────────────────────────────────────────────────────────────

async function processJob(job: VideoJob) {
  const id        = job.package_id
  const audioPath = join(TMP, `${id}.mp3`)
  const videoPath = join(TMP, `${id}.mp4`)

  console.log(`\n[job ${job.id}] ── Starting package ${id}`)

  try {
    // ── STEP 1: Download audio ──────────────────────────────────────────────
    // We need the audio file locally to measure its duration.
    console.log('[1/7] Downloading audio...')
    if (!await downloadFile(job.audio_url, audioPath)) throw new Error('Failed to download audio')

    // ── STEP 2: Get audio duration ─────────────────────────────────────────
    // music-metadata reads the MP3 header to find duration in seconds.
    // We need this to: (a) set video length, (b) distribute scene timing.
    const { parseFile } = await import('music-metadata')
    const meta = await parseFile(audioPath)
    const duration = meta.format.duration
    if (!duration || isNaN(duration)) throw new Error('Could not determine audio duration')
    console.log(`[1/7] Duration: ${duration.toFixed(1)}s`)

    // ── STEP 3: Word timings → Caption[] ───────────────────────────────────
    // ElevenLabs stored word timestamps alongside the audio in Supabase.
    // We convert them to Remotion's Caption format for word-synced display.
    console.log('[2/7] Fetching word timings...')
    let captions: Caption[] = []
    try {
      const { data: { publicUrl: timingsUrl } } = supabase.storage
        .from('voiceovers').getPublicUrl(`${id}_timestamps.json`)
      const timingsRes = await fetch(timingsUrl)
      if (!timingsRes.ok) throw new Error('no timings file')
      const wordTimings: WordTiming[] = await timingsRes.json()
      if (!Array.isArray(wordTimings) || wordTimings.length === 0) throw new Error('empty timings')

      // Convert: { word, start, end } (seconds) → { text, startMs, endMs } (milliseconds)
      captions = wordTimings.map((w, i) => ({
        text: (i === 0 ? '' : ' ') + w.word,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        timestampMs: Math.round(w.start * 1000),
        confidence: null,
      }))
      console.log(`[2/7] ${captions.length} word timings loaded`)
    } catch {
      // Fallback: spread words evenly across the audio duration
      const words = job.script.split(/\s+/).filter(Boolean)
      const wordDurMs = (duration * 1000) / words.length
      captions = words.map((word, i) => ({
        text: (i === 0 ? '' : ' ') + word,
        startMs: Math.round(i * wordDurMs),
        endMs: Math.round((i + 1) * wordDurMs),
        timestampMs: Math.round(i * wordDurMs),
        confidence: null,
      }))
      console.log(`[2/7] Using even-split fallback (${words.length} words)`)
    }

    // ── STEP 4: Highlight words ────────────────────────────────────────────
    // Claude picks 6-8 words to show in red — the most important words in the script.
    console.log('[3/7] Getting highlight words...')
    let highlightWords: string[] = []
    if (anthropic) {
      try {
        const hlRes = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 200,
          messages: [{ role: 'user', content: `Pick 6-8 high-impact words to highlight in red in this TikTok script. Return ONLY a JSON array of lowercase words:\n\n${job.script}` }],
        })
        const raw = hlRes.content[0].type === 'text' ? (hlRes.content[0] as { type: 'text'; text: string }).text : '[]'
        highlightWords = JSON.parse(raw.match(/\[[\s\S]*?\]/)?.[0] ?? '[]')
      } catch { /* non-fatal — video still works without highlights */ }
    }
    console.log(`[3/7] Highlight words: ${highlightWords.join(', ')}`)

    // ── STEP 5: Scene breakdown ────────────────────────────────────────────
    // Claude reads the script and returns 4-6 scenes.
    // Each scene gets visual keywords we'll search Pexels with.
    console.log('[4/7] Breaking script into scenes...')
    const sceneDefs = await breakIntoScenes(job.script, duration)
    const timings   = distributeSceneTiming(sceneDefs, duration)
    console.log(`[4/7] ${sceneDefs.length} scenes identified`)

    // ── STEP 6: Fetch visuals for each scene ───────────────────────────────
    // We search Pexels Videos for each scene in PARALLEL using Promise.all().
    //
    // Why parallel? Without it, 6 scenes × ~1 second each = 6 seconds waiting.
    // With Promise.all(), all 6 searches happen simultaneously = ~1 second total.
    // This is a huge speed win for the render pipeline.
    //
    // For each scene: try Pexels video → fallback to Pexels image → fallback to null
    console.log('[5/7] Fetching visuals from Pexels...')
    const scenes: SceneData[] = await Promise.all(
      sceneDefs.map(async (scene, i) => {
        const videoUrl = await searchPexelsVideo(scene.visualKeywords)
        const imageUrl = videoUrl ? null : await searchPexelsImage(scene.visualKeywords)

        return {
          videoUrl,
          imageUrl,
          startMs: timings[i].startMs,
          durationMs: timings[i].durationMs,
          motionStyle: scene.motionStyle,
        }
      })
    )

    const videoCount = scenes.filter(s => s.videoUrl).length
    const imageCount = scenes.filter(s => s.imageUrl).length
    console.log(`[5/7] Visuals: ${videoCount} videos, ${imageCount} images, ${scenes.length - videoCount - imageCount} solid-color`)

    // ── STEP 7: Bundle + Render ────────────────────────────────────────────
    console.log('[6/7] Bundling Remotion composition...')
    const serveUrl = await getBundle()

    if (!process.env.CI) await ensureBrowser()
    const browserExecutable: string | null = process.env.CI
      ? '/usr/bin/google-chrome-stable'
      : null

    const inputProps = {
      audioUrl: job.audio_url,
      captions,
      highlightWords,
      scenes,
      bgColor: '#0e0820',
      durationInSeconds: duration,
    }

    const composition = await selectComposition({ serveUrl, id: 'TikTokVideo', inputProps })

    console.log('[7/7] Rendering video...')
    await renderMedia({
      composition: { ...composition, durationInFrames: Math.ceil(duration * 30) },
      serveUrl,
      codec: 'h264',
      outputLocation: videoPath,
      inputProps,
      browserExecutable,
      onProgress: ({ progress }) => {
        process.stdout.write(`\r  Progress: ${Math.round(progress * 100)}%  `)
      },
    })
    process.stdout.write('\n')

    // ── STEP 8: Upload + complete ──────────────────────────────────────────
    const videoBytes = readFileSync(videoPath)
    const { error: uploadErr } = await supabase.storage
      .from('videos')
      .upload(`${id}.mp4`, videoBytes, { contentType: 'video/mp4', upsert: true })
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

    const { data: { publicUrl: videoUrl } } = supabase.storage.from('videos').getPublicUrl(`${id}.mp4`)

    await supabase.from('content_packages').update({ video_url: videoUrl }).eq('id', id)
    await supabase.from('video_jobs').update({
      status: 'complete',
      video_url: videoUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)

    console.log(`[job ${job.id}] ✓ Complete: ${videoUrl}`)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[job ${job.id}] ✗ Failed: ${msg}`)
    await supabase.from('video_jobs').update({
      status: 'failed',
      error: msg,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)
  } finally {
    // Always clean up temp files, even if something crashed
    for (const p of [audioPath, videoPath]) {
      if (existsSync(p)) unlinkSync(p)
    }
  }
}

// ─── Entry point ───────────────────────────────────────────────────────────────
// CI mode  (GitHub Actions, CI=true): claim ONE job → process it → exit.
// Server mode (Railway etc.)        : poll every 5 seconds indefinitely.

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
      console.log('No pending jobs. Exiting.')
      return
    }

    const job = jobs[0]
    if (!UUID_RE.test(job.package_id)) {
      console.log(`Skipping fake job ${job.id} (package_id='${job.package_id}')`)
      await supabase.from('video_jobs').update({ status: 'failed', error: 'Invalid package_id', updated_at: new Date().toISOString() }).eq('id', job.id)
      return
    }
    const { error: claimErr } = await supabase
      .from('video_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'pending') // Only claim if still pending (prevents double-processing)

    if (!claimErr) await processJob(job as VideoJob)
    return
  }

  console.log('Server mode: polling every', POLL_MS / 1000, 's...')
  while (true) {
    try {
      const { data: jobs } = await supabase
        .from('video_jobs').select('*').eq('status', 'pending')
        .order('created_at', { ascending: true }).limit(1)

      if (jobs && jobs.length > 0) {
        const job = jobs[0]
        if (!UUID_RE.test(job.package_id)) {
          await supabase.from('video_jobs').update({ status: 'failed', error: 'Invalid package_id', updated_at: new Date().toISOString() }).eq('id', job.id)
          continue
        }
        const { error: claimErr } = await supabase
          .from('video_jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id).eq('status', 'pending')
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
