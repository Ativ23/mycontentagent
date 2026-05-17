import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data: job, error } = await supabase
    .from('video_jobs')
    .select('status, video_url, error, user_id')
    .eq('id', jobId)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  // Confirm this job belongs to the requesting user
  if (job.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({
    status: job.status,
    videoUrl: job.video_url ?? null,
    error: job.error ?? null,
  })
}
