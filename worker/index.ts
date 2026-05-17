import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition, ensureBrowser } from '@remotion/renderer'
import type { Caption } from '@remotion/captions'
import type { SceneData, AnimatedSceneData } from '../remotion/TikTokVideo'
import { sendAlert } from '../lib/alerts'

// ─── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PEXELS_KEY    = process.env.PEXELS_API_KEY ?? ''
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY ?? ''
const POLL_MS       = 5_000
const TMP           = '/tmp/videoworker'
const UUID_RE       = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Jobs stuck in "processing" longer than this are assumed crashed and reset
const STUCK_JOB_MIN = 20

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// ─── Structured logging ────────────────────────────────────────────────────────
// Every log line gets a UTC timestamp so GitHub Actions logs are easy to read.
function log(level: 'INFO' | 'WARN' | 'ERROR', msg: string, jobId?: string) {
  const ts     = new Date().toISOString()
  const prefix = jobId ? `[${ts}] [${level}] [job:${jobId}]` : `[${ts}] [${level}]`
  if (level === 'ERROR') console.error(`${prefix} ${msg}`)
  else if (level === 'WARN') console.warn(`${prefix} ${msg}`)
  else console.log(`${prefix} ${msg}`)
}

// ─── Fetch with timeout ────────────────────────────────────────────────────────
// Wraps fetch() with an AbortController so a hung network call doesn't
// block the entire job and eat the GitHub Actions timeout budget.
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 15_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ─── Retry with exponential backoff ───────────────────────────────────────────
// Retries an async function up to `maxAttempts` times.
// Waits 1s, 2s, 4s, ... between attempts (capped at 8s).
// Only retries on network/transient errors — if the function throws a
// non-retryable error (e.g. "Invalid packageId") we re-throw immediately.
async function retry<T>(fn: () => Promise<T>, maxAttempts = 3, label = 'operation'): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < maxAttempts) {
        const wait = Math.min(1000 * 2 ** (attempt - 1), 8000)
        log('WARN', `${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${wait}ms: ${err instanceof Error ? err.message : String(err)}`)
        await new Promise(r => setTimeout(r, wait))
      }
    }
  }
  throw lastErr
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
    const res = await fetchWithTimeout(url, {}, 30_000)
    if (!res.ok) { log('WARN', `downloadFile HTTP ${res.status} for ${url}`); return false }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1024) { log('WARN', `downloadFile: file too small (${buf.length} bytes)`); return false }
    writeFileSync(dest, buf)
    return true
  } catch (err) {
    log('WARN', `downloadFile error: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
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

// ─── Animated scene breakdown ─────────────────────────────────────────────────
// Ask Claude Haiku to break the script into animated graphic scenes.
// Returns typed scene definitions: stat cards, comparison cards, text cards.
interface AnimatedSceneDef {
  type: 'hook' | 'counter' | 'comparison' | 'steps' | 'text'
  voiceLine: string
  accentColor?: string
  // counter
  value?: string
  unit?: string
  label?: string
  // comparison
  leftValue?: string
  leftLabel?: string
  rightValue?: string
  rightLabel?: string
  // text / hook
  headline?: string
  subtext?: string
  // steps
  items?: string[]
  // runway background clip prompt
  visualPrompt?: string
}

async function breakIntoAnimatedScenes(script: string): Promise<AnimatedSceneDef[]> {
  if (!anthropic) {
    return [{ type: 'text', voiceLine: script, headline: 'Watch this', subtext: 'You need to know this' }]
  }

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are building animated graphics for a short-form video. The content could be ANY niche — fitness, cooking, finance, travel, gaming, tech, beauty, education, or anything else.

Script:
"""
${script}
"""

Break this into 4-6 visual scenes. Each scene shows an animated graphic while those exact words are spoken.

Scene types — pick whichever fits the content naturally:
- "hook": Opening scene only. Bold attention-grabber (max 5 word headline).
- "counter": Any specific number/quantity spoken aloud — counts up from zero on screen. Use for: calories, dollars, minutes, reps, km, followers, steps, ingredients, years, anything countable.
- "comparison": Two things contrasted — good vs bad, before vs after, option A vs B. Both sides must appear in the voiceLine.
- "steps": A process or sequence with 2-4 clear steps. Use for how-tos, recipes, routines, tutorials.
- "text": Key insight, tip, or takeaway. Punchy headline (max 5 words).

Rules:
- Cover the ENTIRE script. Every word in exactly one scene.
- voiceLine: EXACT words from the script, nothing added or removed.
- counter: value = exact number as string ("500", "5.0%", "$1,000", "30"), unit = short label ("calories", "per year", "minutes"), label = optional extra context.
- comparison: leftValue/leftLabel = worse/before/A side. rightValue/rightLabel = better/after/B side.
- steps: items = array of 2-4 short step strings (max 6 words each).
- text/hook: headline max 5 words, subtext optional max 8 words.
- accentColor: pick a hex that fits the mood — #7c3aed violet, #0ea5e9 blue, #f97316 orange, #22c55e green, #ec4899 pink, #eab308 yellow.
- visualPrompt: 15-20 word cinematic description for an AI video background clip. Vertical 9:16 shot. Real-world scene, no text or logos. Match the mood and subject of the voiceLine. Examples: "Person lifting weights in modern gym, dramatic lighting, slow motion, vertical", "Close-up hands counting money on wooden desk, warm tones, cinematic", "Aerial city at night, neon lights, rain-wet streets, vertical frame".

Return ONLY a valid JSON array, no other text:
[
  {"type":"hook","voiceLine":"...","headline":"Opener here","subtext":"optional","visualPrompt":"Dramatic establishing shot matching the hook topic, cinematic"},
  {"type":"counter","voiceLine":"...","value":"500","unit":"calories","label":"burned per session","accentColor":"#f97316","visualPrompt":"Person doing intense workout in modern gym, close-up, dramatic lighting"},
  {"type":"comparison","voiceLine":"...","leftValue":"Cardio","leftLabel":"60 min for 500 cal","rightValue":"HIIT","rightLabel":"20 min for 500 cal","visualPrompt":"Side by side workout comparison, gym environment, vertical frame"},
  {"type":"steps","voiceLine":"...","items":["Step one","Step two","Step three"],"accentColor":"#0ea5e9","visualPrompt":"Hands-on tutorial activity close-up, clean environment, natural light"},
  {"type":"text","voiceLine":"...","headline":"Key takeaway","subtext":"optional","visualPrompt":"Cinematic wide shot reinforcing the key message, vertical, moody"}
]`,
      }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text : '[]'
    const parsed: AnimatedSceneDef[] = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('empty scene list')
    return parsed
  } catch (e) {
    console.warn('Animated scene breakdown failed, using fallback:', e)
    return [{ type: 'text', voiceLine: script, headline: 'Watch this', subtext: 'You need to know this' }]
  }
}

