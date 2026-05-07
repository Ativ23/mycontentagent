import { NextRequest, NextResponse } from 'next/server'
import { spawnSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
// music-metadata is ESM-only — imported dynamically inside getAudioDuration
import ffmpegStaticPath from 'ffmpeg-static'
import { getSupabaseAdmin } from '@/lib/supabase'
import { anthropic } from '@/lib/anthropic'
import { getVideoProvider } from '@/lib/video-providers'

export const runtime = 'nodejs'
export const maxDuration = 300

const TMP = '/tmp/mycontentagent'
// Vercel Hobby has a 10s function limit — use lower res to fit within budget
const ON_VERCEL = !!process.env.VERCEL
const VID_W = ON_VERCEL ? 720 : 1080
const VID_H = ON_VERCEL ? 1280 : 1920

// ─── FFmpeg binary resolution ─────────────────────────────────────────────────
// Tests the binary by running -version so we know it actually executes on this
// platform (avoids a Lambda process crash when the binary exists but can't run).

function resolveFfmpegPath(): string | null {
  const candidates = [
    ffmpegStaticPath ? String(ffmpegStaticPath) : null,
    'ffmpeg',
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    if (candidate !== 'ffmpeg' && !existsSync(candidate)) continue
    // Use spawnSync so a bad binary (wrong arch, missing libs) never crashes
    // the parent process — it just returns a result with .error or status != 0.
    const probe = spawnSync(candidate, ['-version'], { stdio: 'pipe', timeout: 5000 })
    if (!probe.error && probe.status === 0) return candidate
  }
  return null
}

const FFMPEG_PATH = resolveFfmpegPath()

function ffmpeg(args: string[], opts?: { timeout?: number }) {
  if (!FFMPEG_PATH) throw new Error('VIDEO_UNAVAILABLE')
  const result = spawnSync(FFMPEG_PATH, args, { stdio: 'pipe', timeout: opts?.timeout ?? 120_000 })
  if (result.error) throw new Error(`FFmpeg spawn error: ${result.error.message}`)
  if (result.status !== 0) {
    const stderr = result.stderr?.toString().slice(-800) ?? ''
    throw new Error(`FFmpeg exited ${result.status}: ${stderr}`)
  }
  return result.stdout
}

// ─── Audio duration (pure JS — no ffprobe needed) ────────────────────────────

async function getAudioDuration(filePath: string): Promise<number> {
  const { parseFile } = await import('music-metadata')
  const meta = await parseFile(filePath)
  const dur = meta.format.duration
  if (!dur || isNaN(dur)) throw new Error('Could not determine audio duration')
  return dur
}

// ─── Caption rendering ────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
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
    strokes.push(
      `<text x="${wx.toFixed(1)}" y="${ty}" text-anchor="middle"` +
      ` font-family="Arial Black, Impact, sans-serif" font-size="${fontSize}" font-weight="900"` +
      ` fill="none" stroke="#000" stroke-width="10" stroke-linejoin="round">${xmlEscape(word)}</text>`
    )
    fills.push(
      `<text x="${wx.toFixed(1)}" y="${ty}" text-anchor="middle"` +
      ` font-family="Arial Black, Impact, sans-serif" font-size="${fontSize}" font-weight="900"` +
      ` fill="${color}">${xmlEscape(word)}</text>`
    )
    x += wordWidths[i] + spaceW
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VID_W}" height="${VID_H}">
  <rect x="30" y="${boxY}" width="${VID_W - 60}" height="${boxH}" rx="22" fill="#000000" opacity="0.65"/>
  ${strokes.join('\n  ')}
  ${fills.join('\n  ')}
