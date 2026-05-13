import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL

  console.log('[tiktok/auth] client_key present:', !!clientKey)
  console.log('[tiktok/auth] app_url:', appUrl)

  if (!clientKey) {
    return NextResponse.json({ error: 'TIKTOK_CLIENT_KEY is not set in environment variables' }, { status: 500 })
  }
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not set in environment variables' }, { status: 500 })
  }

  const redirectUri = `${appUrl}/api/tiktok/callback`
  const state = crypto.randomBytes(16).toString('hex')

  console.log('[tiktok/auth] redirect_uri:', redirectUri)
  console.log('[tiktok/auth] state generated (first 8):', state.slice(0, 8))

  // Store state server-side so it survives cross-browser/cross-device OAuth flows.
  // The cookie is a second layer; the DB is the reliable one.
  const supabase = getSupabaseAdmin()
  const { error: stateErr } = await supabase
    .from('tiktok_oauth_state')
    .upsert({ id: 1, state, created_at: new Date().toISOString() })

  if (stateErr) {
    console.error('[tiktok/auth] Failed to store state in DB:', stateErr.message)
    return NextResponse.json({ error: 'Failed to initialize OAuth state' }, { status: 500 })
  }

  const params = new URLSearchParams({
    client_key:    clientKey,
    scope:         'video.upload',
    response_type: 'code',
    redirect_uri:  redirectUri,
    state,
  })

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
  console.log('[tiktok/auth] Redirecting to TikTok auth URL (first 80 chars):', authUrl.slice(0, 80))

  const response = NextResponse.redirect(authUrl)
  // Cookie is a belt-and-suspenders fallback — DB is the primary state store
  response.cookies.set('tiktok_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.VERCEL_ENV === 'production',
    maxAge:   600,
    path:     '/',
    sameSite: 'lax',
  })

  return response
}
