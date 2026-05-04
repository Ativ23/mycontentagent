import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

async function getValidAccessToken(): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tiktok_tokens')
    .select('*')
    .eq('user_id', 'default')
    .single()

  if (error || !data) return null

  // Return existing token if it has more than 5 minutes remaining
  if (new Date(data.expires_at).getTime() - Date.now() > 5 * 60 * 1000) {
    return data.access_token
  }

  // Refresh the token
  const refreshRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
    }),
  })

  if (!refreshRes.ok) return null

  const refreshData = await refreshRes.json()
  const { access_token, refresh_token, expires_in } = refreshData
  if (!access_token) return null

  const newExpiresAt = new Date(Date.now() + (expires_in ?? 86400) * 1000).toISOString()
  await supabase
    .from('tiktok_tokens')
    .update({ access_token, refresh_token, expires_at: newExpiresAt })
    .eq('user_id', 'default')

  return access_token
}

export async function POST(req: NextRequest) {
  const { videoUrl } = await req.json()

  if (!videoUrl) {
    return NextResponse.json({ error: 'Missing videoUrl' }, { status: 400 })
  }

  const accessToken = await getValidAccessToken()
  if (!accessToken) {
    return NextResponse.json(
      { error: 'TikTok not connected. Connect your account in Settings first.' },
      { status: 401 }
    )
  }

  // Download video from Supabase storage
  let videoArrayBuffer: ArrayBuffer
  try {
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`HTTP ${videoRes.status}`)
    videoArrayBuffer = await videoRes.arrayBuffer()
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `Failed to download video: ${e instanceof Error ? e.message : 'unknown'}` },
      { status: 500 }
    )
  }

  const videoSize = videoArrayBuffer.byteLength
  // TikTok max chunk size is 64MB; use a single chunk for typical TikTok videos (<100MB)
  const chunkSize = videoSize
  const totalChunkCount = 1

  // Step 1: Initialize the inbox upload
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount,
      },
    }),
  })

  if (!initRes.ok) {
    const errText = await initRes.text()
    console.error('[tiktok/post] Init failed:', errText)
    return NextResponse.json({ error: `TikTok upload init failed: ${errText}` }, { status: 502 })
  }

  const initData = await initRes.json()
  if (initData.error?.code !== 'ok') {
    return NextResponse.json(
      { error: `TikTok init error: ${initData.error?.message ?? 'unknown'}` },
      { status: 502 }
    )
  }

  const { publish_id, upload_url } = initData.data

  // Step 2: Upload the video as a single chunk
  const uploadRes = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      'Content-Length': String(videoSize),
      'Content-Type': 'video/mp4',
    },
    body: videoArrayBuffer,
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    console.error('[tiktok/post] Upload failed:', uploadRes.status, errText)
    return NextResponse.json(
      { error: `Video upload failed (${uploadRes.status}): ${errText}` },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true, publish_id })
}
