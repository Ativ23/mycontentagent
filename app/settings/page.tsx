'use client'

import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [tikTokConnected, setTikTokConnected] = useState<boolean | null>(null)
  const [tikTokOpenId, setTikTokOpenId] = useState<string | null>(null)
  const [tikTokMessage, setTikTokMessage] = useState('')
  const [tikTokError, setTikTokError] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    // Read URL params from OAuth redirect
    const params = new URLSearchParams(window.location.search)
    if (params.get('tiktok_connected') === '1') setTikTokMessage('TikTok connected successfully!')
    const err = params.get('tiktok_error')
    if (err) setTikTokError(`Connection failed: ${err.replace(/_/g, ' ')}`)

    // Check current connection status
    fetch('/api/tiktok/status')
      .then((r) => r.json())
      .then((d) => {
        setTikTokConnected(d.connected)
        setTikTokOpenId(d.open_id ?? null)
      })
      .catch(() => setTikTokConnected(false))
  }, [])

  const disconnect = async () => {
    setDisconnecting(true)
    try {
      await fetch('/api/tiktok/disconnect', { method: 'POST' })
      setTikTokConnected(false)
      setTikTokOpenId(null)
      setTikTokMessage('')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-[#8884a8] mt-1">Configure your API keys and preferences.</p>
      </div>

      <div className="space-y-5">
        {/* TikTok */}
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold">TikTok</h2>
              {tikTokConnected === true && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/20 text-green-400 font-medium">Connected</span>
              )}
              {tikTokConnected === false && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#2a2a3a] text-[#8884a8] font-medium">Not connected</span>
              )}
            </div>
          </div>
          <p className="text-[#8884a8] text-sm mb-4">Connect your TikTok account to post videos directly from the library.</p>

          {tikTokMessage && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-green-600/10 border border-green-600/30 text-green-400 text-sm">
              {tikTokMessage}
            </div>
          )}
          {tikTokError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm">
              {tikTokError}
            </div>
          )}

          {tikTokConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium">@stacksmadesimple</p>
                  {tikTokOpenId && (
                    <p className="text-[#8884a8] text-xs truncate">open_id: {tikTokOpenId}</p>
                  )}
                </div>
              </div>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="w-full py-2 rounded-lg border border-[#3a3a4a] text-[#8884a8] hover:text-red-400 hover:border-red-600/40 text-sm transition-colors disabled:opacity-40"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect TikTok'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <a
                href="/api/tiktok/auth"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#fe2c55] hover:bg-[#e02248] text-white text-sm font-medium transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.28 8.28 0 004.84 1.55V6.92a4.85 4.85 0 01-1.07-.23z"/>
                </svg>
                Connect TikTok Account
              </a>
              <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-3 text-xs text-[#8884a8] space-y-1">
                <p className="text-white font-medium mb-1">Setup required first</p>
                <p>1. Go to <span className="text-violet-300">developers.tiktok.com</span> → your app</p>
                <p>2. Add redirect URI: <code className="text-violet-300">http://localhost:3000/api/tiktok/callback</code></p>
                <p>3. Click &ldquo;Connect TikTok Account&rdquo; above</p>
              </div>
            </div>
          )}
        </div>

        {/* Anthropic */}
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">Anthropic API</h2>
          <p className="text-[#8884a8] text-sm mb-4">Used for generating ideas, scripts, and captions.</p>
          <div>
            <label className="block text-xs text-[#8884a8] mb-1.5">API Key</label>
            <input
              type="password"
              placeholder="sk-ant-..."
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#8884a8] focus:outline-none focus:border-violet-600"
            />
            <p className="text-xs text-[#8884a8] mt-2">Set via <code className="text-violet-300">ANTHROPIC_API_KEY</code> in your <code className="text-violet-300">.env.local</code> file.</p>
          </div>
        </div>

        {/* Supabase */}
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">Supabase</h2>
          <p className="text-[#8884a8] text-sm mb-4">Database for saving content packages.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#8884a8] mb-1.5">Project URL</label>
              <input
                type="text"
                placeholder="https://xxx.supabase.co"
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#8884a8] focus:outline-none focus:border-violet-600"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8884a8] mb-1.5">Anon Key</label>
              <input
                type="password"
                placeholder="eyJ..."
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#8884a8] focus:outline-none focus:border-violet-600"
              />
            </div>
            <p className="text-xs text-[#8884a8]">Set via <code className="text-violet-300">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-violet-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your <code className="text-violet-300">.env.local</code> file.</p>
          </div>
        </div>

        {/* ElevenLabs */}
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">ElevenLabs API</h2>
          <p className="text-[#8884a8] text-sm mb-4">AI voice generation for TikTok voiceovers.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#8884a8] mb-1.5">API Key</label>
              <input
                type="password"
                placeholder="your_elevenlabs_api_key"
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#8884a8] focus:outline-none focus:border-violet-600"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8884a8] mb-1.5">Voice ID</label>
              <input
                type="text"
                placeholder="21m00Tcm4TlvDq8ikWAM (default: Rachel)"
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#8884a8] focus:outline-none focus:border-violet-600"
              />
              <p className="text-xs text-[#8884a8] mt-1.5">Find voice IDs in your <a href="https://elevenlabs.io/voice-library" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">ElevenLabs Voice Library</a>.</p>
            </div>
            <p className="text-xs text-[#8884a8]">Set via <code className="text-violet-300">ELEVENLABS_API_KEY</code> and <code className="text-violet-300">ELEVENLABS_VOICE_ID</code> in your <code className="text-violet-300">.env.local</code> file.</p>
          </div>
        </div>

        {/* Runway ML */}
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-white font-semibold">Runway ML</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 font-medium">Primary AI Video</span>
          </div>
          <p className="text-[#8884a8] text-sm mb-4">
            Generates AI video clips from your script using Gen-3 Alpha Turbo. When configured, replaces Pexels b-roll with fully AI-generated scenes matched to each part of the script.
          </p>
          <div>
            <label className="block text-xs text-[#8884a8] mb-1.5">API Secret</label>
            <input
              type="password"
              placeholder="your_runwayml_api_secret"
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#8884a8] focus:outline-none focus:border-violet-600"
            />
            <p className="text-xs text-[#8884a8] mt-2">
              Get your key at <span className="text-violet-400">app.runwayml.com → API</span>. Set <code className="text-violet-300">RUNWAYML_API_SECRET</code> in <code className="text-violet-300">.env.local</code> and restart the server.
            </p>
          </div>
          <div className="mt-4 bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-3 text-xs text-[#8884a8] space-y-1">
            <p className="text-white font-medium mb-1">Video generation tiers</p>
            <p>1. <span className="text-violet-300">Runway API key set</span> → AI-generated clips per scene (~2-3 min)</p>
            <p>2. <span className="text-violet-300">Pexels API key set</span> → relevant stock footage per scene (~45 sec)</p>
            <p>3. <span className="text-[#555566]">Neither</span> → animated gradient background</p>
          </div>
        </div>

        {/* Pexels */}
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">Pexels API <span className="text-xs font-normal text-violet-400 ml-2">for auto b-roll video</span></h2>
          <p className="text-[#8884a8] text-sm mb-4">Free API that auto-fetches relevant background footage for your videos based on the script content.</p>
          <div>
            <label className="block text-xs text-[#8884a8] mb-1.5">API Key</label>
            <input
              type="password"
              placeholder="your_pexels_api_key"
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#8884a8] focus:outline-none focus:border-violet-600"
            />
            <p className="text-xs text-[#8884a8] mt-2">
              Get a free key at <span className="text-violet-400">pexels.com/api</span> — then set <code className="text-violet-300">PEXELS_API_KEY</code> in your <code className="text-violet-300">.env.local</code> file. Without it, videos use a gradient background.
            </p>
          </div>
        </div>

        {/* Supabase Storage */}
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">Supabase Storage</h2>
          <p className="text-[#8884a8] text-sm mb-3">Required for storing voiceover audio files. Create a public bucket named <code className="text-violet-300">voiceovers</code> in your Supabase project under Storage.</p>
          <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg px-4 py-3 text-xs text-violet-300 space-y-1">
            <p>1. Go to Supabase → Storage → New Bucket</p>
            <p>2. Name it <span className="text-white">voiceovers</span>, enable <span className="text-white">Public bucket</span></p>
            <p>3. Click Create</p>
          </div>
        </div>

        {/* DB Setup */}
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
          <h2 className="text-white font-semibold mb-1">Database Setup</h2>
          <p className="text-[#8884a8] text-sm mb-3">Run this SQL in your Supabase SQL editor to create the required tables:</p>
          <pre className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-4 text-xs text-violet-300 overflow-x-auto whitespace-pre">{`create table content_packages (
  id uuid default gen_random_uuid() primary key,
  niche text not null,
  title text not null,
  hook text not null,
  script text not null,
  caption text not null,
  hashtags text not null,
  audio_url text,
  video_url text,
  status text default 'saved',
  created_at timestamp with time zone default now()
);

create table tiktok_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id text not null unique,
  access_token text not null,
  refresh_token text not null,
  open_id text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- If upgrading content_packages, run:
-- alter table content_packages add column if not exists video_url text;

create table if not exists video_jobs (
  id uuid default gen_random_uuid() primary key,
  package_id text not null,
  status text not null default 'pending',
  error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Block fake/non-UUID package_id values at the database level:
alter table video_jobs
  add constraint video_jobs_package_id_uuid
  check (package_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- Speed up worker queries that filter by status:
create index if not exists video_jobs_status_idx on video_jobs (status);`}</pre>
        </div>
      </div>
    </div>
  )
}
