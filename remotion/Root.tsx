import React from 'react'
import { Composition } from 'remotion'
import { TikTokVideo } from './TikTokVideo'
import type { TikTokVideoProps } from './TikTokVideo'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TikTokVideo"
      component={TikTokVideo}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        audioUrl: '',
        captions: [],
        highlightWords: [],
        bgColor: '#0e0820',
        bgImageUrl: null,
        durationInSeconds: 30,
      } satisfies TikTokVideoProps}
    />
  )
}
