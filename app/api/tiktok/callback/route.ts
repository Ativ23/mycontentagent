import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/settings?tiktok_error=${encodeURIComponent(error)}`
    )
  }

  const savedState = req.cookies.get('tiktok_oauth_state')?.value
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=invalid_state`)
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=no_code`)
  }

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${appUrl}/api/tiktok/callback`,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('[tiktok/callback] Token exchange failed:', errText)
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=token_exchange_failed`)
  }

  const tokenData = await tokenRes.json()
  const { access_token, refresh_token, open_id, expires_in } = tokenData

  if (!access_token) {
    console.error('[tiktok/callback] No access_token in response:', tokenData)
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=no_access_token`)
  }

  const supabase = getSupabaseAdmin()
  const expiresAt = new Date(Date.now() + (expires_in ?? 86400) * 1000).toISOString()

  const { error: upsertError } = await supabase
    .from('tiktok_tokens')
    .upsert(
      { user_id: 'default', access_token, refresh_token, open_id, expires_at: expiresAt },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    console.error('[tiktok/callback] DB upsert failed:', upsertError.message)
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=db_error`)
  }

  const response = NextResponse.redirect(`${appUrl}/settings?tiktok_connected=1`)
  response.cookies.delete('tiktok_oauth_state')
  return response
}
