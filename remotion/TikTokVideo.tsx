import React, { useMemo } from 'react'
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion'
import { Audio } from '@remotion/media'
import { createTikTokStyleCaptions } from '@remotion/captions'
import type { Caption } from '@remotion/captions'
import { CaptionPage } from './CaptionPage'
import { SceneClip } from './SceneClip'
import type { MotionStyle } from './SceneClip'
import { AnimatedBackground } from './AnimatedBackground'
import { CounterCard } from './CounterCard'
import { StepsCard } from './StepsCard'
import { TextCard } from './TextCard'
import { ComparisonCard } from './ComparisonCard'

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

// Animated scene — universal types that work for any niche
export interface AnimatedSceneData {
  type: 'hook' | 'counter' | 'comparison' | 'steps' | 'text'
  startMs: number
  durationMs: number
  accentColor?: string
  // counter — any number counting up (calories, dollars, minutes, reps, %)
  value?: string
  unit?: string
  label?: string
  // comparison — any two-item contrast
  leftValue?: string
  leftLabel?: string
  rightValue?: string
  rightLabel?: string
  // text / hook
  headline?: string
  subtext?: string
  // steps — sequential process (tutorials, how-tos, recipes)
  items?: string[]
}

export interface TikTokVideoProps {
  audioUrl: string             // ElevenLabs voiceover URL
  captions: Caption[]          // Word-level timestamps from ElevenLabs
  highlightWords: string[]     // Claude-picked words to show in red
  scenes: SceneData[]          // Stock footage scenes (used when animatedScenes is absent)
  animatedScenes?: AnimatedSceneData[]  // Motion graphics scenes (takes precedence if present)
  bgColor: string              // Fallback background color if no visuals
  durationInSeconds: number    // Total video length
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
  animatedScenes,
  bgColor,
  durationInSeconds,
}) => {
  const useAnimated = !!animatedScenes && animatedScenes.length > 0
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
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>

      {/* ── LAYER 1: Background ──────────────────────────────────────────────
          Animated mode: dark gradient that slowly shifts hue.
          Stock mode: Pexels video/image clips cut to scenes.
      */}
      {useAnimated ? (
        <AnimatedBackground />
      ) : (
        scenes.map((scene, i) => {
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
        })
      )}

      {/* ── LAYER 2: Animated graphics ───────────────────────────────────────
          Only rendered in animated mode. Each scene shows a StatCard,
          ComparisonCard, or TextCard timed to the voiceover.
      */}
      {useAnimated && animatedScenes!.map((scene, i) => {
        const fromFrame = Math.round((scene.startMs / 1000) * fps)
        const durationInFrames = Math.max(1, Math.round((scene.durationMs / 1000) * fps))
        return (
          <Sequence key={`anim-${i}`} from={fromFrame} durationInFrames={durationInFrames}>
            {scene.type === 'counter' && (
              <CounterCard
                value={scene.value!}
                unit={scene.unit ?? ''}
                label={scene.label ?? ''}
                accentColor={scene.accentColor}
              />
            )}
            {scene.type === 'comparison' && (
              <ComparisonCard
                leftValue={scene.leftValue!}
                leftLabel={scene.leftLabel!}
                rightValue={scene.rightValue!}
                rightLabel={scene.rightLabel!}
              />
            )}
            {scene.type === 'steps' && (
              <StepsCard items={scene.items ?? []} accentColor={scene.accentColor} />
            )}
            {(scene.type === 'text' || scene.type === 'hook') && (
              <TextCard headline={scene.headline!} subtext={scene.subtext} type={scene.type} />
            )}
          </Sequence>
        )
      })}

      {/* ── LAYER 3: Gradient overlay ────────────────────────────────────────
          Darkens bottom so captions stay readable over any background.
      */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.4) 65%, rgba(0,0,0,0.75) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── LAYER 4: Audio ───────────────────────────────────────────────────*/}
      <Audio src={audioUrl} />

      {/* ── LAYER 5: Captions ───────────────────────────────────────────────*/}
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