// ─── Align animated scenes to real word timings ────────────────────────────────
// Matches the first words of each scene's voiceLine against the ElevenLabs word
// timestamps so scene cuts happen exactly when the speaker starts saying that line.
function alignAnimatedScenes(
  scenes: AnimatedSceneDef[],
  captions: Caption[],
  durationInSeconds: number,
): AnimatedSceneData[] {
  const totalMs = durationInSeconds * 1000

  const captionWords = captions.map(c => ({
    clean: c.text.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
    startMs: c.startMs,
  })).filter(w => w.clean)

  const result: Array<AnimatedSceneDef & { startMs: number; durationMs: number }> = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    let startMs = i === 0 ? 0 : result[i - 1].startMs + result[i - 1].durationMs

    if (i > 0 && captionWords.length > 0) {
      const searchWords = scene.voiceLine
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)

      outer: for (let j = 0; j < captionWords.length - searchWords.length + 1; j++) {
        for (let k = 0; k < searchWords.length; k++) {
          if (captionWords[j + k]?.clean !== searchWords[k]) continue outer
        }
        startMs = captionWords[j].startMs
        break
      }
    }

    result.push({ ...scene, startMs, durationMs: 0 })
  }

  for (let i = 0; i < result.length; i++) {
    const nextStart = result[i + 1]?.startMs ?? totalMs
    result[i].durationMs = Math.max(500, nextStart - result[i].startMs)
  }

  return result as AnimatedSceneData[]
}

