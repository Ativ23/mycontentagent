import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface TextCardProps {
  headline: string
  subtext?: string
  type: 'hook' | 'text'
}

export const TextCard: React.FC<TextCardProps> = ({ headline, subtext, type }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const slideY = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 180 },
    from: 60,
    to: 0,
  })

  const isHook = type === 'hook'

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 320,
        paddingLeft: 60,
        paddingRight: 60,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${slideY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: isHook ? 108 : 88,
            fontWeight: 900,
            fontFamily: 'Arial Black, Impact, sans-serif',
            color: 'white',
            lineHeight: 1.1,
            WebkitTextStroke: '2px rgba(0,0,0,0.4)',
            textShadow: '0 4px 24px rgba(0,0,0,0.9)',
            maxWidth: 920,
          }}
        >
          {headline}
        </div>
        {subtext && (
          <div
            style={{
              fontSize: 50,
              fontWeight: 600,
              fontFamily: 'Arial, sans-serif',
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.35,
              maxWidth: 860,
            }}
          >
            {subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}
