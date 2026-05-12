import React from 'react'
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame } from 'remotion'

// ─── Types ─────────────────────────────────────────────────────────────────────
// These are the motion styles we can apply to any visual.
// Each one moves the frame differently to keep things from feeling static.
export type MotionStyle = 'slow-zoom' | 'pan-left' | 'pan-right' | 'punch-in' | 'quick-cut'

interface SceneClipProps {
  videoUrl: string | null   // Pexels video URL (preferred)
  imageUrl: string | null   // Fallback image URL (used if no video)
  durationInFrames: number  // How many frames this scene lasts
  motionStyle: MotionStyle
}

// ─── Motion calculator ─────────────────────────────────────────────────────────
// This function returns a CSS transform string based on the current frame.
// `interpolate(frame, [start, end], [from, to])` maps a frame number to a value.
// Example: at frame 0, scale = 1.0. At frame 90, scale = 1.12. Smooth zoom.
function getTransform(motionStyle: MotionStyle, frame: number, durationInFrames: number): string {
  switch (motionStyle) {
    case 'slow-zoom': {
      // Gently zooms in over the whole scene — feels cinematic
      const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.13], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
      return `scale(${scale})`
    }
    case 'pan-left': {
      // Starts right, drifts left — like a camera slowly panning
      const tx = interpolate(frame, [0, durationInFrames], [70, -70], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
      return `scale(1.18) translateX(${tx}px)`
    }
    case 'pan-right': {
      // Starts left, drifts right
      const tx = interpolate(frame, [0, durationInFrames], [-70, 70], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
      return `scale(1.18) translateX(${tx}px)`
    }
    case 'punch-in': {
      // Rapidly zooms in at the start (great for hooks — creates impact)
      // interpolate clamps at frame 12 so it holds zoomed-in for the rest of the scene
      const scale = interpolate(frame, [0, 12], [1.0, 1.35], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
      return `scale(${scale})`
    }
    case 'quick-cut':
    default:
      // No motion — just a hard cut. The transition itself provides the energy.
      return 'scale(1.05)'
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────
export const SceneClip: React.FC<SceneClipProps> = ({
  videoUrl,
  imageUrl,
  durationInFrames,
  motionStyle,
}) => {
  const frame = useCurrentFrame()
  const transform = getTransform(motionStyle, frame, durationInFrames)

  // objectFit: 'cover' is the key here.
  // It means: fill the entire frame, crop whatever doesn't fit.
  // This turns a landscape (wide) video into a portrait (tall) video automatically.
  const mediaStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform,
    transformOrigin: 'center center',
  }

  // Prefer video over image — only fall back if no video URL was found
  if (videoUrl) {
    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <OffthreadVideo src={videoUrl} style={mediaStyle} />
      </AbsoluteFill>
    )
  }

  if (imageUrl) {
    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img src={imageUrl} style={mediaStyle} />
      </AbsoluteFill>
    )
  }

  // Last resort: solid dark background
  return <AbsoluteFill style={{ backgroundColor: '#0e0820' }} />
}
