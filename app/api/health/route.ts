import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    const [pendingRes, processingRes, failedRes, completedRes] = await Promise.all([
      supabase.from('video_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('video_jobs').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('video_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase
        .from('video_jobs')
        .select('updated_at')
        .eq('status', 'done')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    // Stuck = processing and not updated in the last 20 min
    const stuckCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString()
    const stuckRes = await supabase
      .from('video_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'processing')
      .lt('updated_at', stuckCutoff)

    return NextResponse.json({
      status: 'ok',
      queue: {
        pending:    pendingRes.count ?? 0,
        processing: processingRes.count ?? 0,
        failed:     failedRes.count ?? 0,
        stuck:      stuckRes.count ?? 0,
      },
      last_completed_at: completedRes.data?.updated_at ?? null,
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Health check failed'
    return NextResponse.json({ status: 'error', error: msg }, { status: 500 })
  }
}
