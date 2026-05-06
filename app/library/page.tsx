'use client'

import { useEffect, useState } from 'react'
import CopyButton from '@/components/CopyButton'
import Link from 'next/link'

type Package = {
  id: string
  niche: string
  title: string
  hook: string
  script: string
  caption: string
  hashtags: string
  audio_url?: string
  video_url?: string
  status: string
  created_at: string
}

export default function LibraryPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState('All')
  const [voiceLoading, setVoiceLoading] = useState<string | null>(null)
  const [voiceErrors, setVoiceErrors] = useState<Record<string, string>>({})
  const [videoLoading, setVideoLoading] = useState<string | null>(null)
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({})
  const [bgVideoUrls, setBgVideoUrls] = useState<Record<string, string>>({})
  const [voices, setVoices] = useState<{ voice_id: string; name: string; category: string; preview_url: string }[]>([])
  const [selectedVoiceIds, setSelectedVoiceIds] = useState<Record<string, string>>({})
  const [tikTokConnected, setTikTokConnected] = useState(false)
  const [tikTokPosting, setTikTokPosting] = useState<string | null>(null)
  const [tikTokResults, setTikTokResults] = useState<Record<string, { success?: boolean; error?: string }>>({})

  const niches = ['All', 'Beauty & Skincare', 'Personal Finance', 'Fitness & Health', 'Tech & Gadgets', 'Home & Kitchen', 'Fashion & Style', 'Relationships', 'Food & Recipes', 'Pet Content', 'Digital Products']

  useEffect(() => {
    fetch('/api/packages')
      .then((r) => r.json())
      .then((data) => { setPackages(data.packages || []); setLoading(false) })
      .catch(() => setLoading(false))
    fetch('/api/voices')
      .then((r) => r.json())
      .then((d) => { if (d.voices?.length) setVoices(d.voices) })
      .catch(() => {})
    fetch('/api/tiktok/status')
      .then((r) => r.json())
      .then((d) => setTikTokConnected(d.connected))
      .catch(() => {})
  }, [])

  const filtered = filter === 'All' ? packages : packages.filter((p) => p.niche === filter)

  const generateVideo = async (pkg: Package) => {
    if (!pkg.audio_url) return
    setVideoLoading(pkg.id)
    setVideoErrors((prev) => ({ ...prev, [pkg.id]: '' }))
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id, script: pkg.script, audioUrl: pkg.audio_url, bgVideoUrl: bgVideoUrls[pkg.id] || undefined }),
      })
      const text = await res.text()
      let data: { error?: string; videoUrl?: string } = {}
      try { data = JSON.parse(text) } catch { /* server returned non-JSON */ }
      if (!res.ok) {
        if (data.error === 'VIDEO_UNAVAILABLE') throw new Error('VIDEO_UNAVAILABLE')
        throw new Error(data.error || `Server error (${res.status})`)
      }
      setPackages((prev) =>
        prev.map((p) => (p.id === pkg.id ? { ...p, video_url: data.videoUrl } : p))
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate video'
      setVideoErrors((prev) => ({ ...prev, [pkg.id]: msg }))
    } finally {
      setVideoLoading(null)
    }
  }

  const postToTikTok = async (pkg: Package) => {
    if (!pkg.video_url) return
    setTikTokPosting(pkg.id)
    setTikTokResults((prev) => ({ ...prev, [pkg.id]: {} }))
    try {
      const res = await fetch('/api/tiktok/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: pkg.video_url }),
      })
      const text = await res.text()
      let data: { error?: string } = {}
      try { data = JSON.parse(text) } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setTikTokResults((prev) => ({ ...prev, [pkg.id]: { success: true } }))
    } catch (e: unknown) {
      setTikTokResults((prev) => ({
        ...prev,
        [pkg.id]: { error: e instanceof Error ? e.message : 'Failed to post to TikTok' },
      }))
    } finally {
      setTikTokPosting(null)
    }
  }

  const generateVoiceover = async (pkg: Package) => {
    setVoiceLoading(pkg.id)
    setVoiceErrors((prev) => ({ ...prev, [pkg.id]: '' }))
    try {
      const res = await fetch('/api/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id, script: pkg.script, voiceId: selectedVoiceIds[pkg.id] || undefined }),
      })
      const text = await res.text()
      let data: { error?: string; audioUrl?: string } = {}
      try { data = JSON.parse(text) } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setPackages((prev) =>
        prev.map((p) => (p.id === pkg.id ? { ...p, audio_url: data.audioUrl } : p))
      )
    } catch (e: unknown) {
      setVoiceErrors((prev) => ({
        ...prev,
        [pkg.id]: e instanceof Error ? e.message : 'Failed to generate voiceover',
      }))
    } finally {
      setVoiceLoading(null)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Saved Library</h1>
          <p className="text-[#8884a8] mt-1">{packages.length} content packages saved.</p>
        </div>
        <Link
          href="/generator"
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          + New Package
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {niches.map((n) => (
          <button
            key={n}
            onClick={() => setFilter(n)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === n
                ? 'bg-violet-600 text-white'
                : 'bg-[#1a1a24] text-[#8884a8] hover:text-white border border-[#2a2a3a]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[#8884a8] text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">◈</p>
          <p className="text-white font-medium">No packages yet</p>
          <p className="text-[#8884a8] text-sm mt-1">Generate your first content package to see it here.</p>
          <Link href="/generator" className="inline-block mt-4 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm transition-colors">
            Go to Generator
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pkg) => (
            <div key={pkg.id} className="bg-[#111118] border border-[#2a2a3a] rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === pkg.id ? null : pkg.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#1a1a24] transition-colors"
              >
                <div>
                  <p className="text-white font-medium text-sm">{pkg.title}</p>
                  <p className="text-[#8884a8] text-xs mt-0.5">
                    {pkg.niche} · {new Date(pkg.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-[#2a2a3a] text-[#8884a8]">{pkg.status}</span>
                  <span className="text-[#8884a8] text-sm">{expanded === pkg.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded === pkg.id && (
                <div className="px-5 pb-5 border-t border-[#2a2a3a] pt-4 space-y-4">
                  {[
                    { label: 'Hook', content: pkg.hook },
                    { label: 'Script', content: pkg.script },
                    { label: 'Caption', content: pkg.caption },
                    { label: 'Hashtags', content: pkg.hashtags },
                  ].map(({ label, content }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-[#8884a8] uppercase tracking-wider">{label}</span>
                        <CopyButton text={content} />
                      </div>
                      <p className={`text-sm bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 whitespace-pre-wrap leading-relaxed ${label === 'Hashtags' ? 'text-violet-300' : 'text-white'}`}>
                        {content}
                      </p>
                    </div>
                  ))}

                  {/* Voiceover */}
                  <div>
                    <span className="text-xs font-medium text-[#8884a8] uppercase tracking-wider">Voiceover</span>
                    {pkg.audio_url ? (
                      <audio controls src={pkg.audio_url} className="w-full mt-2" />
                    ) : (
                      <div className="mt-2 space-y-2">
                        {voices.length > 0 && (
                          <div className="flex gap-2">
                            <select
                              value={selectedVoiceIds[pkg.id] || ''}
                              onChange={(e) => setSelectedVoiceIds((prev) => ({ ...prev, [pkg.id]: e.target.value }))}
                              className="flex-1 bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-violet-600 appearance-none"
                            >
                              <option value="">Default voice</option>
                              {voices.map((v) => (
                                <option key={v.voice_id} value={v.voice_id}>
                                  {v.name}{v.category === 'cloned' ? ' ★' : ''}
                                </option>
                              ))}
                            </select>
                            {selectedVoiceIds[pkg.id] && voices.find((v) => v.voice_id === selectedVoiceIds[pkg.id])?.preview_url && (
                              <button
                                onClick={() => {
                                  const url = voices.find((v) => v.voice_id === selectedVoiceIds[pkg.id])?.preview_url
                                  if (url) new Audio(url).play()
                                }}
                                className="px-3 py-2 rounded-lg border border-[#2a2a3a] text-[#8884a8] hover:text-white hover:border-violet-600 text-xs transition-colors"
                                title="Preview voice"
                              >
                                ▶
                              </button>
                            )}
                          </div>
                        )}
                        {voiceErrors[pkg.id] && (
                          <p className="text-red-400 text-xs">{voiceErrors[pkg.id]}</p>
                        )}
                        <button
                          onClick={() => generateVoiceover(pkg)}
                          disabled={voiceLoading === pkg.id}
                          className="w-full py-2.5 rounded-lg border border-violet-600 text-violet-300 hover:bg-violet-600/20 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                        >
                          {voiceLoading === pkg.id ? 'Generating voiceover...' : '▶ Generate Voiceover'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Video */}
                  {pkg.audio_url && (
                    <div>
                      <span className="text-xs font-medium text-[#8884a8] uppercase tracking-wider">Video</span>
                      {pkg.video_url ? (
                        <div className="mt-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl p-3">
                          <video controls src={pkg.video_url} className="w-full rounded-lg max-h-[360px] mb-3" />
                          <div className="flex gap-2">
                            <a
                              href={pkg.video_url}
                              download="tiktok-video.mp4"
                              className="flex-1 block text-center text-xs px-3 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                            >
                              Download MP4
                            </a>
                            {tikTokConnected ? (
                              tikTokResults[pkg.id]?.success ? (
                                <div className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-md bg-green-600/20 border border-green-600/30 text-green-400">
                                  <span>✓</span> Sent to TikTok
                                </div>
                              ) : (
                                <button
                                  onClick={() => postToTikTok(pkg)}
                                  disabled={tikTokPosting === pkg.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-md bg-[#fe2c55]/10 border border-[#fe2c55]/30 text-[#fe2c55] hover:bg-[#fe2c55]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  {tikTokPosting === pkg.id ? (
                                    <>
                                      <span className="inline-block w-3 h-3 border-2 border-[#fe2c55]/30 border-t-[#fe2c55] rounded-full animate-spin" />
                                      Posting...
                                    </>
                                  ) : (
                                    <>
                                      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current flex-shrink-0">
                                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.28 8.28 0 004.84 1.55V6.92a4.85 4.85 0 01-1.07-.23z"/>
                                      </svg>
                                      Post to TikTok
                                    </>
                                  )}
                                </button>
                              )
                            ) : (
                              <Link
                                href="/settings"
                                className="flex-1 flex items-center justify-center text-xs px-3 py-2 rounded-md border border-[#2a2a3a] text-[#8884a8] hover:text-white transition-colors"
                              >
                                Connect TikTok
                              </Link>
                            )}
                          </div>
                          {tikTokResults[pkg.id]?.error && (
                            <p className="mt-2 text-red-400 text-xs">{tikTokResults[pkg.id].error}</p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2">
                          {videoErrors[pkg.id] === 'VIDEO_UNAVAILABLE' ? (
                            <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl p-4 text-center">
                              <p className="text-2xl mb-2">🎬</p>
                              <p className="text-white text-sm font-medium">Video rendering not available yet</p>
                              <p className="text-[#8884a8] text-xs mt-1">Coming soon. Your script and voiceover are ready — download them below.</p>
                              <button
                                onClick={() => setVideoErrors((prev) => ({ ...prev, [pkg.id]: '' }))}
                                className="mt-3 text-xs text-[#8884a8] hover:text-white underline transition-colors"
                              >
                                Try again
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="mb-2">
                                <label className="block text-xs text-[#8884a8] mb-1">Background Video URL <span className="text-[#555566]">(optional)</span></label>
                                <input
                                  type="url"
                                  value={bgVideoUrls[pkg.id] || ''}
                                  onChange={(e) => setBgVideoUrls((prev) => ({ ...prev, [pkg.id]: e.target.value }))}
                                  placeholder="https://example.com/background.mp4"
                                  className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-xs placeholder-[#555566] focus:outline-none focus:border-violet-600"
                                />
                              </div>
                              {videoErrors[pkg.id] && (
                                <p className="text-red-400 text-xs mb-2">{videoErrors[pkg.id]}</p>
                              )}
                              <button
                                onClick={() => generateVideo(pkg)}
                                disabled={videoLoading === pkg.id}
                                className="w-full py-2.5 rounded-lg border border-[#3a3a4a] text-white hover:bg-[#1a1a24] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                              >
                                {videoLoading === pkg.id ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating video...
                                  </span>
                                ) : '▶ Create Video'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
