import { NextResponse } from 'next/server'

// TikTok domain verification file endpoint.
// Set TIKTOK_SITE_VERIFICATION in Vercel env vars to the token TikTok provides.
export async function GET() {
  const token = process.env.TIKTOK_SITE_VERIFICATION
  if (!token) {
    return new NextResponse('', { status: 404 })
  }
  return new NextResponse(`tiktok-developers-site-verification=${token}`, {
    headers: { 'Content-Type': 'text/plain' },
  })
}
