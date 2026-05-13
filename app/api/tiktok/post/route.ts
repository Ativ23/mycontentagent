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

  if (new Date(data.expires_at).getTime() - Date.now() > 5 * 60 * 1000) {
    return data.access_token
  }

  // Refresh the token
  const refreshRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key:    process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type:    'refresh_token',
      refresh_token: data.refresh_token,
    }),
  })

  if (!refreshRes.ok) {
    console.error('[tiktok/post] Token refresh failed:', await refreshRes.text())
    return null
  }

  const refreshData = await refreshRes.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
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
  try {
    const { videoUrl, caption } = await req.json() as { videoUrl: string; caption?: string }

    if (!videoUrl) {
      return NextResponse.json({ error: 'Missing videoUrl' }, { status: 400 })
    }

    // Verify the URL is a valid Supabase storage URL so we don't pull arbitrary URLs
    if (!videoUrl.includes('supabase.co/storage')) {
      return NextResponse.json({ error: 'videoUrl must be a Supabase storage URL' }, { status: 400 })
    }

    const accessToken = await getValidAccessToken()
    if (!accessToken) {
      return NextResponse.json(
        { error: 'TikTok not connected. Connect your account in Settings.' },
        { status: 401 }
      )
    }

    // Use PULL_FROM_URL — TikTok fetches the video directly from Supabase.
    // This avoids downloading the entire video into Vercel function memory (OOM risk).
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        source_info: {
          source:    'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }),
    })

    if (!initRes.ok) {
      const errText = await initRes.text()
      console.error('[tiktok/post] Init failed:', errText)
      // Fall back to FILE_UPLOAD path if PULL_FROM_URL is not supported on this account
      if (initRes.status === 400 || initRes.status === 422) {
        return await fileUploadFallback(accessToken, videoUrl)
      }
      return NextResponse.json({ error: `TikTok upload init failed: ${errText}` }, { status: 502 })
    }

    const initData = await initRes.json() as { error?: { code?: string; message?: string }; data?: { publish_id?: string } }
    if (initData.error?.code && initData.error.code !== 'ok') {
      // Try file upload fallback if pull not allowed
      if (initData.error.code === 'access_token_invalid' || initData.error.code === 'spam_risk_too_many_requests') {
        return NextResponse.json({ error: `TikTok error: ${initData.error.message}` }, { status: 429 })
      }
      return await fileUploadFallback(accessToken, videoUrl)
    }

    const publish_id = initData.data?.publish_id
    console.log('[tiktok/post] Queued via PULL_FROM_URL, publish_id:', publish_id)
    return NextResponse.json({ success: true, publish_id, method: 'pull' })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'TikTok post failed'
    console.error('[tiktok/post] Unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// FILE_UPLOAD fallback — only used if PULL_FROM_URL is rejected.
// Downloads the video and streams it to TikTok's CDN.
// Guarded by a size check to avoid OOM on large files.
async function fileUploadFallback(accessToken: string, videoUrl: string): Promise<Response> {
  const MAX_BYTES = 60 * 1024 * 1024 // 60 MB hard limit

  // HEAD check first so we know the size without downloading
  const head = await fetch(videoUrl, { method: 'HEAD' })
  const contentLength = Number(head.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `Video is ${Math.round(contentLength / 1024 / 1024)}MB — too large for direct upload. Max 60MB.` },
      { status: 413 }
    )
  }

  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) {
    return NextResponse.json({ error: `Failed to download video: HTTP ${videoRes.status}` }, { status: 500 })
  }
  const videoArrayBuffer = await videoRes.arrayBuffer()
  const videoSize = videoArrayBuffer.byteLength

  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      source_info: { source: 'FILE_UPLOAD', video_size: videoSize, chunk_size: videoSize, total_chunk_count: 1 },
    }),
  })

  if (!initRes.ok) {
    const t = await initRes.text()
    return NextResponse.json({ error: `TikTok FILE_UPLOAD init failed: ${t}` }, { status: 502 })
  }

  const initData = await initRes.json() as { error?: { code?: string; message?: string }; data?: { publish_id?: string; upload_url?: string } }
  if (initData.error?.code && initData.error.code !== 'ok') {
    return NextResponse.json({ error: `TikTok error: ${initData.error.message}` }, { status: 502 })
  }

  const { publish_id, upload_url } = initData.data ?? {}
  if (!upload_url) {
    return NextResponse.json({ error: 'TikTok did not return upload_url' }, { status: 502 })
  }

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
    return NextResponse.json({ error: `Video chunk upload failed (${uploadRes.status}): ${errText}` }, { status: 502 })
  }

  console.log('[tiktok/post] Uploaded via FILE_UPLOAD fallback, publish_id:', publish_id)
  return NextResponse.json({ success: true, publish_id, method: 'upload' })
}
