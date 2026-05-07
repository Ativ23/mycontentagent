import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data: job, error } = await supabase
    .from('video_jobs')
    .select('status, video_url, error')
    .eq('id', jobId)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  return NextResponse.json({
    status: job.status,
    videoUrl: job.video_url ?? null,
    error: job.error ?? null,
  })
}
