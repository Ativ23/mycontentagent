import React, { useMemo } from 'react'
import { AbsoluteFill, Img, Sequence, useVideoConfig } from 'remotion'
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

const SWITCH_CAPTIONS_EVERY_MS = 1000

export const TikTokVideo: React.FC<TikTokVideoProps> = ({
  audioUrl,
  captions,
  highlightWords,
  bgColor,
  bgImageUrl,
}) => {
  const { fps } = useVideoConfig()

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
      {bgImageUrl && (
        <Img
          src={bgImageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      )}

      {bgImageUrl && (
        <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} />
      )}

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
