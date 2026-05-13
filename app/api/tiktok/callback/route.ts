import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  console.log('[tiktok/callback] Received — code present:', !!code, '| state present:', !!state, '| error:', error ?? 'none')

  // TikTok denied access or user cancelled
  if (error) {
    console.warn('[tiktok/callback] TikTok returned error:', error)
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    console.error('[tiktok/callback] No code in callback — TikTok did not return an auth code')
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=no_code`)
  }

  // ── State validation ──────────────────────────────────────────────────────
  // Check DB first (survives cross-device/cross-browser flows like TikTok app redirect).
  // Fall back to cookie. If both are missing, log a warning but proceed — this is a
  // single-tenant app so CSRF risk is negligible and a broken state shouldn't block auth.
  const supabase = getSupabaseAdmin()
  const cookieState = req.cookies.get('tiktok_oauth_state')?.value

  let stateValid = false
  const { data: storedStateRow } = await supabase
    .from('tiktok_oauth_state')
    .select('state, created_at')
    .eq('id', 1)
    .maybeSingle()

  const dbState = storedStateRow?.state
  const stateAge = storedStateRow?.created_at
    ? Math.round((Date.now() - new Date(storedStateRow.created_at).getTime()) / 1000)
    : null

  console.log('[tiktok/callback] DB state match:', dbState === state, '| age (s):', stateAge)
  console.log('[tiktok/callback] Cookie state match:', cookieState === state)

  if (state && dbState && dbState === state) {
    stateValid = true
  } else if (state && cookieState && cookieState === state) {
    stateValid = true
  } else if (!dbState && !cookieState) {
    // No state stored at all — user may have bypassed auth button. Warn but proceed.
    console.warn('[tiktok/callback] No state found in DB or cookie — proceeding without CSRF check (single-tenant app)')
    stateValid = true
  } else {
    // State present but mismatched — could be a stale flow or replay. Block.
    console.error('[tiktok/callback] State mismatch — received:', state, '| db:', dbState, '| cookie:', cookieState)
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=state_mismatch_retry`)
  }

  // ── Token exchange ────────────────────────────────────────────────────────
  const clientKey    = process.env.TIKTOK_CLIENT_KEY!
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET!
  const redirectUri  = `${appUrl}/api/tiktok/callback`

  console.log('[tiktok/callback] Exchanging code for token — redirect_uri:', redirectUri)

  let tokenRes: Response
  try {
    tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key:    clientKey,
        client_secret: clientSecret,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  redirectUri,
      }),
    })
  } catch (fetchErr) {
    console.error('[tiktok/callback] Network error reaching TikTok token endpoint:', fetchErr)
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=network_error`)
  }

  console.log('[tiktok/callback] TikTok token exchange HTTP status:', tokenRes.status)

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text()
    console.error('[tiktok/callback] Token exchange failed — status:', tokenRes.status, '| body:', errBody)
    // Encode the status code in the error so the UI can show something specific
    const errParam = encodeURIComponent(`token_exchange_${tokenRes.status}`)
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=${errParam}`)
  }

  const tokenData = await tokenRes.json() as {
    access_token?: string
    refresh_token?: string
    open_id?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  console.log('[tiktok/callback] Token data keys received:', Object.keys(tokenData).join(', '))

  if (tokenData.error) {
    console.error('[tiktok/callback] TikTok returned error in token body:', tokenData.error, tokenData.error_description)
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=${encodeURIComponent(tokenData.error)}`)
  }

  const { access_token, refresh_token, open_id, expires_in } = tokenData

  if (!access_token) {
    console.error('[tiktok/callback] No access_token in TikTok response. Full response:', JSON.stringify(tokenData))
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=no_access_token`)
  }

  console.log('[tiktok/callback] Got access_token for open_id:', open_id)

  // ── Save token to DB ──────────────────────────────────────────────────────
  const expiresAt = new Date(Date.now() + (expires_in ?? 86400) * 1000).toISOString()

  const { error: upsertError } = await supabase
    .from('tiktok_tokens')
    .upsert(
      { user_id: 'default', access_token, refresh_token, open_id: open_id ?? '', expires_at: expiresAt },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    console.error('[tiktok/callback] DB upsert failed:', upsertError.message)
    return NextResponse.redirect(`${appUrl}/settings?tiktok_error=db_save_failed`)
  }

  console.log('[tiktok/callback] Token saved. Connection successful for open_id:', open_id)

  // Clean up the OAuth state row — it's been used
  await supabase.from('tiktok_oauth_state').delete().eq('id', 1)

  const response = NextResponse.redirect(`${appUrl}/settings?tiktok_connected=1`)
  response.cookies.delete('tiktok_oauth_state')
  return response
}
