import React from 'react'
import { Composition } from 'remotion'
import { TikTokVideo } from './TikTokVideo'
import type { TikTokVideoProps } from './TikTokVideo'

// RemotionRoot registers all video compositions.
// Think of this like a project file in video editing software —
// it lists every "template" the renderer knows about.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TikTokVideo"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={TikTokVideo as any}
      durationInFrames={900}   // Default 30s — overridden at render time
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        audioUrl: '',
        captions: [],
        highlightWords: [],
        scenes: [],            // Worker fills this with per-scene video data
        bgColor: '#0e0820',
        durationInSeconds: 30,
      } satisfies TikTokVideoProps}
    />
  )
}