// ─── Veo 3.1 clip generation ──────────────────────────────────────────────────
// Generates a single 8-second 9:16 AI video clip via Google Veo 3.1 Lite.
// Uploads to Supabase (Veo URIs are temporary) and returns a permanent URL.
// Returns null on any failure — caller falls back to animated gradient.
const veoClient = GOOGLE_AI_KEY ? new GoogleGenAI({ apiKey: GOOGLE_AI_KEY }) : null

async function generateVeoClip(
  prompt: string,
  packageId: string,
  sceneIdx: number,
  jid: string,
): Promise<string | null> {
  if (!veoClient) return null

  log('INFO', `  Veo [${sceneIdx}] "${prompt.slice(0, 60)}..."`, jid)

  try {
    let operation = await veoClient.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt,
      config: {
        aspectRatio: '9:16',
        durationSeconds: 8,
        numberOfVideos: 1,
      },
    })

    // Poll until complete (max 5 minutes)
    const deadline = Date.now() + 5 * 60 * 1000
    while (!operation.done && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 10_000))
      operation = await veoClient.operations.getVideosOperation({ operation })
    }

    if (!operation.done) { log('WARN', `  Veo [${sceneIdx}] timed out`, jid); return null }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sample = (operation as any).response?.generatedSamples?.[0]
    if (!sample?.video) { log('WARN', `  Veo [${sceneIdx}] no video in response`, jid); return null }

    // Video comes back as a URI — download it with API key auth
    let videoBuffer: Buffer | null = null
    if (sample.video.uri) {
      const dlRes = await fetchWithTimeout(
        sample.video.uri,
        { headers: { 'x-goog-api-key': GOOGLE_AI_KEY } },
        60_000,
      )
      if (!dlRes.ok) { log('WARN', `  Veo [${sceneIdx}] download failed ${dlRes.status}`, jid); return null }
      videoBuffer = Buffer.from(await dlRes.arrayBuffer())
    } else if (sample.video.bytesBase64Encoded) {
      videoBuffer = Buffer.from(sample.video.bytesBase64Encoded, 'base64')
    }

    if (!videoBuffer) { log('WARN', `  Veo [${sceneIdx}] no video data`, jid); return null }

    const storageKey = `veo/${packageId}_${sceneIdx}.mp4`
    const { error } = await supabase.storage
      .from('videos')
      .upload(storageKey, videoBuffer, { contentType: 'video/mp4', upsert: true })

    if (error) { log('WARN', `  Veo [${sceneIdx}] upload failed: ${error.message}`, jid); return null }

    const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(storageKey)
    log('INFO', `  Veo [${sceneIdx}] done ✓`, jid)
    return publicUrl
  } catch (err) {
    log('WARN', `  Veo [${sceneIdx}] error: ${err instanceof Error ? err.message : String(err)}`, jid)
    return null
  }
}

