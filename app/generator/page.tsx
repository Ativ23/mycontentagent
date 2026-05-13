'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CopyButton from '@/components/CopyButton'

const NICHES = [
  'Beauty & Skincare',
  'Personal Finance',
  'Fitness & Health',
  'Tech & Gadgets',
  'Home & Kitchen',
  'Fashion & Style',
  'Relationships',
  'Food & Recipes',
  'Pet Content',
  'Digital Products',
]

const TONES = ['Confident', 'Aggressive', 'Educational', 'Funny']

const QUICK_REFINES = [
  { label: 'Shorter', instruction: 'Make the script shorter, targeting 15 seconds when spoken aloud. Keep the strongest parts.' },
  { label: 'Punchier Hook', instruction: 'Rewrite only the opening hook to be bolder and more direct. Keep it under 10 words.' },
  { label: 'More Aggressive', instruction: 'Make the tone more aggressive and urgent. Increase FOMO and directness.' },
  { label: 'Softer Sell', instruction: 'Make it feel less salesy and more educational or conversational.' },
  { label: 'Gen Z Tone', instruction: 'Rewrite in Gen Z language and slang. Make it sound like a real TikToker.' },
  { label: '+ Numbers', instruction: 'Add specific numbers, stats, or dollar amounts to make it more credible and concrete.' },
]

type Idea = { title: string; hook: string; angle: string }
type ContentPackage = { script: string; caption: string; hashtags: string }

