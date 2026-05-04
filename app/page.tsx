import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-lg">
        {/* Logo mark */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-900 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-900/40">
          <span className="text-2xl font-black text-white">$</span>
        </div>

        <h1 className="text-4xl font-black text-white mb-3 tracking-tight">
          Stacks Made Simple
        </h1>
        <p className="text-[#8884a8] text-lg mb-8 leading-relaxed">
          AI-powered TikTok content for personal finance creators.
          Generate scripts, voiceovers, and videos in minutes.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/generator"
            className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
          >
            Open Generator
          </Link>
          <Link
            href="/library"
            className="px-6 py-3 rounded-xl border border-[#2a2a3a] text-[#8884a8] hover:text-white hover:border-violet-600 font-medium transition-colors"
          >
            View Library
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6 text-left">
          {[
            { icon: '✦', title: 'AI Scripts', desc: 'High-retention TikTok scripts in seconds' },
            { icon: '◎', title: 'Voiceovers', desc: 'ElevenLabs AI voice with word timestamps' },
            { icon: '▶', title: 'Videos', desc: 'Auto-composed with captions and b-roll' },
          ].map((f) => (
            <div key={f.title} className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4">
              <p className="text-violet-400 text-lg mb-2">{f.icon}</p>
              <p className="text-white text-sm font-semibold mb-1">{f.title}</p>
              <p className="text-[#8884a8] text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex gap-6 justify-center text-xs text-[#555566]">
          <Link href="/terms" className="hover:text-[#8884a8] transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-[#8884a8] transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}
