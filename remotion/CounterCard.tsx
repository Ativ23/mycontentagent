import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface CounterCardProps {
  value: string       // target value as string e.g. "500", "5.0%", "$1,000", "30min"
  unit: string        // what it measures e.g. "calories", "per year", "to cook"
  label: string       // context label e.g. "burned per session"
  accentColor?: string
}

function parseNumeric(raw: string): { prefix: string; number: number; suffix: string } {
  const match = raw.match(/^([^0-9-]*)(-?[0-9]+\.?[0-9]*)(.*)$/)
  if (!match) return { prefix: '', number: 0, suffix: raw }
  return { prefix: match[1], number: parseFloat(match[2]), suffix: match[3] }
}

export const CounterCard: React.FC<CounterCardProps> = ({
  value,
  unit,
  label,
  accentColor = '#7c3aed',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const { prefix, number, suffix } = parseNumeric(value)
  const isDecimal = String(number).includes('.') || value.includes('.')

  // Count up over 1.5 seconds then hold
  const counted = interpolate(Math.min(frame, Math.round(fps * 1.5)), [0, Math.round(fps * 1.5)], [0, number], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const display = isDecimal
    ? `${prefix}${counted.toFixed(1)}${suffix}`
    : `${prefix}${Math.round(counted)}${suffix}`

  const containerScale = spring({
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
          transform: `scale(${containerScale})`,
          opacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          padding: '64px 96px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 36,
          border: `4px solid ${accentColor}`,
          boxShadow: `0 0 60px ${accentColor}50, inset 0 0 40px ${accentColor}10`,
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
            textShadow: `0 0 80px ${accentColor}80, 0 4px 20px rgba(0,0,0,0.8)`,
          }}
        >
          {display}
        </div>
        {unit && (
          <>
            <div style={{ width: 100, height: 4, background: accentColor, borderRadius: 2 }} />
            <div
              style={{
                fontSize: 44,
                fontWeight: 600,
                fontFamily: 'Arial, sans-serif',
                color: accentColor,
                textAlign: 'center',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              {unit}
            </div>
          </>
        )}
        {label && (
          <div
            style={{
              fontSize: 40,
              fontWeight: 500,
              fontFamily: 'Arial, sans-serif',
              color: 'rgba(255,255,255,0.65)',
              textAlign: 'center',
              maxWidth: 700,
              lineHeight: 1.3,
            }}
          >
            {label}
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}
