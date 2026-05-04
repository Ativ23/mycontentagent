import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tiktok_tokens')
    .select('open_id, expires_at')
    .eq('user_id', 'default')
    .single()

  if (error || !data) {
    return NextResponse.json({ connected: false })
  }

  const expired = new Date(data.expires_at) < new Date()
  return NextResponse.json({
    connected: !expired,
    open_id: data.open_id,
    expires_at: data.expires_at,
  })
}
