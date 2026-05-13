import { NextRequest, NextResponse } from 'next/server'
import { fetchVoices, selectVoice, buildFallback } from '@/lib/voiceSelector'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let voices: Awaited<ReturnType<typeof fetchVoices>> = []

  try {
    const { script, niche, tone } = await req.json() as {
      script: string
      niche: string
      tone?: string
    }

    if (!script?.trim() || !niche?.trim()) {
      return NextResponse.json({ error: 'Missing script or niche' }, { status: 400 })
    }

    const elevenKey   = process.env.ELEVENLABS_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    if (!elevenKey || !anthropicKey) {
      return NextResponse.json({ error: 'Missing API keys' }, { status: 500 })
    }

    // Fetch available voices — if this fails, fall back below
    try {
      voices = await fetchVoices(elevenKey)
    } catch (err) {
      console.warn('[select-voice] Could not fetch voices:', err)
    }

    if (!voices.length) {
      return NextResponse.json(buildFallback([], process.env.ELEVENLABS_VOICE_ID))
    }

    // Ask Claude to pick the best voice
    try {
      const selection = await selectVoice(script, niche, tone ?? '', voices, anthropicKey)
      return NextResponse.json(selection)
    } catch (err) {
      console.warn('[select-voice] Claude selection failed, using fallback:', err)
      return NextResponse.json(buildFallback(voices, process.env.ELEVENLABS_VOICE_ID))
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Voice selection failed'
    console.error('[select-voice] Unexpected error:', msg)
    // Always return a usable fallback — never block the generation flow
    return NextResponse.json(buildFallback(voices, process.env.ELEVENLABS_VOICE_ID))
  }
}
