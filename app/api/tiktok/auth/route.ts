import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!clientKey || !appUrl) {
    return NextResponse.json({ error: 'TikTok credentials not configured' }, { status: 500 })
  }

  const state = crypto.randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: 'video.upload',
    response_type: 'code',
    redirect_uri: `${appUrl}/api/tiktok/callback`,
    state,
  })

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('tiktok_oauth_state', state, {
    httpOnly: true,
    secure: false,
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  })

  return response
}