</svg>`
}

// ─── Background helpers ───────────────────────────────────────────────────────

async function buildGradientBg(path: string) {
  // Use Sharp's native create (no SVG / no librsvg dependency) to avoid
  // native crashes in Lambda environments where librsvg is not bundled.
  await sharp({
    create: { width: VID_W, height: VID_H, channels: 3, background: { r: 14, g: 8, b: 32 } },
  })
    .png()
    .toFile(path)
}

async function fetchPexelsPhoto(query: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`,
      { headers: { Authorization: apiKey } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const photos: { src: { large2x?: string; large?: string; original?: string } }[] = data.photos || []
    if (!photos.length) return null
    const photo = photos[Math.floor(Math.random() * Math.min(photos.length, 3))]
    return photo.src?.large2x ?? photo.src?.large ?? photo.src?.original ?? null
  } catch { return null }
}

async function fetchPexelsVideo(query: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`,
      { headers: { Authorization: apiKey } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const videos = data.videos || []
    if (!videos.length) return null
    const video = videos[Math.floor(Math.random() * Math.min(videos.length, 3))]
    const files: { quality: string; height: number; link: string }[] = video.video_files || []
    const file = files.find((f) => f.quality === 'hd' && f.height >= 720) || files.find((f) => f.height >= 480) || files[0]
    return file?.link ?? null
  } catch { return null }
}

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

// ─── Caption timing ──────────────────────────────────────────────────────────

interface WordTiming { word: string; start: number; end: number }
interface CaptionChunk { words: string[]; start: number; duration: number }

function buildTimedChunks(wordTimings: WordTiming[], wordsPerChunk = 3): CaptionChunk[] {
  const chunks: CaptionChunk[] = []
  for (let i = 0; i < wordTimings.length; i += wordsPerChunk) {
    const slice = wordTimings.slice(i, i + wordsPerChunk)
    const next = wordTimings[i + wordsPerChunk]
    const start = slice[0].start
    const end = next?.start ?? slice[slice.length - 1].end
    chunks.push({ words: slice.map((w) => w.word), start, duration: Math.max(0.1, end - start) })
  }
  return chunks
}

// ─── Scene helpers ────────────────────────────────────────────────────────────

interface Scene { prompt: string; imageQuery: string }

async function getScenes(script: string, numScenes: number): Promise<Scene[]> {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Split this TikTok script into exactly ${numScenes} visually distinct scenes for AI video generation. Each scene is only 5 seconds — make them visually interesting and varied from one another.

For each scene return:
- "prompt": a cinematic Runway AI prompt (~15 words, portrait/vertical format, no text/logos). Include: subject + action + environment + lighting. Vary the setting across scenes — different locations, lighting, perspectives.
- "imageQuery": a 2-3 word Pexels photo search query for the starting frame (match the scene topic)

Good prompt variety example for a finance video:
Scene 1: "Person at laptop in modern office, dramatic side lighting, close-up on screen, slow push in"
Scene 2: "Stack of cash on table, overhead shot, warm cinematic lighting, slight tilt"
Scene 3: "City skyline at dusk, aerial view, golden hour, slow pan right"
Scene 4: "Person checking phone banking app, shallow depth of field, soft indoor light"

Each scene must look completely different from the previous one. Vary: indoor/outdoor, close-up/wide, people/objects/places.

Return ONLY a JSON array of ${numScenes} objects {prompt, imageQuery}. No other text.

Script:
${script}`,
    }],
  })
  const raw = res.content[0].type === 'text' ? res.content[0].text : '[]'
  try {
    const parsed = JSON.parse(raw.match(/\[[\s\S]*?\]/)?.[0] ?? '[]') as Scene[]
    if (parsed.length === numScenes) return parsed
  } catch { /* fall through */ }
  return Array.from({ length: numScenes }, (_, i) => ({
    prompt: `Person talking to camera with confident expression, cinematic lighting, vertical portrait format, smooth camera movement scene ${i + 1}`,
    imageQuery: 'person talking portrait',
  }))
}

// ─── Compose multi-clip background ───────────────────────────────────────────

