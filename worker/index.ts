import { createClient } from '@supabase/supabase-js'
import { spawnSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import Anthropic from '@anthropic-ai/sdk'

// ─── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PEXELS_KEY   = process.env.PEXELS_API_KEY ?? ''
const POLL_MS      = 5_000
const TMP          = '/tmp/videoworker'
const VID_W        = 1080
const VID_H        = 1920

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

// ─── FFmpeg ────────────────────────────────────────────────────────────────────

function resolveFfmpeg(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const staticPath = require('ffmpeg-static') as string | false | null
  if (staticPath && existsSync(String(staticPath))) {
    const r = spawnSync(String(staticPath), ['-version'], { stdio: 'pipe', timeout: 5000 })
    if (!r.error && r.status === 0) return String(staticPath)
  }
  return 'ffmpeg'
}

const FFMPEG = resolveFfmpeg()
console.log('FFmpeg:', FFMPEG)

function ffmpeg(args: string[], timeoutMs = 240_000) {
  const r = spawnSync(FFMPEG, args, { stdio: 'pipe', timeout: timeoutMs })
  if (r.error) throw new Error(`FFmpeg spawn: ${r.error.message}`)
  if (r.status !== 0) throw new Error(`FFmpeg exit ${r.status}: ${r.stderr?.toString().slice(-600) ?? ''}`)
}

// ─── Caption helpers ───────────────────────────────────────────────────────────

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildCaptionSVG(words: string[], highlights: Set<string>): string {
  const boxH = 230
  const boxY = VID_H - boxH - 130
  const ty = boxY + 162
  const totalChars = words.join(' ').length
  const fontSize = Math.max(60, Math.min(92, Math.floor(900 / Math.max(totalChars, 8))))
  const charW = fontSize * 0.62
  const spaceW = fontSize * 0.34
  const wordWidths = words.map((w) => w.length * charW)
  const totalW = wordWidths.reduce((s, w) => s + w, 0) + spaceW * (words.length - 1)
  let x = Math.max(40, (VID_W - totalW) / 2)
  const strokes: string[] = []
  const fills: string[] = []
  words.forEach((word, i) => {
    const clean = word.replace(/[.,!?'"]/g, '').toLowerCase()
    const color = highlights.has(clean) ? '#FF3333' : 'white'
    const wx = x + wordWidths[i] / 2
    strokes.push(`<text x="${wx.toFixed(1)}" y="${ty}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${fontSize}" font-weight="900" fill="none" stroke="#000" stroke-width="10" stroke-linejoin="round">${xmlEscape(word)}</text>`)
    fills.push(`<text x="${wx.toFixed(1)}" y="${ty}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${fontSize}" font-weight="900" fill="${color}">${xmlEscape(word)}</text>`)
    x += wordWidths[i] + spaceW
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VID_W}" height="${VID_H}">
  <rect x="30" y="${boxY}" width="${VID_W - 60}" height="${boxH}" rx="22" fill="#000000" opacity="0.65"/>
  ${strokes.join('\n  ')}
  ${fills.join('\n  ')}
</svg>`
}

// ─── Job processor ─────────────────────────────────────────────────────────────

interface VideoJob {
  id: string
  package_id: string
  script: string
  audio_url: string
  bg_video_url: string | null
}

interface WordTiming { word: string; start: number; end: number }
interface CaptionChunk { words: string[]; start: number; duration: number }

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

async function processJob(job: VideoJob) {
  const id = job.package_id
  const audioPath   = join(TMP, `${id}.mp3`)
  const bgPngPath   = join(TMP, `${id}_bg.png`)
  const concatPath  = join(TMP, `${id}_captions.txt`)
  const videoPath   = join(TMP, `${id}.mp4`)
  const pngPaths: string[] = []

  console.log(`[job ${job.id}] starting for package ${id}`)

  try {
    // 1. Download audio
    if (!await downloadFile(job.audio_url, audioPath)) throw new Error('Failed to download audio')

    // 2. Audio duration
    const { parseFile } = await import('music-metadata')
    const meta = await parseFile(audioPath)
    const duration = meta.format.duration
    if (!duration || isNaN(duration)) throw new Error('Could not determine audio duration')

    // 3. Highlight words (non-fatal)
    let highlights = new Set<string>()
    if (anthropic) {
      try {
        const hlRes = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 200,
          messages: [{ role: 'user', content: `Pick 6-8 high-impact words from this TikTok script to highlight in red. Return ONLY a JSON array of lowercase words:\n\n${job.script}` }],
        })
        const raw = hlRes.content[0].type === 'text' ? (hlRes.content[0] as { type: 'text'; text: string }).text : '[]'
        const words: string[] = JSON.parse(raw.match(/\[[\s\S]*?\]/)?.[0] ?? '[]')
        highlights = new Set(words.map(w => w.toLowerCase()))
      } catch { /* non-fatal */ }
    }

    // 4. Background — Pexels photo or solid color
    let bgArg: string[] = ['-f', 'lavfi', '-i', `color=c=0x0e0820:size=${VID_W}x${VID_H}:rate=30`]
    let bgFilter: string = '[0:v]null[bg]'
    let usedBgFile = false

    if (PEXELS_KEY) {
      try {
        const topic = job.script.split(/\s+/).slice(0, 5).join(' ')
        const res = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(topic)}&orientation=portrait&per_page=3`,
          { headers: { Authorization: PEXELS_KEY } }
        )
        if (res.ok) {
          const pdata = await res.json()
          const photos = pdata.photos ?? []
          if (photos.length > 0) {
            const photo = photos[Math.floor(Math.random() * photos.length)]
            const imgUrl = photo.src?.large2x ?? photo.src?.large ?? photo.src?.original
            if (imgUrl) {
              const { default: sharp } = await import('sharp')
              const imgBuf = Buffer.from(await (await fetch(imgUrl)).arrayBuffer())
              await sharp(imgBuf)
                .resize(VID_W, VID_H, { fit: 'cover', position: 'center' })
                .png()
                .toFile(bgPngPath)
              bgArg = ['-loop', '1', '-i', bgPngPath]
              bgFilter = '[0:v]scale=1080:1920[bg]'
              usedBgFile = true
            }
          }
        }
      } catch { /* fall through to solid color */ }
    }

    if (!usedBgFile) {
      bgArg = ['-f', 'lavfi', '-i', `color=c=0x0e0820:size=${VID_W}x${VID_H}:rate=30`]
      bgFilter = '[0:v]null[bg]'
    }

    // 5. Caption chunks — try word timings from Supabase, fall back to even split
    let captionChunks: CaptionChunk[]
    try {
      const { data: { publicUrl: timingsUrl } } = supabase.storage.from('voiceovers').getPublicUrl(`${id}_timestamps.json`)
      const timingsRes = await fetch(timingsUrl)
      if (!timingsRes.ok) throw new Error('no timings')
      const wordTimings: WordTiming[] = await timingsRes.json()
      if (!Array.isArray(wordTimings) || wordTimings.length === 0) throw new Error('empty timings')
      const chunks: CaptionChunk[] = []
      for (let i = 0; i < wordTimings.length; i += 3) {
        const slice = wordTimings.slice(i, i + 3)
        const next = wordTimings[i + 3]
        const start = slice[0].start
        const end = next?.start ?? slice[slice.length - 1].end
        chunks.push({ words: slice.map(w => w.word), start, duration: Math.max(0.1, end - start) })
      }
      captionChunks = chunks
    } catch {
      const words = job.script.split(/\s+/).filter(Boolean)
      const chunkDur = duration / Math.ceil(words.length / 3)
      captionChunks = []
      for (let i = 0; i < words.length; i += 3) {
        captionChunks.push({ words: words.slice(i, i + 3), start: 0, duration: chunkDur })
      }
    }

    // 6. Render caption PNGs
    const { default: sharp } = await import('sharp')
    for (let i = 0; i < captionChunks.length; i++) {
      const p = join(TMP, `${id}_cap${i}.png`)
      await sharp(Buffer.from(buildCaptionSVG(captionChunks[i].words, highlights))).png().toFile(p)
      pngPaths.push(p)
    }

    // 7. Write concat file
    const concatLines = ['ffconcat version 1.0']
    for (let i = 0; i < captionChunks.length; i++) {
      concatLines.push(`file '${pngPaths[i]}'`, `duration ${captionChunks[i].duration.toFixed(4)}`)
    }
    concatLines.push(`file '${pngPaths[pngPaths.length - 1]}'`)
    writeFileSync(concatPath, concatLines.join('\n'), 'utf8')

    // 8. Render video
    ffmpeg([
      '-y',
      ...bgArg,
      '-i', audioPath,
      '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-filter_complex', `${bgFilter};[2:v]fps=30,format=rgba[cap];[bg][cap]overlay=0:0[vout]`,
      '-map', '[vout]', '-map', '1:a',
      '-t', String(duration),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '26',
      '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart',
      videoPath,
    ])

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
    for (const p of [audioPath, bgPngPath, concatPath, videoPath, ...pngPaths]) {
      if (existsSync(p)) unlinkSync(p)
    }
  }
}

// ─── Poll loop ─────────────────────────────────────────────────────────────────

async function run() {
  mkdirSync(TMP, { recursive: true })
  console.log('Worker started. Polling every', POLL_MS / 1000, 's...')

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
        // Claim atomically — skip if another worker already grabbed it
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
