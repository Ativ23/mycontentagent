import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { TikTokPage } from '@remotion/captions'

export const CaptionPage: React.FC<{
  page: TikTokPage
  highlightWords: Set<string>
}> = ({ page, highlightWords }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentTimeMs = (frame / fps) * 1000
  const absoluteTimeMs = page.startMs + currentTimeMs

  // Page slides up with spring on entry
  const slideY = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 400, mass: 0.5 },
    from: 40,
    to: 0,
  })

  const pageOpacity = interpolate(frame, [0, 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 220,
        paddingLeft: 48,
        paddingRight: 48,
        transform: `translateY(${slideY}px)`,
        opacity: pageOpacity,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0 6px',
          maxWidth: 980,
        }}
      >
        {page.tokens.map((token, idx) => {
          const isActive = token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs
          const clean = token.text.replace(/[.,!?'"]/g, '').toLowerCase().trim()
          const isHighlighted = highlightWords.has(clean)

          // Active word pops with spring scale
          const wordScale = isActive
            ? spring({
                frame,
                fps,
                config: { damping: 120, stiffness: 600, mass: 0.4 },
                from: 1,
                to: 1.18,
              })
            : 1

          const color = isHighlighted ? '#FF3333' : isActive ? '#FFE000' : 'white'

          return (
            <span
              key={`${token.fromMs}-${idx}`}
              style={{
                color,
                fontSize: 82,
                fontWeight: 900,
                fontFamily: 'Arial Black, Impact, sans-serif',
                WebkitTextStroke: isActive ? '2px black' : '3px black',
                textShadow: isActive
                  ? '0 0 20px rgba(255,224,0,0.4), 0 3px 10px rgba(0,0,0,0.9)'
                  : '0 3px 10px rgba(0,0,0,0.9)',
                whiteSpace: 'pre',
                display: 'inline-block',
                transform: `scale(${wordScale})`,
                transformOrigin: 'center bottom',
                lineHeight: 1.15,
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
