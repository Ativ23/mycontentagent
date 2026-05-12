import React, { useMemo } from 'react'
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion'
import { Audio } from '@remotion/media'
import { createTikTokStyleCaptions } from '@remotion/captions'
import type { Caption } from '@remotion/captions'
import { CaptionPage } from './CaptionPage'
import { SceneClip } from './SceneClip'
import type { MotionStyle } from './SceneClip'

// ─── Types ─────────────────────────────────────────────────────────────────────

// Each scene is one visual "cut" in the video.
// The worker fills this array — one entry per scene Claude identified in the script.
export interface SceneData {
  videoUrl: string | null   // Pexels video clip URL
  imageUrl: string | null   // Fallback image URL
  startMs: number           // When this scene starts (milliseconds from video start)
  durationMs: number        // How long this scene lasts (milliseconds)
  motionStyle: string       // 'slow-zoom' | 'pan-left' | 'pan-right' | 'punch-in' | 'quick-cut'
}

export interface TikTokVideoProps {
  audioUrl: string          // ElevenLabs voiceover URL
  captions: Caption[]       // Word-level timestamps from ElevenLabs
  highlightWords: string[]  // Claude-picked words to show in red
  scenes: SceneData[]       // Visual scenes (filled by worker)
  bgColor: string           // Fallback background color if no visuals
  durationInSeconds: number // Total video length
}

// ─── Timing constant ───────────────────────────────────────────────────────────
// How long each caption "page" stays on screen before switching to the next.
// 1200ms = 1.2 seconds. Roughly 2-4 words per page at normal speech pace.
const SWITCH_CAPTIONS_EVERY_MS = 1200

// ─── Component ─────────────────────────────────────────────────────────────────
export const TikTokVideo: React.FC<TikTokVideoProps> = ({
  audioUrl,
  captions,
  highlightWords,
  scenes,
  bgColor,
  durationInSeconds,
}) => {
  // fps = frames per second (30 in our case).
  // We need this to convert milliseconds → frame numbers.
  // Formula: frameNumber = (milliseconds / 1000) * fps
  const { fps } = useVideoConfig()

  // createTikTokStyleCaptions groups individual word timings into pages.
  // A "page" is the group of words shown together on screen at one time.
  // useMemo = only recalculate when captions array changes (performance optimization).
  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS }),
    [captions]
  )

  // A Set is like an array but checking "does this exist?" is instant.
  // We use it to quickly look up whether a word should be red.
  const highlightSet = useMemo(
    () => new Set(highlightWords.map((w) => w.toLowerCase())),
    [highlightWords]
  )

  return (
    // AbsoluteFill = a div that fills the entire 1080×1920 composition
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>

      {/* ── LAYER 1: Scene video clips ────────────────────────────────────────
          Each scene is a <Sequence> — it only renders between its start and end frame.
          Multiple scenes create the "cuts" you see in the final video.
          They stack in order: scene 1 → scene 2 → scene 3 → etc.
      */}
      {scenes.map((scene, i) => {
        // Convert milliseconds to frame numbers for Remotion
        const fromFrame = Math.round((scene.startMs / 1000) * fps)
        const durationInFrames = Math.max(1, Math.round((scene.durationMs / 1000) * fps))

        return (
          <Sequence key={i} from={fromFrame} durationInFrames={durationInFrames}>
            <SceneClip
              videoUrl={scene.videoUrl}
              imageUrl={scene.imageUrl}
              durationInFrames={durationInFrames}
              motionStyle={scene.motionStyle as MotionStyle}
            />
          </Sequence>
        )
      })}

      {/* ── LAYER 2: Gradient overlay ────────────────────────────────────────
          This sits on top of ALL scenes.
          It darkens the bottom of the frame so white caption text is always readable,
          regardless of what color/brightness the background video is.
      */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.75) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── LAYER 3: Audio ───────────────────────────────────────────────────
          The ElevenLabs voiceover plays across the entire video.
          It's not a layer you see — just the audio track.
      */}
      <Audio src={audioUrl} />

      {/* ── LAYER 4: Captions ───────────────────────────────────────────────
          Word-synced captions overlay ALL scenes.
          Each caption page is also a <Sequence> timed to the word timestamps.
          This is why the words light up exactly when they're spoken.
      */}
      {pages.map((page, i) => {
        const nextPage = pages[i + 1] ?? null
        const startFrame = Math.round((page.startMs / 1000) * fps)
        const endFrame = Math.round(
          nextPage
            ? (nextPage.startMs / 1000) * fps
            : startFrame + (SWITCH_CAPTIONS_EVERY_MS / 1000) * fps
        )
        const durationInFrames = Math.max(1, endFrame - startFrame)

        return (
          <Sequence key={`cap-${i}`} from={startFrame} durationInFrames={durationInFrames}>
            <CaptionPage page={page} highlightWords={highlightSet} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