function GeneratorInner() {
  const searchParams = useSearchParams()
  const [niche, setNiche] = useState(searchParams.get('niche') || '')
  const [tone, setTone] = useState('')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [contentPackage, setContentPackage] = useState<ContentPackage | null>(null)
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [loadingPackage, setLoadingPackage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState('')
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState('')
  const [videoJobId, setVideoJobId] = useState<string | null>(null)
  const [bgVideoUrl, setBgVideoUrl] = useState('')
  const [error, setError] = useState('')
  const [voices, setVoices] = useState<{ voice_id: string; name: string; category: string; preview_url: string }[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [refineError, setRefineError] = useState('')
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceReport, setEnhanceReport] = useState<{
    checks: Record<string, { passed: boolean; note: string }>
    improved: boolean
  } | null>(null)

  // AI voice selection
  const [voiceSelection, setVoiceSelection] = useState<{
    selectedVoiceId: string
    selectedVoiceName: string
    reason: string
    voiceSettings: { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean }
  } | null>(null)
  const [voiceSelecting, setVoiceSelecting] = useState(false)
  const [showVoiceOverride, setShowVoiceOverride] = useState(false)

  useEffect(() => {
    fetch('/api/voices')
      .then((r) => r.json())
      .then((d) => { if (d.voices?.length) setVoices(d.voices) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const n = searchParams.get('niche')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (n) setNiche(n)
  }, [searchParams])

  useEffect(() => {
    if (!videoJobId) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate-video/status?jobId=${videoJobId}`)
        const data: { status: string; videoUrl?: string; error?: string } = await res.json()
        if (data.status === 'complete') {
          setVideoUrl(data.videoUrl ?? '')
          setVideoJobId(null)
          setVideoLoading(false)
        } else if (data.status === 'failed') {
          setVideoError(data.error || 'Video generation failed')
          setVideoJobId(null)
          setVideoLoading(false)
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [videoJobId])

  const generateIdeas = async () => {
    if (!niche || !tone) return setError('Please select a niche and tone.')
    setError('')
    setLoadingIdeas(true)
    setIdeas([])
    setSelectedIdea(null)
    setContentPackage(null)
    setSaved(false)
    setSavedId(null)
    setAudioUrl(null)
    setVoiceError('')
    setVideoUrl(null)
    setVideoError('')

    try {
      const res = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, tone }),
      })
      const text = await res.text()
      let data: { error?: string; ideas?: Idea[] } = {}
      try { data = JSON.parse(text) } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setIdeas(data.ideas ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoadingIdeas(false)
    }
  }

  const enhanceScript = async (script: string) => {
    setEnhancing(true)
    setEnhanceReport(null)
    try {
      const res = await fetch('/api/enhance-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, niche }),
      })
      const text = await res.text()
      let data: { error?: string; script?: string; checks?: Record<string, { passed: boolean; note: string }>; improved?: boolean } = {}
      try { data = JSON.parse(text) } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error)
      if (data.script) setContentPackage((prev) => prev ? { ...prev, script: data.script! } : prev)
      setEnhanceReport(data as Parameters<typeof setEnhanceReport>[0])
    } catch {
      // non-fatal — keep original script
    } finally {
      setEnhancing(false)
    }
  }

  const generatePackage = async (idea: Idea) => {
    setSelectedIdea(idea)
    setContentPackage(null)
    setLoadingPackage(true)
    setSaved(false)
    setSavedId(null)
    setAudioUrl(null)
    setVoiceError('')
    setVideoUrl(null)
    setVideoError('')
    setRefineError('')
    setEnhanceReport(null)
    setVoiceSelection(null)
    setShowVoiceOverride(false)

    try {
      const res = await fetch('/api/generate-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, niche, tone }),
      })
      const text = await res.text()
      let data: { error?: string; script?: string; caption?: string; hashtags?: string } = {}
      try { data = JSON.parse(text) } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setContentPackage(data as ContentPackage)
      setLoadingPackage(false)
      await enhanceScript(data.script ?? '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoadingPackage(false)
    }
  }

  const refineScript = async (instruction: string) => {
    if (!contentPackage || refining) return
    setRefining(true)
    setRefineError('')
    try {
      const res = await fetch('/api/refine-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: contentPackage.script, instruction, niche, tone }),
      })
      const text = await res.text()
      let data: { error?: string; script?: string } = {}
      try { data = JSON.parse(text) } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setContentPackage((prev) => prev ? { ...prev, script: data.script ?? prev.script } : prev)
      setRefineInput('')
    } catch (e: unknown) {
      setRefineError(e instanceof Error ? e.message : 'Failed to refine script')
    } finally {
      setRefining(false)
    }
  }

  const savePackage = async () => {
    if (!selectedIdea || !contentPackage) return
    setSaving(true)

    try {
      const res = await fetch('/api/save-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          title: selectedIdea.title,
          hook: selectedIdea.hook,
          ...contentPackage,
          status: 'saved',
        }),
      })
      const text = await res.text()
      let data: { error?: string; package?: { id: string } } = {}
      try { data = JSON.parse(text) } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setSaved(true)
      setSavedId(data.package?.id ?? null)
      // Kick off voice selection in the background as soon as the package is saved
      if (contentPackage?.script) runVoiceSelection(contentPackage.script)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save package')
    } finally {
      setSaving(false)
    }
  }

  const runVoiceSelection = async (script: string) => {
    setVoiceSelecting(true)
    setVoiceSelection(null)
    try {
      const res = await fetch('/api/select-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, niche, tone }),
      })
      const data = await res.json()
      setVoiceSelection(data)
    } catch {
      // Non-fatal — voiceover generation has its own fallback
    } finally {
      setVoiceSelecting(false)
    }
  }

  const generateVoiceover = async () => {
    if (!savedId || !contentPackage) return
    setVoiceLoading(true)
    setVoiceError('')
    try {
      const res = await fetch('/api/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: savedId,
          script: contentPackage.script,
          // Manual override beats AI pick; AI pick beats default
          voiceId: selectedVoiceId || voiceSelection?.selectedVoiceId || undefined,
          voiceSettings: !selectedVoiceId && voiceSelection ? voiceSelection.voiceSettings : undefined,
        }),
      })
      const text = await res.text()
      let data: { error?: string; audioUrl?: string } = {}
      try { data = JSON.parse(text) } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setAudioUrl(data.audioUrl ?? '')
    } catch (e: unknown) {
      setVoiceError(e instanceof Error ? e.message : 'Failed to generate voiceover')
    } finally {
      setVoiceLoading(false)
    }
  }

  const generateVideo = async () => {
    if (!savedId || !contentPackage || !audioUrl) return
    setVideoLoading(true)
    setVideoError('')
    setVideoUrl(null)
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: savedId, script: contentPackage.script, audioUrl, bgVideoUrl: bgVideoUrl || undefined }),
      })
      const text = await res.text()
      let data: { error?: string; jobId?: string } = {}
      try { data = JSON.parse(text) } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setVideoJobId(data.jobId ?? null)
    } catch (e: unknown) {
      setVideoError(e instanceof Error ? e.message : 'Failed to queue video')
      setVideoLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Content Generator</h1>
        <p className="text-[#8884a8] mt-1">Generate TikTok content packages in seconds.</p>
      </div>

      {/* Step 1 */}
      <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6 mb-6">
        <h2 className="text-sm font-medium text-[#8884a8] uppercase tracking-wider mb-4">Step 1 — Select Niche & Tone</h2>

        <div className="mb-4">
          <label className="block text-xs text-[#8884a8] mb-2">Niche</label>
          <div className="grid grid-cols-5 gap-2">
            {NICHES.map((n) => (
              <button
                key={n}
                onClick={() => setNiche(n)}
                className={`py-2 px-2 rounded-lg text-xs text-left transition-colors border leading-tight ${
                  niche === n
                    ? 'border-violet-600 bg-violet-600/20 text-violet-300'
                    : 'border-[#2a2a3a] text-[#8884a8] hover:border-[#3a3a4a] hover:text-white'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-[#8884a8] mb-2">Tone</label>
          <div className="grid grid-cols-4 gap-2">
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`py-2 px-3 rounded-lg text-sm text-left transition-colors border ${
                  tone === t
                    ? 'border-violet-600 bg-violet-600/20 text-violet-300'
                    : 'border-[#2a2a3a] text-[#8884a8] hover:border-[#3a3a4a] hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

        <button
          onClick={generateIdeas}
          disabled={loadingIdeas || !niche || !tone}
          className="mt-5 w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {loadingIdeas ? 'Generating ideas...' : '✦ Generate 5 Ideas'}
        </button>
      </div>

      {/* Step 2 */}
      {ideas.length > 0 && (
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6 mb-6">
          <h2 className="text-sm font-medium text-[#8884a8] uppercase tracking-wider mb-4">Step 2 — Pick an Idea</h2>
          <div className="space-y-3">
            {ideas.map((idea, i) => (
              <button
                key={i}
                onClick={() => generatePackage(idea)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedIdea?.title === idea.title
                    ? 'border-violet-600 bg-violet-600/10'
                    : 'border-[#2a2a3a] hover:border-[#3a3a4a] bg-[#1a1a24]'
                }`}
              >
                <p className="text-white font-medium text-sm">{idea.title}</p>
                <p className="text-[#8884a8] text-xs mt-1">Hook: {idea.hook}</p>
                <p className="text-[#8884a8] text-xs mt-0.5">Angle: {idea.angle}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {loadingPackage && (
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
            <p className="text-[#8884a8]">Building content package...</p>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {contentPackage && selectedIdea && (
        <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-6">
          <h2 className="text-sm font-medium text-[#8884a8] uppercase tracking-wider mb-4">Step 3 — Your Content Package</h2>

          <div className="space-y-5">
            {/* Hook */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#8884a8] uppercase tracking-wider">Hook</label>
                <CopyButton text={selectedIdea.hook} label="Copy Hook" />
              </div>
              <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm">
                {selectedIdea.hook}
              </div>
            </div>

            {/* Script */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[#8884a8] uppercase tracking-wider">Script</label>
                  {enhancing && (
                    <span className="flex items-center gap-1.5 text-xs text-violet-400">
                      <span className="inline-block w-2.5 h-2.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                      Enhancing...
                    </span>
                  )}
                  {!enhancing && enhanceReport?.improved && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 font-medium">✦ Enhanced</span>
                  )}
                  {!enhancing && enhanceReport && !enhanceReport.improved && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300 font-medium">✓ Passed all checks</span>
                  )}
                </div>
                <CopyButton text={contentPackage.script} label="Copy Script" />
              </div>
              <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm whitespace-pre-wrap leading-relaxed">
                {contentPackage.script}
              </div>

              {/* Enhancement report */}
              {!enhancing && enhanceReport && (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {Object.entries(enhanceReport.checks).map(([key, check]) => (
                    <div
                      key={key}
                      title={check.note}
                      className={`rounded-lg px-2.5 py-1.5 text-xs border ${
                        check.passed
                          ? 'bg-emerald-600/10 border-emerald-600/30 text-emerald-300'
                          : 'bg-violet-600/10 border-violet-600/30 text-violet-300'
                      }`}
                    >
                      <span className="font-medium capitalize">{key}</span>
                      <span className="ml-1">{check.passed ? '✓' : '↑ fixed'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Script refinement */}
              {!saved && (
                <div className="mt-3 bg-[#0d0d14] border border-[#2a2a3a] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs text-[#8884a8] uppercase tracking-wider font-medium">Refine Script</p>
                    <button
                      onClick={() => contentPackage && enhanceScript(contentPackage.script)}
                      disabled={enhancing || refining}
                      className="text-xs px-2.5 py-1 rounded-md bg-violet-600/20 border border-violet-600/40 text-violet-300 hover:bg-violet-600/30 disabled:opacity-40 transition-colors"
                    >
                      {enhancing ? 'Enhancing...' : '✦ Re-enhance'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {QUICK_REFINES.map(({ label, instruction }) => (
                      <button
                        key={label}
                        onClick={() => refineScript(instruction)}
                        disabled={refining || enhancing}
                        className="px-2.5 py-1 rounded-md bg-[#1a1a24] border border-[#2a2a3a] text-[#8884a8] hover:text-white hover:border-violet-600 disabled:opacity-40 text-xs transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={refineInput}
                      onChange={(e) => setRefineInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && refineInput.trim() && refineScript(refineInput.trim())}
                      placeholder='Custom instruction, e.g. "add a cliffhanger at the end"'
                      disabled={refining || enhancing}
                      className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-xs placeholder-[#555566] focus:outline-none focus:border-violet-600 disabled:opacity-40"
                    />
                    <button
                      onClick={() => refineInput.trim() && refineScript(refineInput.trim())}
                      disabled={refining || enhancing || !refineInput.trim()}
                      className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
                    >
                      {refining ? '...' : 'Refine'}
                    </button>
                  </div>
                  {refineError && <p className="text-red-400 text-xs mt-2">{refineError}</p>}
                </div>
              )}
            </div>

            {/* Caption */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#8884a8] uppercase tracking-wider">Caption</label>
                <CopyButton text={contentPackage.caption} label="Copy Caption" />
              </div>
              <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm">
                {contentPackage.caption}
              </div>
            </div>

            {/* Hashtags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#8884a8] uppercase tracking-wider">Hashtags</label>
                <CopyButton text={contentPackage.hashtags} label="Copy Tags" />
              </div>
              <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-violet-300 text-sm">
                {contentPackage.hashtags}
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={savePackage}
              disabled={saving || saved}
              className="flex-1 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {saved ? '✓ Saved to Library' : saving ? 'Saving...' : 'Save to Library'}
            </button>
            <button
              onClick={() => {
                setContentPackage(null)
                setSelectedIdea(null)
                setIdeas([])
                setSaved(false)
                setSavedId(null)
                setAudioUrl(null)
                setVoiceError('')
                setVideoUrl(null)
                setVideoError('')
                setRefineError('')
                setVoiceSelection(null)
                setShowVoiceOverride(false)
              }}
              className="px-5 py-3 rounded-lg border border-[#2a2a3a] text-[#8884a8] hover:text-white hover:border-[#3a3a4a] transition-colors text-sm"
            >
              Start Over
            </button>
          </div>

          {/* Voiceover */}
          {saved && savedId && !audioUrl && (
            <div className="mt-4 space-y-3">

              {/* AI voice selection card */}
              {voiceSelecting && (
                <div className="bg-[#0d0d14] border border-[#2a2a3a] rounded-xl p-4 flex items-center gap-3">
                  <span className="inline-block w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin flex-shrink-0" />
                  <p className="text-[#8884a8] text-sm">Analyzing script to find best voice...</p>
                </div>
              )}

              {!voiceSelecting && voiceSelection && (
                <div className="bg-[#0d0d14] border border-violet-600/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-violet-400 uppercase tracking-wider font-medium mb-1">Voice Selected</p>
                      <p className="text-white font-semibold">{voiceSelection.selectedVoiceName}</p>
                      <p className="text-[#8884a8] text-xs mt-1 leading-relaxed">{voiceSelection.reason}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {/* Preview button */}
                      {voices.find(v => v.voice_id === voiceSelection.selectedVoiceId)?.preview_url && (
                        <button
                          onClick={() => {
                            const url = voices.find(v => v.voice_id === voiceSelection.selectedVoiceId)?.preview_url
                            if (url) new Audio(url).play()
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-[#2a2a3a] text-[#8884a8] hover:text-white hover:border-violet-600 text-xs transition-colors"
                        >
                          ▶ Preview
                        </button>
                      )}
                      {/* Re-run selection */}
                      <button
                        onClick={() => contentPackage && runVoiceSelection(contentPackage.script)}
                        className="px-2.5 py-1.5 rounded-lg border border-[#2a2a3a] text-[#8884a8] hover:text-white hover:border-violet-600 text-xs transition-colors"
                      >
                        ↻ Retry
                      </button>
                    </div>
                  </div>

                  {/* Voice settings pills */}
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: 'Stability', value: voiceSelection.voiceSettings.stability },
                      { label: 'Style', value: voiceSelection.voiceSettings.style },
                      { label: 'Similarity', value: voiceSelection.voiceSettings.similarity_boost },
                    ].map(({ label, value }) => (
                      <span key={label} className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a24] border border-[#2a2a3a] text-[#8884a8]">
                        {label}: {value.toFixed(2)}
                      </span>
                    ))}
                  </div>

                  {/* Manual override toggle */}
                  <button
                    onClick={() => setShowVoiceOverride(v => !v)}
                    className="text-xs text-[#555566] hover:text-[#8884a8] transition-colors"
                  >
                    {showVoiceOverride ? '▲ Hide override' : '▼ Change voice manually'}
                  </button>

                  {showVoiceOverride && voices.length > 0 && (
                    <div className="flex gap-2 pt-1">
                      <select
                        value={selectedVoiceId}
                        onChange={(e) => setSelectedVoiceId(e.target.value)}
                        className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-600 appearance-none"
                      >
                        <option value="">Use AI selection ({voiceSelection.selectedVoiceName})</option>
                        {voices.map((v) => (
                          <option key={v.voice_id} value={v.voice_id}>
                            {v.name}{v.category === 'cloned' ? ' ★' : ''}
                          </option>
                        ))}
                      </select>
                      {selectedVoiceId && voices.find(v => v.voice_id === selectedVoiceId)?.preview_url && (
                        <button
                          onClick={() => {
                            const url = voices.find(v => v.voice_id === selectedVoiceId)?.preview_url
                            if (url) new Audio(url).play()
                          }}
                          className="px-3 py-2 rounded-lg border border-[#2a2a3a] text-[#8884a8] hover:text-white hover:border-violet-600 text-xs transition-colors"
                        >
                          ▶
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {voiceError && <p className="text-red-400 text-sm">{voiceError}</p>}
              <button
                onClick={generateVoiceover}
                disabled={voiceLoading || voiceSelecting}
                className="w-full py-3 rounded-lg border border-violet-600 text-violet-300 hover:bg-violet-600/20 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors text-sm"
              >
                {voiceLoading ? 'Generating voiceover...' : '▶ Generate Voiceover'}
              </button>
            </div>
          )}

          {audioUrl && (
            <div className="mt-4 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-4">
              <p className="text-xs font-medium text-[#8884a8] uppercase tracking-wider mb-2">Voiceover</p>
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}

          {/* Video */}
          {audioUrl && savedId && !videoUrl && (
            <div className="mt-4 space-y-3">
              <div className="bg-[#111118] border border-[#2a2a3a] rounded-xl p-4">
                <label className="block text-xs text-[#8884a8] mb-1.5">Background Video URL <span className="text-[#555566]">(optional — Pexels auto-picks if blank)</span></label>
                <input
                  type="url"
                  value={bgVideoUrl}
                  onChange={(e) => setBgVideoUrl(e.target.value)}
                  placeholder="https://example.com/background.mp4"
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#555566] focus:outline-none focus:border-violet-600"
                />
              </div>
              {videoError && <p className="text-red-400 text-sm">{videoError}</p>}
              <button
                onClick={generateVideo}
                disabled={videoLoading}
                className="w-full py-3 rounded-lg border border-[#3a3a4a] text-white hover:bg-[#1a1a24] disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors text-sm"
              >
                {videoLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating video — usually 1–3 minutes...
                  </span>
                ) : '▶ Create Video'}
              </button>
            </div>
          )}

          {videoUrl && (
            <div className="mt-4 bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-[#8884a8] uppercase tracking-wider">Video</p>
                <a
                  href={videoUrl}
                  download="tiktok-video.mp4"
                  className="text-xs px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                >
                  Download MP4
                </a>
              </div>
              <video controls src={videoUrl} className="w-full rounded-lg max-h-[480px]" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GeneratorPage() {
  return (
    <Suspense>
      <GeneratorInner />
    </Suspense>
  )
}
