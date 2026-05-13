import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const stuckCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString()

    const [pendingRes, processingRes, failedRes, completedRes, recentFailedRes, tiktokRes, stuckRes] = await Promise.all([
      supabase.from('video_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('video_jobs').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('video_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('video_jobs').select('package_id,updated_at').eq('status', 'complete')
        .order('updated_at', { ascending: false }).limit(5),
      supabase.from('video_jobs').select('id,package_id,error,updated_at').eq('status', 'failed')
        .order('updated_at', { ascending: false }).limit(5),
      supabase.from('tiktok_tokens').select('open_id,expires_at').eq('user_id', 'default').maybeSingle(),
      supabase.from('video_jobs').select('id', { count: 'exact', head: true })
        .eq('status', 'processing').lt('updated_at', stuckCutoff),
    ])

    const tiktokConnected = !!tiktokRes.data && new Date(tiktokRes.data.expires_at) > new Date()
    const tiktokExpiresIn = tiktokRes.data
      ? Math.round((new Date(tiktokRes.data.expires_at).getTime() - Date.now()) / 60000)
      : null

    const missingEnvVars = [
      'ANTHROPIC_API_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ELEVENLABS_API_KEY',
      'PEXELS_API_KEY',
      'TIKTOK_CLIENT_KEY',
      'TIKTOK_CLIENT_SECRET',
      'GITHUB_DISPATCH_TOKEN',
    ].filter(k => !process.env[k])

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      queue: {
        pending:    pendingRes.count    ?? 0,
        processing: processingRes.count ?? 0,
        failed:     failedRes.count     ?? 0,
        stuck:      stuckRes.count      ?? 0,
      },
      recent_completions: completedRes.data ?? [],
      recent_failures: (recentFailedRes.data ?? []).map(j => ({
        id:         j.id,
        package_id: j.package_id,
        error:      j.error,
        failed_at:  j.updated_at,
      })),
      tiktok: {
        connected:   tiktokConnected,
        open_id:     tiktokRes.data?.open_id ?? null,
        expires_in_minutes: tiktokExpiresIn,
      },
      env: {
        missing: missingEnvVars,
        discord_alerts: !!process.env.DISCORD_WEBHOOK_URL,
        github_dispatch: !!process.env.GITHUB_DISPATCH_TOKEN,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Health check failed'
    return NextResponse.json({ status: 'error', error: msg }, { status: 500 })
  }
}
