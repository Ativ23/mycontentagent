import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

function prepareForTTS(text: string): string {
  return text
    // Money with K/M suffix: $10K → 10 thousand dollars, $2M → 2 million dollars
    .replace(/\$(\d+(?:\.\d+)?)\s*[Kk]\b/g, (_, n) => `${n} thousand dollars`)
    .replace(/\$(\d+(?:\.\d+)?)\s*[Mm]\b/g, (_, n) => `${n} million dollars`)
    // Plain dollar amounts: $1,500 → 15 hundred dollars, $500 → 500 dollars
    .replace(/\$(\d{1,3}(?:,\d{3})+)/g, (_, n) => `${n.replace(/,/g, '')} dollars`)
    .replace(/\$(\d+(?:\.\d+)?)/g, (_, n) => `${n} dollars`)
    // Standalone number suffixes: 10K → 10 thousand, 5M → 5 million
    .replace(/\b(\d+(?:\.\d+)?)[Kk]\b/g, (_, n) => `${n} thousand`)
    .replace(/\b(\d+(?:\.\d+)?)[Mm]\b(?!s\b)/g, (_, n) => `${n} million`)
    // Percentages: 80% → 80 percent
    .replace(/(\d+(?:\.\d+)?)\s*%/g, (_, n) => `${n} percent`)
    // Abbreviations that TTS stumbles on — add periods so it spells them out
    .replace(/\bAI\b/g, 'A.I.')
    .replace(/\bDMs?\b/g, (m) => m === 'DMs' ? 'D.M.s' : 'D.M.')
    .replace(/\bCTA\b/g, 'call to action')
    .replace(/\bROI\b/g, 'R.O.I.')
    .replace(/\bSEO\b/g, 'S.E.O.')
    .replace(/\bURL\b/g, 'U.R.L.')
    .replace(/\bQ&A\b/gi, 'Q and A')
    // Symbols
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/\//g, ' or ')
    // Hashtags: #fitness → fitness
    .replace(/#(\w+)/g, '$1')
    // Punctuation that causes unnatural pauses or silence
    .replace(/—/g, ', ')
    .replace(/–/g, ', ')
    .replace(/\.\.\./g, ', ')
    // Remove any leftover URLs
    .replace(/https?:\/\/\S+/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

interface WordTiming { word: string; start: number; end: number }

function extractWordTimings(
  characters: string[],
  startTimes: number[],
  endTimes: number[],
): WordTiming[] {
  const words: WordTiming[] = []
  let currentWord = ''
  let wordStart = 0

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]
    const isBreak = char === ' ' || char === '\n'
    const isLast = i === characters.length - 1

    if (isBreak || isLast) {
      if (!isBreak) currentWord += char
      const trimmed = currentWord.trim()
      if (trimmed) {
        words.push({
          word: trimmed,
          start: wordStart,
          end: endTimes[isBreak ? i - 1 : i] ?? endTimes[i],
        })
      }
      currentWord = ''
      wordStart = startTimes[i + 1] ?? endTimes[i]
    } else {
      if (!currentWord) wordStart = startTimes[i]
      currentWord += char
    }
  }
  return words
}

export async function POST(req: NextRequest) {
  try {
    return await handleVoiceover(req)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Voiceover generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Voice settings tuned per niche.
// stability: 0 = expressive/varied, 1 = consistent/flat
// style: 0 = neutral, 1 = maximum character/emotion
// similarity_boost: how closely to stick to the voice's original character
const NICHE_VOICE_SETTINGS: Record<string, { stability: number; similarity_boost: number; style: number }> = {
  'Fitness & Health':   { stability: 0.30, similarity_boost: 0.85, style: 0.75 }, // aggressive, punchy, high energy
  'Personal Finance':   { stability: 0.70, similarity_boost: 0.85, style: 0.25 }, // calm, authoritative, trustworthy
  'Tech & Gadgets':     { stability: 0.55, similarity_boost: 0.80, style: 0.45 }, // sharp, curious, informative
  'Beauty & Skincare':  { stability: 0.60, similarity_boost: 0.80, style: 0.50 }, // warm, friendly, smooth
  'Fashion & Style':    { stability: 0.40, similarity_boost: 0.85, style: 0.65 }, // vibrant, confident, trendy
  'Food & Recipes':     { stability: 0.50, similarity_boost: 0.80, style: 0.55 }, // enthusiastic, appetizing
  'Relationships':      { stability: 0.45, similarity_boost: 0.85, style: 0.60 }, // emotional, relatable, warm
  'Home & Kitchen':     { stability: 0.60, similarity_boost: 0.80, style: 0.40 }, // helpful, clear, friendly
  'Pet Content':        { stability: 0.50, similarity_boost: 0.80, style: 0.60 }, // excited, warm, playful
  'Digital Products':   { stability: 0.65, similarity_boost: 0.80, style: 0.35 }, // confident, results-focused
}
const DEFAULT_VOICE_SETTINGS = { stability: 0.50, similarity_boost: 0.75, style: 0.45 }

async function handleVoiceover(req: NextRequest) {
  const { packageId, script, voiceId } = await req.json()

  if (!packageId || !script) {
    return NextResponse.json({ error: 'Missing packageId or script' }, { status: 400 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ELEVENLABS_API_KEY is not configured in .env.local' },
      { status: 500 }
    )
  }

  let voice = voiceId || process.env.ELEVENLABS_VOICE_ID
  if (!voice) {
    const voicesRes = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    })
    if (voicesRes.ok) {
      const { voices } = await voicesRes.json()
      voice = voices?.[0]?.voice_id
    }
  }
  if (!voice) {
    return NextResponse.json({ error: 'No voice available. Set ELEVENLABS_VOICE_ID in .env.local.' }, { status: 500 })
  }

  // Look up the niche from content_packages so we can tune voice settings.
  // The frontend doesn't pass niche directly — we fetch it from the database.
  const supabase = getSupabaseAdmin()
  let niche = ''
  try {
    const { data: pkg } = await supabase
      .from('content_packages').select('niche').eq('id', packageId).single()
    niche = pkg?.niche ?? ''
  } catch { /* non-fatal */ }

  const voiceSettings = NICHE_VOICE_SETTINGS[niche] ?? DEFAULT_VOICE_SETTINGS

  let elevenRes: Response
  try {
    // /with-timestamps returns JSON: { audio_base64, alignment: { characters, character_start_times_seconds, character_end_times_seconds } }
    elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prepareForTTS(script),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: voiceSettings,
      }),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach ElevenLabs API' }, { status: 502 })
  }

  if (!elevenRes.ok) {
    const errText = await elevenRes.text()
    return NextResponse.json({ error: `ElevenLabs error: ${errText}` }, { status: 502 })
  }

  const ttsData = await elevenRes.json() as {
    audio_base64: string
    alignment: {
      characters: string[]
      character_start_times_seconds: number[]
      character_end_times_seconds: number[]
    }
  }

  const audioBuffer = Buffer.from(ttsData.audio_base64, 'base64')

  // Extract word-level timestamps and store alongside the audio
  const wordTimings = extractWordTimings(
    ttsData.alignment.characters,
    ttsData.alignment.character_start_times_seconds,
    ttsData.alignment.character_end_times_seconds,
  )

  const audioFileName = `${packageId}.mp3`
  const timingsFileName = `${packageId}_timestamps.json`

  const [audioUpload, timingsUpload] = await Promise.all([
    supabase.storage.from('voiceovers').upload(audioFileName, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    }),
    supabase.storage.from('voiceovers').upload(
      timingsFileName,
      Buffer.from(JSON.stringify(wordTimings)),
      { contentType: 'application/json', upsert: true },
    ),
  ])

  if (audioUpload.error) {
    return NextResponse.json(
      { error: `Audio upload failed: ${audioUpload.error.message}` },
      { status: 500 },
    )
  }
  if (timingsUpload.error) {
    console.warn('[voiceover] Timestamps upload failed:', timingsUpload.error.message)
    // Non-fatal — video generation falls back to equal distribution
  }

  const { data: { publicUrl } } = supabase.storage.from('voiceovers').getPublicUrl(audioFileName)

  const { error: updateError } = await supabase
    .from('content_packages')
    .update({ audio_url: publicUrl })
    .eq('id', packageId)

  if (updateError) {
    return NextResponse.json(
      { error: `DB update failed: ${updateError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ audioUrl: publicUrl })
}
