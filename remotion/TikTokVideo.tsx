import React, { useMemo } from 'react'
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { Audio } from '@remotion/media'
import { createTikTokStyleCaptions } from '@remotion/captions'
import type { Caption } from '@remotion/captions'
import { CaptionPage } from './CaptionPage'

export interface TikTokVideoProps {
  audioUrl: string
  captions: Caption[]
  highlightWords: string[]
  bgColor: string
  bgImageUrl: string | null
  durationInSeconds: number
}

const SWITCH_CAPTIONS_EVERY_MS = 1200

const KenBurns: React.FC<{ src: string; durationInFrames: number }> = ({ src, durationInFrames }) => {
  const frame = useCurrentFrame()

  // Slow zoom from 100% to 115% over the full video
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  // Subtle pan: drift slightly right and down
  const translateX = interpolate(frame, [0, durationInFrames], [0, 20], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const translateY = interpolate(frame, [0, durationInFrames], [0, -15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
          transformOrigin: 'center center',
        }}
      />
    </AbsoluteFill>
  )
}

export const TikTokVideo: React.FC<TikTokVideoProps> = ({
  audioUrl,
  captions,
  highlightWords,
  bgColor,
  bgImageUrl,
  durationInSeconds,
}) => {
  const { fps } = useVideoConfig()
  const totalFrames = Math.ceil(durationInSeconds * fps)

  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS }),
    [captions]
  )

  const highlightSet = useMemo(
    () => new Set(highlightWords.map((w) => w.toLowerCase())),
    [highlightWords]
  )

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
      {bgImageUrl ? (
        <KenBurns src={bgImageUrl} durationInFrames={totalFrames} />
      ) : null}

      {/* Dark gradient overlay — heavier at bottom for caption readability */}
      <AbsoluteFill
        style={{
          background: bgImageUrl
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.55) 75%, rgba(0,0,0,0.75) 100%)'
            : 'transparent',
        }}
      />

      <Audio src={audioUrl} />

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
          <Sequence key={i} from={startFrame} durationInFrames={durationInFrames}>
            <CaptionPage page={page} highlightWords={highlightSet} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
