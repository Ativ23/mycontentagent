import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { execFileSync } from 'child_process'
import ffmpegStaticPath from 'ffmpeg-static'

export const runtime = 'nodejs'

export async function GET() {
  const path = ffmpegStaticPath ? String(ffmpegStaticPath) : null
  const exists = path ? existsSync(path) : false
  let version = 'not run'
  if (path && exists) {
    try {
      version = execFileSync(path, ['-version'], { timeout: 5000 }).toString().split('\n')[0]
    } catch (e: unknown) {
      version = `error: ${e instanceof Error ? e.message : String(e)}`
    }
  }
  return NextResponse.json({ path, exists, version, vercel: !!process.env.VERCEL })
}
