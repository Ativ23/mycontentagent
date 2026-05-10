import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import type { TikTokPage } from '@remotion/captions'

export const CaptionPage: React.FC<{
  page: TikTokPage
  highlightWords: Set<string>
}> = ({ page, highlightWords }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentTimeMs = (frame / fps) * 1000
  const absoluteTimeMs = page.startMs + currentTimeMs

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 280,
        paddingLeft: 40,
        paddingRight: 40,
      }}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.65)',
          borderRadius: 22,
          padding: '18px 28px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 1000,
        }}
      >
        {page.tokens.map((token) => {
          const isActive = token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs
          const clean = token.text.replace(/[.,!?'"]/g, '').toLowerCase().trim()
          const isHighlighted = highlightWords.has(clean)

          return (
            <span
              key={token.fromMs}
              style={{
                color: isHighlighted ? '#FF3333' : isActive ? '#FFE000' : 'white',
                fontSize: 80,
                fontWeight: 900,
                fontFamily: 'Arial Black, Impact, sans-serif',
                WebkitTextStroke: '3px black',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                whiteSpace: 'pre',
              }}
            >
              {token.text}
            </span>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