function composeBackground(clipPaths: string[], segDur: number, outputPath: string) {
  const inputs = clipPaths.flatMap((p) => ['-stream_loop', '-1', '-t', segDur.toFixed(3), '-i', p])
  const filters = clipPaths.map((_, i) =>
    `[${i}:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[v${i}]`
  )
  const concatPart = clipPaths.map((_, i) => `[v${i}]`).join('') +
    `concat=n=${clipPaths.length}:v=1:a=0[bgout]`

  ffmpeg([
    '-y',
    ...inputs,
    '-filter_complex', [...filters, concatPart].join(';'),
    '-map', '[bgout]',
    '-r', '30',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
    outputPath,
  ], { timeout: 120_000 })
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    return await handleVideoGeneration(req)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Video generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function handleVideoGeneration(req: NextRequest) {
  const body = await req.text()
  let packageId: string, script: string, audioUrl: string, bgVideoUrl: string | undefined
  try {
    const parsed = JSON.parse(body);
    ({ packageId, script, audioUrl, bgVideoUrl } = parsed)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!packageId || !script || !audioUrl) {
    return NextResponse.json({ error: 'Missing packageId, script, or audioUrl' }, { status: 400 })
  }

  if (!FFMPEG_PATH) {
    return NextResponse.json(
      { error: 'VIDEO_UNAVAILABLE', message: 'Video rendering is not available in this environment.' },
      { status: 503 }
    )
  }

  mkdirSync(TMP, { recursive: true })

  const audioPath      = join(TMP, `${packageId}.mp3`)
  const bgPngPath      = join(TMP, `${packageId}_bg.png`)
  const bgComposedPath = join(TMP, `${packageId}_bgc.mp4`)
  const concatPath     = join(TMP, `${packageId}_captions.txt`)
  const videoPath      = join(TMP, `${packageId}.mp4`)
  const clipPaths: string[] = []
  const pngPaths: string[] = []
  let bgComposed = false
  let hasSingleClip = false
  let singleClipPath = ''

  let caughtError: string | null = null

  try {
    if (ON_VERCEL) {
      // ── Vercel fast path ────────────────────────────────────────────────────
      // No audio download, no music-metadata, no Claude, no Supabase fetches.
      // Background uses Sharp.create (no SVG/librsvg). Captions attempt SVG;
      // if that fails they are skipped so the video still produces.

      await buildGradientBg(bgPngPath)

      const words = script.split(/\s+/).filter(Boolean)
      const CHUNK_DUR = 1.6
      const vercelChunks: CaptionChunk[] = []
      for (let i = 0; i < words.length; i += 3) {
        vercelChunks.push({ words: words.slice(i, i + 3), start: (i / 3) * CHUNK_DUR, duration: CHUNK_DUR })
      }

      // Try to generate caption PNGs via SVG. If any fail (e.g. librsvg missing),
      // fall back to a captions-free video rather than crashing.
      let captionsOk = false
      const capPaths: string[] = new Array(vercelChunks.length).fill('')
      try {
        const emptyHighlights = new Set<string>()
        await Promise.all(vercelChunks.map(async (chunk, i) => {
          const p = join(TMP, `${packageId}_cap${i}.png`)
          await sharp(Buffer.from(buildCaptionSVG(chunk.words, emptyHighlights))).png().toFile(p)
          capPaths[i] = p
        }))
        pngPaths.push(...capPaths)
        captionsOk = true
      } catch { /* SVG not supported — continue without captions */ }

      let ffmpegArgs: string[]
      if (captionsOk && capPaths.every(Boolean)) {
        const concatLines = ['ffconcat version 1.0']
        for (let i = 0; i < vercelChunks.length; i++) {
          concatLines.push(`file '${capPaths[i]}'`, `duration ${vercelChunks[i].duration.toFixed(4)}`)
        }
        concatLines.push(`file '${capPaths[capPaths.length - 1]}'`)
        writeFileSync(concatPath, concatLines.join('\n'), 'utf8')

        ffmpegArgs = [
          '-y',
          '-loop', '1', '-i', bgPngPath,
          '-i', audioUrl,
          '-f', 'concat', '-safe', '0', '-i', concatPath,
          '-filter_complex', `[0:v]scale=${VID_W}:${VID_H}[bg];[2:v]fps=24,format=rgba[cap];[bg][cap]overlay=0:0[vout]`,
          '-map', '[vout]', '-map', '1:a',
          '-shortest',
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
          '-c:a', 'aac', '-b:a', '128k',
          '-movflags', '+faststart',
          videoPath,
        ]
      } else {
        // No captions — simpler FFmpeg command
        ffmpegArgs = [
          '-y',
          '-loop', '1', '-i', bgPngPath,
          '-i', audioUrl,
          '-filter_complex', `[0:v]scale=${VID_W}:${VID_H}[vout]`,
          '-map', '[vout]', '-map', '1:a',
          '-shortest',
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
          '-c:a', 'aac', '-b:a', '128k',
          '-movflags', '+faststart',
          videoPath,
        ]
      }

      ffmpeg(ffmpegArgs, { timeout: 55_000 })

    } else {
      // ── Local dev full path ─────────────────────────────────────────────────
      const audioRes = await fetch(audioUrl)
      if (!audioRes.ok) throw new Error('Failed to download voiceover audio')
      writeFileSync(audioPath, Buffer.from(await audioRes.arrayBuffer()))

      const duration = await getAudioDuration(audioPath)

      const aiProvider = getVideoProvider()
      const pexelsKey = process.env.PEXELS_API_KEY

      if (bgVideoUrl) {
        const p = join(TMP, `${packageId}_clip0.mp4`)
        if (await downloadFile(bgVideoUrl, p)) { clipPaths.push(p); hasSingleClip = true; singleClipPath = p }
      } else if (aiProvider) {
        const clipDuration = 5 as const
        const numScenes = Math.min(6, Math.max(3, Math.ceil(duration / clipDuration)))
        const scenes = await getScenes(script, numScenes)
        const results = await Promise.allSettled(scenes.map(async (scene, i) => {
          let startImageUrl: string | null = pexelsKey ? await fetchPexelsPhoto(scene.imageQuery, pexelsKey) : null
          if (!startImageUrl) {
            const tmpImg = join(TMP, `${packageId}_start${i}.png`)
            await buildGradientBg(tmpImg)
            const supabase = getSupabaseAdmin()
            const imgBuf = readFileSync(tmpImg); unlinkSync(tmpImg)
            const imgKey = `scene-starters/${packageId}_${i}.png`
            await supabase.storage.from('videos').upload(imgKey, imgBuf, { contentType: 'image/png', upsert: true })
            const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(imgKey)
            startImageUrl = publicUrl
          }
          const clipUrl = await aiProvider.generateClip({ prompt: scene.prompt, startImageUrl, durationSeconds: clipDuration })
          const p = join(TMP, `${packageId}_clip${i}.mp4`)
          if (!await downloadFile(clipUrl, p)) throw new Error(`Failed to download clip ${i}`)
          return p
        }))
        for (const r of results) { if (r.status === 'fulfilled') clipPaths.push(r.value) }
        if (clipPaths.length === 1) { hasSingleClip = true; singleClipPath = clipPaths[0] }
        else if (clipPaths.length > 1) { composeBackground(clipPaths, duration / clipPaths.length, bgComposedPath); bgComposed = true }
      }

      let highlightWords: string[] = []
      try {
        const hlRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-6', max_tokens: 200,
          messages: [{ role: 'user', content: `From this TikTok script, pick 6-8 high-impact words to highlight in red. Return ONLY a JSON array of lowercase words:\n\n${script}` }],
        })
        const raw = hlRes.content[0].type === 'text' ? hlRes.content[0].text : '[]'
        highlightWords = JSON.parse(raw.match(/\[[\s\S]*?\]/)?.[0] ?? '[]')
      } catch { /* non-fatal */ }
      const highlights = new Set(highlightWords.map((w) => w.toLowerCase()))

      if (!bgComposed && !hasSingleClip) await buildGradientBg(bgPngPath)

      let captionChunks: CaptionChunk[] | null = null
      try {
        const supabaseForTimings = getSupabaseAdmin()
        const { data: { publicUrl: timingsUrl } } = supabaseForTimings.storage.from('voiceovers').getPublicUrl(`${packageId}_timestamps.json`)
        const timingsRes = await fetch(timingsUrl)
        if (timingsRes.ok) {
          const wordTimings: WordTiming[] = await timingsRes.json()
          if (Array.isArray(wordTimings) && wordTimings.length > 0) captionChunks = buildTimedChunks(wordTimings, 3)
        }
      } catch { /* non-fatal */ }

      if (!captionChunks) {
        const words = script.split(/\s+/).filter(Boolean)
        const chunkDur = duration / Math.ceil(words.length / 3)
        captionChunks = []
        for (let i = 0; i < words.length; i += 3) captionChunks.push({ words: words.slice(i, i + 3), start: 0, duration: chunkDur })
      }

      for (let i = 0; i < captionChunks.length; i++) {
        const p = join(TMP, `${packageId}_cap${i}.png`)
        await sharp(Buffer.from(buildCaptionSVG(captionChunks[i].words, highlights))).png().toFile(p)
        pngPaths.push(p)
      }

      const concatLines = ['ffconcat version 1.0']
      for (let i = 0; i < captionChunks.length; i++) concatLines.push(`file '${pngPaths[i]}'`, `duration ${captionChunks[i].duration.toFixed(4)}`)
      concatLines.push(`file '${pngPaths[pngPaths.length - 1]}'`)
      writeFileSync(concatPath, concatLines.join('\n'), 'utf8')

      const bgArgs = bgComposed ? ['-stream_loop', '-1', '-i', bgComposedPath] : hasSingleClip ? ['-stream_loop', '-1', '-i', singleClipPath] : ['-loop', '1', '-i', bgPngPath]
      const bgFilter = bgComposed ? '[0:v]null[bg]' : hasSingleClip ? '[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]' : '[0:v]scale=1080:1920[bg]'

      ffmpeg([
        '-y', ...bgArgs, '-i', audioPath, '-f', 'concat', '-safe', '0', '-i', concatPath,
        '-filter_complex', `${bgFilter};[2:v]fps=30,format=rgba[cap];[bg][cap]overlay=0:0[vout]`,
        '-map', '[vout]', '-map', '1:a', '-t', String(duration),
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '26',
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', videoPath,
      ], { timeout: 240_000 })
    }

    // ── 7. Upload ─────────────────────────────────────────────────────────────
    const supabase = getSupabaseAdmin()
    const { error: uploadErr } = await supabase.storage
      .from('videos')
      .upload(`${packageId}.mp4`, readFileSync(videoPath), { contentType: 'video/mp4', upsert: true })
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`)

    const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(`${packageId}.mp4`)
    await supabase.from('content_packages').update({ video_url: publicUrl }).eq('id', packageId)

    return NextResponse.json({ videoUrl: publicUrl })

  } catch (err: unknown) {
    caughtError = err instanceof Error ? err.message : 'Video generation failed'
  } finally {
    for (const p of [audioPath, bgPngPath, bgComposedPath, concatPath, videoPath, ...clipPaths, ...pngPaths]) {
      if (existsSync(p)) unlinkSync(p)
    }
  }

  if (caughtError === 'VIDEO_UNAVAILABLE') {
    return NextResponse.json(
      { error: 'VIDEO_UNAVAILABLE', message: 'Video rendering is not available in this environment.' },
      { status: 503 }
    )
  }
  return NextResponse.json({ error: caughtError ?? 'Video generation failed' }, { status: 500 })
}
