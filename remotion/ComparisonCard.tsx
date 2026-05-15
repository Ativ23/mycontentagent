import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface ComparisonCardProps {
  leftValue: string
  leftLabel: string
  rightValue: string
  rightLabel: string
}

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  leftValue,
  leftLabel,
  rightValue,
  rightLabel,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const leftScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 200 },
    from: 0,
    to: 1,
  })

  const rightScale = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 14, stiffness: 200 },
    from: 0,
    to: 1,
  })

  const vsOpacity = interpolate(frame, [12, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 320 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 32,
          paddingLeft: 44,
          paddingRight: 44,
          width: '100%',
        }}
      >
        {/* Left — negative/worse */}
        <div
          style={{
            transform: `scale(${leftScale})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            padding: '48px 40px',
            background: 'rgba(255,82,82,0.18)',
            borderRadius: 28,
            border: '4px solid rgba(255,82,82,0.8)',
            boxShadow: '0 0 40px rgba(255,82,82,0.25)',
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              fontFamily: 'Arial Black, sans-serif',
              color: '#FF5252',
              lineHeight: 1,
              textAlign: 'center',
            }}
          >
            {leftValue}
          </div>
          <div
            style={{
              fontSize: 38,
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {leftLabel}
          </div>
        </div>

        {/* VS */}
        <div
          style={{
            fontSize: 46,
            fontWeight: 900,
            color: 'rgba(255,255,255,0.35)',
            fontFamily: 'Arial Black, sans-serif',
            opacity: vsOpacity,
            flexShrink: 0,
          }}
        >
          VS
        </div>

        {/* Right — positive/better */}
        <div
          style={{
            transform: `scale(${rightScale})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            padding: '48px 40px',
            background: 'rgba(0,200,83,0.18)',
            borderRadius: 28,
            border: '4px solid rgba(0,200,83,0.8)',
            boxShadow: '0 0 40px rgba(0,200,83,0.25)',
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              fontFamily: 'Arial Black, sans-serif',
              color: '#00C853',
              lineHeight: 1,
              textAlign: 'center',
            }}
          >
            {rightValue}
          </div>
          <div
            style={{
              fontSize: 38,
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {rightLabel}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
