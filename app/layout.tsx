import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Stacks Made Simple — AI Video Creator',
  description: 'AI-powered short-form video creation for TikTok and beyond. Generate scripts, voiceovers, and videos in minutes — for any niche.',
  metadataBase: new URL('https://stacksmadesimple.xyz'),
  openGraph: {
    title: 'Stacks Made Simple',
    description: 'AI-powered short-form video creation for TikTok and beyond.',
    url: 'https://stacksmadesimple.xyz',
    siteName: 'Stacks Made Simple',
    type: 'website',
  },
  // TikTok domain verification — set TIKTOK_SITE_VERIFICATION in Vercel env vars
  // once TikTok provides your verification token in the developer portal
  ...(process.env.TIKTOK_SITE_VERIFICATION
    ? {
        other: {
          'tiktok-developers-site-verification': process.env.TIKTOK_SITE_VERIFICATION,
        },
      }
    : {}),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
