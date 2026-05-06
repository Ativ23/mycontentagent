export type { VideoProvider, GenerateClipParams } from './types'
export { RunwayProvider } from './runway'

import { RunwayProvider } from './runway'
import type { VideoProvider } from './types'

/**
 * Returns the active video provider based on environment configuration.
 * Priority: Runway → (future providers) → null (fall back to Pexels / gradient in route)
 *
 * To add Pika later:
 *   1. Create lib/video-providers/pika.ts implementing VideoProvider
 *   2. Import PikaProvider here
 *   3. Add: if (process.env.PIKA_API_KEY) return new PikaProvider(process.env.PIKA_API_KEY)
 */
export function getVideoProvider(): VideoProvider | null {
  // Runway generation takes 30-120s per clip — incompatible with Vercel's 10s limit
  if (process.env.VERCEL) return null
  const runwayKey = process.env.RUNWAYML_API_SECRET
  if (runwayKey) return new RunwayProvider(runwayKey)
  return null
}