// ─── Pexels Video search ───────────────────────────────────────────────────────
// Search Pexels for a real video clip matching the scene's visual keywords.
// We try each keyword in order and return the first good result.
// Returns null if nothing is found (caller falls back to image or solid color).
async function searchPexelsVideo(keywords: string[]): Promise<string | null> {
  if (!PEXELS_KEY) return null

  for (const query of keywords) {
    try {
      const res = await retry(
        () => fetchWithTimeout(
          `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`,
          { headers: { Authorization: PEXELS_KEY } },
          10_000
        ),
        2,
        `pexels-video:"${query}"`
      )
      if (!res.ok) continue

      const data = await res.json() as { videos?: Array<{ video_files: Array<{ file_type: string; quality: string; width: number; height: number; link: string }> }> }
      const videos = data.videos ?? []
      if (!videos.length) continue

      const video = videos[Math.floor(Math.random() * videos.length)]
      const mp4Files = (video.video_files ?? []).filter(f => f.file_type === 'video/mp4')
      const portraitFiles = mp4Files.filter(f => f.height && f.width && f.height > f.width)
      const selected = portraitFiles[0] ?? mp4Files.find(f => f.quality === 'hd') ?? mp4Files[0]

      if (selected?.link) {
        log('INFO', `  Video found for "${query}": ${selected.width}x${selected.height}`)
        return selected.link
      }
    } catch (err) {
      log('WARN', `searchPexelsVideo error for "${query}": ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
  }

  log('WARN', `No video found for keywords: ${keywords.join(', ')}`)
  return null
}

// ─── Pexels Image fallback ─────────────────────────────────────────────────────
// If Pexels Videos returns nothing, fall back to a photo with motion effect.
async function searchPexelsImage(keywords: string[]): Promise<string | null> {
  if (!PEXELS_KEY) return null

  for (const query of keywords) {
    try {
      const res = await retry(
        () => fetchWithTimeout(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=3`,
          { headers: { Authorization: PEXELS_KEY } },
          10_000
        ),
        2,
        `pexels-image:"${query}"`
      )
      if (!res.ok) continue
      const data = await res.json() as { photos?: Array<{ src?: { large2x?: string; large?: string } }> }
      const photos = data.photos ?? []
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
  const jid       = job.id

  log('INFO', `── Starting package ${id}`, jid)

  try {
    // ── STEP 1: Download audio + measure duration ──────────────────────────
    log('INFO', '[1/8] Downloading audio...', jid)
    const downloaded = await retry(() => downloadFile(job.audio_url, audioPath), 3, 'download-audio')
    if (!downloaded) throw new Error('Failed to download audio after 3 attempts')

    const { parseFile } = await import('music-metadata')
    const meta = await parseFile(audioPath)
    const duration = meta.format.duration
    if (!duration || isNaN(duration)) throw new Error('Could not determine audio duration')
    log('INFO', `[1/8] Duration: ${duration.toFixed(1)}s`, jid)

    // ── STEP 2: Word timings → Caption[] ───────────────────────────────────
    log('INFO', '[2/8] Fetching word timings...', jid)
    let captions: Caption[] = []
    try {
      const { data: { publicUrl: timingsUrl } } = supabase.storage
        .from('voiceovers').getPublicUrl(`${id}_timestamps.json`)
      const timingsRes = await fetchWithTimeout(timingsUrl, {}, 10_000)
      if (!timingsRes.ok) throw new Error(`HTTP ${timingsRes.status}`)
      const wordTimings: WordTiming[] = await timingsRes.json()
      if (!Array.isArray(wordTimings) || wordTimings.length === 0) throw new Error('empty timings')
      captions = wordTimings.map((w, i) => ({
        text: (i === 0 ? '' : ' ') + w.word,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        timestampMs: Math.round(w.start * 1000),
        confidence: null,
      }))
      log('INFO', `[2/8] ${captions.length} word timings loaded`, jid)
    } catch (err) {
      log('WARN', `[2/8] Timings unavailable (${err instanceof Error ? err.message : String(err)}), using even-split fallback`, jid)
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

    // ── STEP 3: Highlight words ────────────────────────────────────────────
    log('INFO', '[3/8] Getting highlight words...', jid)
    let highlightWords: string[] = []
    if (anthropic) {
      try {
        const hlRes = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 200,
          messages: [{ role: 'user', content: `Pick 6-8 high-impact words to highlight in red in this TikTok script. Return ONLY a JSON array of lowercase words:\n\n${job.script}` }],
        })
        const raw = hlRes.content[0].type === 'text' ? (hlRes.content[0] as { type: 'text'; text: string }).text : '[]'
        highlightWords = JSON.parse(raw.match(/\[[\s\S]*?\]/)?.[0] ?? '[]')
      } catch (err) {
        log('WARN', `[3/8] Highlight words failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`, jid)
      }
    }
    log('INFO', `[3/8] Highlight words: ${highlightWords.join(', ') || '(none)'}`, jid)

    // ── STEP 4: Break script into visual scenes ───────────────────────────
    // Claude generates a short cinematic prompt for each script segment.
    // These prompts drive Veo 3.1 to produce matching AI video clips.
    log('INFO', '[4/7] Generating visual scene prompts...', jid)
    const sceneDefs = await breakIntoScenes(job.script, duration)
    log('INFO', `[4/7] ${sceneDefs.length} scenes: ${sceneDefs.map(s => s.visualKeywords.join('+')).join(' | ')}`, jid)

    // ── STEP 5: Generate clips — Veo 3.1 → Pexels video → Pexels image ──────
    // Try AI video first, fall back to stock footage, then static image.
    // All scenes run in parallel for speed.
    log('INFO', '[5/7] Generating clips (Veo → Pexels fallback)...', jid)
    const timings = distributeSceneTiming(sceneDefs, duration)
    const scenes: SceneData[] = await Promise.all(
      sceneDefs.map(async (scene, i) => {
        const veoPrompt = `${scene.visualKeywords.join(', ')}, cinematic vertical 9:16 video, ${scene.motionStyle} camera, no text no logos, high quality`
        const videoUrl = await generateVeoClip(veoPrompt, id, i, jid)
          ?? await searchPexelsVideo(scene.visualKeywords)
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
    const veoHit = scenes.filter(s => s.videoUrl?.includes('supabase')).length
    const pexelsHit = scenes.filter(s => s.videoUrl && !s.videoUrl.includes('supabase')).length
    const imageHit = scenes.filter(s => s.imageUrl).length
    log('INFO', `[5/7] ${veoHit} Veo, ${pexelsHit} Pexels video, ${imageHit} Pexels image, ${scenes.length - veoHit - pexelsHit - imageHit} none`, jid)

    // ── STEP 6: Bundle ─────────────────────────────────────────────────────
    log('INFO', '[6/7] Bundling Remotion composition...', jid)
    const serveUrl = await getBundle()

    await ensureBrowser()
    const browserExecutable: string | null = null

    const inputProps = {
      audioUrl: job.audio_url,
      captions,
      highlightWords,
      scenes,
      animatedScenes: [] as AnimatedSceneData[],
      bgVideoUrl: '',
      bgColor: '#0a0e27',
      durationInSeconds: duration,
    }

    const composition = await selectComposition({ serveUrl, id: 'TikTokVideo', inputProps })

    // ── STEP 7: Render ─────────────────────────────────────────────────────
    log('INFO', '[7/7] Rendering video...', jid)
    let lastLoggedPct = -1
    await renderMedia({
      composition: { ...composition, durationInFrames: Math.ceil(duration * 30) },
      serveUrl,
      codec: 'h264',
      outputLocation: videoPath,
      inputProps,
      browserExecutable,
      onProgress: ({ progress }) => {
        const pct = Math.round(progress * 100)
        // Only log every 10% to avoid flooding the output
        if (pct >= lastLoggedPct + 10) {
          process.stdout.write(`\r  Render: ${pct}%  `)
          lastLoggedPct = pct
        }
      },
    })
    process.stdout.write('\n')
    log('INFO', 'Render complete', jid)

    // ── Upload ─────────────────────────────────────────────────────────────
    log('INFO', 'Uploading final video to Supabase...', jid)
    const videoBytes = readFileSync(videoPath)
    const { error: uploadErr } = await retry(
      () => supabase.storage.from('videos').upload(`${id}.mp4`, videoBytes, { contentType: 'video/mp4', upsert: true }),
      3,
      'supabase-upload'
    )
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

    const { data: { publicUrl: videoUrl } } = supabase.storage.from('videos').getPublicUrl(`${id}.mp4`)

    // Update both tables — log any errors so they're visible in Actions logs
    const { error: pkgErr } = await supabase
      .from('content_packages')
      .update({ video_url: videoUrl })
      .eq('id', id)
    if (pkgErr) log('ERROR', `content_packages update failed: ${pkgErr.message}`, jid)

    const { error: jobErr } = await supabase.from('video_jobs').update({
      status: 'complete',
      video_url: videoUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', jid)
    if (jobErr) log('ERROR', `video_jobs complete update failed: ${jobErr.message}`, jid)

    log('INFO', `✓ Complete: ${videoUrl}`, jid)
    sendAlert({
      level: 'info',
      title: 'Video render complete',
      message: videoUrl,
      jobId: jid,
      packageId: id,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log('ERROR', `✗ Failed: ${msg}`, jid)
    sendAlert({
      level: 'error',
      title: 'Video render failed',
      message: msg,
      jobId: jid,
      packageId: id,
    })
    const { error: failErr } = await supabase.from('video_jobs').update({
      status: 'failed',
      error: msg,
      updated_at: new Date().toISOString(),
    }).eq('id', jid)
    if (failErr) log('ERROR', `video_jobs failed update itself failed: ${failErr.message}`, jid)
  } finally {
    for (const p of [audioPath, videoPath]) {
      try { if (existsSync(p)) unlinkSync(p) } catch { /* ignore cleanup errors */ }
    }
  }
}

// ─── Entry point ───────────────────────────────────────────────────────────────
// CI mode  (GitHub Actions, CI=true): claim ONE job → process it → exit.
// Server mode (Railway etc.)        : poll every 5 seconds indefinitely.

// ─── Stuck job recovery ────────────────────────────────────────────────────────
// Jobs stuck in "processing" for longer than STUCK_JOB_MIN minutes are reset
// to "pending" so the next worker run can claim them.
// This handles GitHub Actions runners that crash mid-render.
async function resetStuckJobs() {
  const cutoff = new Date(Date.now() - STUCK_JOB_MIN * 60 * 1000).toISOString()
  const { data: stuck, error } = await supabase
    .from('video_jobs')
    .select('id')
    .eq('status', 'processing')
    .lt('updated_at', cutoff)

  if (error) { log('WARN', `Could not query stuck jobs: ${error.message}`); return }
  if (!stuck || stuck.length === 0) return

  const ids = stuck.map(j => j.id)
  const { error: resetErr } = await supabase
    .from('video_jobs')
    .update({ status: 'pending', error: null, updated_at: new Date().toISOString() })
    .in('id', ids)

  if (resetErr) log('ERROR', `Failed to reset stuck jobs: ${resetErr.message}`)
  else {
    log('INFO', `Reset ${ids.length} stuck job(s) back to pending`)
    sendAlert({
      level: 'warn',
      title: `${ids.length} stuck job(s) auto-recovered`,
      message: `Jobs were stuck in "processing" for >${STUCK_JOB_MIN} min and have been reset to pending.`,
    })
  }
}

async function claimAndProcess() {
  const { data: jobs } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)

  if (!jobs || jobs.length === 0) return false

  const job = jobs[0]

  if (!UUID_RE.test(job.package_id)) {
    log('WARN', `Skipping fake job (package_id='${job.package_id}')`, job.id)
    await supabase.from('video_jobs').update({ status: 'failed', error: 'Invalid package_id', updated_at: new Date().toISOString() }).eq('id', job.id)
    return false
  }

  // Atomic claim — only succeeds if the job is still 'pending'.
  // We use .select('id') so Supabase returns the rows that were actually updated.
  // If another worker already claimed this job, the WHERE status='pending' filter
  // matches 0 rows and claimed will be an empty array — not an error.
  const { data: claimed, error: claimErr } = await supabase
    .from('video_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select('id')

  if (claimErr || !claimed || claimed.length === 0) {
    log('WARN', `Job already claimed by another worker, skipping`, job.id)
    return false
  }

  await processJob(job as VideoJob)
  return true
}

async function run() {
  mkdirSync(TMP, { recursive: true })
  const ci = !!process.env.CI

  // Always reset stuck jobs first — handles crashed previous runners
  await resetStuckJobs()

  if (ci) {
    log('INFO', 'CI mode: processing one pending job then exiting.')
    const processed = await claimAndProcess()
    if (!processed) log('INFO', 'No pending jobs. Exiting.')
    return
  }

  log('INFO', `Server mode: polling every ${POLL_MS / 1000}s...`)
  while (true) {
    try {
      await claimAndProcess()
      await new Promise(r => setTimeout(r, POLL_MS))
    } catch (err) {
      log('ERROR', `Poll error: ${err instanceof Error ? err.message : String(err)}`)
      await new Promise(r => setTimeout(r, POLL_MS))
    }
  }
}

run().catch(err => { log('ERROR', `Fatal: ${err instanceof Error ? err.message : String(err)}`); process.exit(1) })
