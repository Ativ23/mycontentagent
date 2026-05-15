import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface StatCardProps {
  value: string
  label: string
  accentColor?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  accentColor = '#4f9cf9',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 200, mass: 0.7 },
    from: 0.3,
    to: 1,
  })

  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 320 }}>
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          padding: '64px 96px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 36,
          border: `3px solid ${accentColor}50`,
        }}
      >
        <div
          style={{
            fontSize: 156,
            fontWeight: 900,
            fontFamily: 'Arial Black, Impact, sans-serif',
            color: 'white',
            lineHeight: 1,
            letterSpacing: '-4px',
            textShadow: `0 0 80px ${accentColor}60, 0 4px 20px rgba(0,0,0,0.8)`,
          }}
        >
          {value}
        </div>
        <div style={{ width: 100, height: 4, background: accentColor, borderRadius: 2 }} />
        <div
          style={{
            fontSize: 46,
            fontWeight: 600,
            fontFamily: 'Arial, sans-serif',
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'center',
            maxWidth: 720,
            lineHeight: 1.3,
          }}
        >
          {label}
        </div>
      </div>
    </AbsoluteFill>
  )
}
