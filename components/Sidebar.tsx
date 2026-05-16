'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: '⚡' },
  { href: '/generator', label: 'Content Generator', icon: '✦' },
  { href: '/library', label: 'Saved Library', icon: '◈' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen bg-[#111118] border-r border-[#2a2a3a]">
      <div className="px-6 py-6 border-b border-[#2a2a3a]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-sm font-bold">$</div>
          <span className="font-semibold text-white">Stacks Made Simple</span>
        </div>
        <p className="text-[11px] text-[#8884a8] mt-1 ml-10">TikTok Content AI</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-violet-600/20 text-violet-300 font-medium'
                  : 'text-[#8884a8] hover:text-white hover:bg-[#1a1a24]'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-6 py-4 border-t border-[#2a2a3a]">
        <p className="text-[11px] text-[#8884a8]">v2.0 — HeyGen Avatar</p>
      </div>
    </aside>
  )
}
