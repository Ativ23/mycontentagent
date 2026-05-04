import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
  }

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 502 })
  }

  const { voices } = await res.json()

  const list = (voices as { voice_id: string; name: string; category: string; preview_url: string }[])
    .map(({ voice_id, name, category, preview_url }) => ({ voice_id, name, category, preview_url }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ voices: list })
}
