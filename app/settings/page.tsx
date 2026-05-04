export default function SettingsPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-[#8884a8] mt-1">Configure your API keys and preferences.</p>
      </div>

      <div className="space-y-5">
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
          <p className="text-[#8884a8] text-sm mb-3">Run this SQL in your Supabase SQL editor to create the table:</p>
          <pre className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-4 text-xs text-violet-300 overflow-x-auto whitespace-pre">{`create table content_packages (
  id uuid default gen_random_uuid() primary key,
  niche text not null,
  title text not null,
  hook text not null,
  script text not null,
  caption text not null,
  hashtags text not null,
  audio_url text,
  status text default 'saved',
  created_at timestamp with time zone default now()
);

-- If upgrading an existing table, run:
-- alter table content_packages add column if not exists audio_url text;
-- alter table content_packages add column if not exists video_url text;`}</pre>
        </div>
      </div>
    </div>
  )
}
