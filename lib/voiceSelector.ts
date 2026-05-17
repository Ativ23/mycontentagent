import Anthropic from '@anthropic-ai/sdk'

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
  labels?: Record<string, string>
  description?: string
  preview_url?: string
}

export interface VoiceSettings {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

export interface VoiceSelection {
  selectedVoiceId: string
  selectedVoiceName: string
  reason: string
  voiceSettings: VoiceSettings
}

const FALLBACK_SETTINGS: VoiceSettings = {
  stability: 0.55,
  similarity_boost: 0.75,
  style: 0.45,
  use_speaker_boost: true,
}

export async function fetchVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) throw new Error(`ElevenLabs voices fetch failed: ${res.status}`)
  const data = await res.json() as { voices: ElevenLabsVoice[] }
  return data.voices ?? []
}

export async function selectVoice(
  script: string,
  niche: string,
  tone: string,
  voices: ElevenLabsVoice[],
  anthropicApiKey: string,
): Promise<VoiceSelection> {
  const client = new Anthropic({ apiKey: anthropicApiKey })

  // Build a compact voice list for the prompt — only what Claude needs
  const voiceList = voices.map(v => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels ?? {},
    description: v.description ?? '',
  }))

  // Only show premade/professional voices — clutter-free, higher quality pool
  const filteredList = voiceList.filter(v =>
    v.category === 'premade' || v.category === 'professional' || v.category === 'cloned'
  )
  const castingPool = (filteredList.length >= 4 ? filteredList : voiceList).slice(0, 30)

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `You are a senior TikTok content producer casting the voice for a short-form video. You have cast hundreds of viral videos and know exactly which voice energy drives retention and shares.

SCRIPT (read every word — the voice must match the energy of this exact copy):
${script}

NICHE: ${niche}
TONE: ${tone}

CASTING CRITERIA — in priority order:
1. ENERGY MATCH: The hook (first 3 seconds) must feel native to this niche. Finance = calm authority. Fitness = intense urgency. Relationships = emotional rawness. Beauty = warm confidence. Tech = sharp curiosity.
2. GENDER & AGE FIT: Match the voice demographic to the target audience. Finance/Tech → male or neutral authority works. Beauty/Relationships → female or warm male works.
3. AVOID: robotic, over-produced, or "text-to-speech sounding" voices. Choose the most human-sounding option.
4. SETTINGS: Dial for maximum naturalness. Low stability = expressive but inconsistent. High style = character but can sound performative.

AVAILABLE VOICES:
${JSON.stringify(castingPool, null, 2)}

Respond ONLY with valid JSON, no other text:
{
  "selectedVoiceId": "<exact id from list>",
  "selectedVoiceName": "<exact name from list>",
  "reason": "<one sentence: what specifically about this voice fits this script>",
  "voiceSettings": {
    "stability": <0.0-1.0>,
    "similarity_boost": <0.75-0.92>,
    "style": <0.0-1.0>,
    "use_speaker_boost": true
  }
}`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  // Extract JSON even if Claude wraps it in markdown fences
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON in Claude response: ${text.slice(0, 200)}`)

  const selection = JSON.parse(jsonMatch[0]) as VoiceSelection

  // Validate the selected ID actually exists in our voice list
  const voiceExists = voices.some(v => v.voice_id === selection.selectedVoiceId)
  if (!voiceExists) {
    throw new Error(`Claude chose unknown voice ID: ${selection.selectedVoiceId}`)
  }

  // Clamp settings to valid range just in case
  const s = selection.voiceSettings
  selection.voiceSettings = {
    stability:        Math.max(0, Math.min(1, s.stability ?? FALLBACK_SETTINGS.stability)),
    similarity_boost: Math.max(0, Math.min(1, s.similarity_boost ?? FALLBACK_SETTINGS.similarity_boost)),
    style:            Math.max(0, Math.min(1, s.style ?? FALLBACK_SETTINGS.style)),
    use_speaker_boost: s.use_speaker_boost ?? true,
  }

  return selection
}

// Build a fallback selection using the first available voice
export function buildFallback(voices: ElevenLabsVoice[], envVoiceId?: string): VoiceSelection {
  const fallbackVoice =
    voices.find(v => v.voice_id === envVoiceId) ??
    voices.find(v => v.category === 'premade') ??
    voices[0]

  return {
    selectedVoiceId: fallbackVoice?.voice_id ?? '',
    selectedVoiceName: fallbackVoice?.name ?? 'Default',
    reason: 'Using default voice — auto-selection unavailable.',
    voiceSettings: FALLBACK_SETTINGS,
  }
}
