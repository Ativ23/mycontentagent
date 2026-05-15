import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface StepsCardProps {
  items: string[]     // 2-4 step descriptions
  accentColor?: string
}

export const StepsCard: React.FC<StepsCardProps> = ({
  items,
  accentColor = '#0ea5e9',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const staggerFrames = Math.round(fps * 0.45)
  const capped = items.slice(0, 4)

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 300,
        paddingLeft: 60,
        paddingRight: 60,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, width: '100%' }}>
        {capped.map((item, i) => {
          const startFrame = i * staggerFrames
          const stepFrame = Math.max(0, frame - startFrame)

          const opacity = interpolate(stepFrame, [0, 8], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })

          const slideX = spring({
            frame: stepFrame,
            fps,
            config: { damping: 14, stiffness: 180 },
            from: -100,
            to: 0,
          })

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                opacity,
                transform: `translateX(${slideX}px)`,
              }}
            >
              {/* Numbered circle */}
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  background: accentColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 42,
                  fontWeight: 900,
                  fontFamily: 'Arial Black, sans-serif',
                  color: 'white',
                  flexShrink: 0,
                  boxShadow: `0 0 24px ${accentColor}70`,
                }}
              >
                {i + 1}
              </div>
              {/* Step text */}
              <div
                style={{
                  fontSize: 54,
                  fontWeight: 700,
                  fontFamily: 'Arial, sans-serif',
                  color: 'white',
                  lineHeight: 1.2,
                  flex: 1,
                  textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                }}
              >
                {item}
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
