import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { niche, title, hook, script, caption, hashtags, status } = body

  if (!niche || !title || !script) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('content_packages')
    .insert({ niche, title, hook, script, caption, hashtags, status: status ?? 'saved', user_id: user.id })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ package: data })
}
