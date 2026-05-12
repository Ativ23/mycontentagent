import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    let packageId: string, script: string, audioUrl: string, bgVideoUrl: string | undefined
    try {
      const parsed = JSON.parse(body)
      ;({ packageId, script, audioUrl, bgVideoUrl } = parsed)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!packageId || !script || !audioUrl) {
      return NextResponse.json({ error: 'Missing packageId, script, or audioUrl' }, { status: 400 })
    }

    // Reject obviously fake/test requests — packageId must be a real UUID
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(packageId)) {
      return NextResponse.json({ error: 'Invalid packageId' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: job, error } = await supabase
      .from('video_jobs')
      .insert({
        package_id: packageId,
        script,
        audio_url: audioUrl,
        bg_video_url: bgVideoUrl ?? null,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Failed to queue job: ${error.message}`)

    return NextResponse.json({ jobId: job.id, status: 'pending' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to queue video job'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
