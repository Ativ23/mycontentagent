import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function getStats() {
  const supabase = getSupabaseAdmin()

  const { count: total } = await supabase
    .from('content_packages')
    .select('*', { count: 'exact', head: true })

  const { count: thisWeek } = await supabase
    .from('content_packages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  const { data: recent } = await supabase
    .from('content_packages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)

  return { total: total ?? 0, thisWeek: thisWeek ?? 0, recent: recent ?? [] }
}

export default async function DashboardPage() {
  const { total, thisWeek, recent } = await getStats()

  const niches = [
    { label: 'Beauty & Skincare', emoji: '✨', color: 'from-pink-600/20 to-pink-600/5' },
    { label: 'Personal Finance', emoji: '💰', color: 'from-green-600/20 to-green-600/5' },
    { label: 'Fitness & Health', emoji: '💪', color: 'from-orange-600/20 to-orange-600/5' },
    { label: 'Tech & Gadgets', emoji: '⚡', color: 'from-blue-600/20 to-blue-600/5' },
    { label: 'Home & Kitchen', emoji: '🏠', color: 'from-yellow-600/20 to-yellow-600/5' },
    { label: 'Fashion & Style', emoji: '👗', color: 'from-purple-600/20 to-purple-600/5' },
    { label: 'Relationships', emoji: '❤️', color: 'from-red-600/20 to-red-600/5' },
    { label: 'Food & Recipes', emoji: '🍳', color: 'from-amber-600/20 to-amber-600/5' },
    { label: 'Pet Content', emoji: '🐾', color: 'from-teal-600/20 to-teal-600/5' },
    { label: 'Digital Products', emoji: '🚀', color: 'from-violet-600/20 to-violet-600/5' },
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-[#8884a8] mt-1">Welcome back. Your content pipeline at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Packages', value: total },
          { label: 'This Week', value: thisWeek },
          { label: 'Niches Active', value: 10 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-5">
            <p className="text-[#8884a8] text-sm">{label}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link
          href="/generator"
          className="bg-violet-600 hover:bg-violet-500 transition-colors rounded-xl p-6 text-white group"
        >
          <div className="text-2xl mb-2">✦</div>
          <h3 className="font-semibold text-lg">Generate Content</h3>
          <p className="text-violet-200 text-sm mt-1">Create a new TikTok content package</p>
        </Link>
        <Link
          href="/library"
          className="bg-[#111118] hover:bg-[#1a1a24] border border-[#2a2a3a] transition-colors rounded-xl p-6 text-white"
        >
          <div className="text-2xl mb-2">◈</div>
          <h3 className="font-semibold text-lg">View Library</h3>
          <p className="text-[#8884a8] text-sm mt-1">Browse your saved content packages</p>
        </Link>
      </div>

      {/* Niches */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-[#8884a8] uppercase tracking-wider mb-3">Your Niches</h2>
        <div className="grid grid-cols-5 gap-3">
          {niches.map(({ label, emoji, color }) => (
            <Link
              key={label}
              href={`/generator?niche=${encodeURIComponent(label)}`}
              className={`bg-gradient-to-b ${color} border border-[#2a2a3a] rounded-xl p-4 hover:border-violet-600/40 transition-colors`}
            >
              <div className="text-xl mb-1">{emoji}</div>
              <p className="text-sm font-medium text-white">{label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent packages */}
      {recent.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-[#8884a8] uppercase tracking-wider mb-3">Recent Packages</h2>
          <div className="space-y-2">
            {recent.map((pkg: { id: string; niche: string; title: string; created_at: string; status: string }) => (
              <div key={pkg.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium text-sm">{pkg.title}</p>
                  <p className="text-[#8884a8] text-xs mt-0.5">{pkg.niche} · {new Date(pkg.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-[#2a2a3a] text-[#8884a8]">{pkg.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
