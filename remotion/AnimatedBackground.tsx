import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

export const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame()

  const hue = interpolate(frame, [0, 900], [240, 258], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: `linear-gradient(160deg,
            hsl(${hue}, 65%, 7%) 0%,
            hsl(${hue + 14}, 58%, 11%) 50%,
            hsl(${hue - 6}, 72%, 5%) 100%
          )`,
        }}
      />
    </AbsoluteFill>
  )
}
