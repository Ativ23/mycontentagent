import type { GenerateClipParams, VideoProvider } from './types'

const BASE = 'https://api.dev.runwayml.com/v1'
const VERSION = '2024-11-06'
const POLL_INTERVAL_MS = 8_000   // poll every 8 s — Runway tasks rarely finish faster
const POLL_TIMEOUT_MS  = 5 * 60_000 // 5-minute ceiling per clip

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class RunwayProvider implements VideoProvider {
  readonly name = 'runway'

  constructor(private readonly apiKey: string) {}

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'X-Runway-Version': VERSION,
      'Content-Type': 'application/json',
    }
  }

  async generateClip({ prompt, startImageUrl, durationSeconds }: GenerateClipParams): Promise<string> {
    // ── 1. Submit task ────────────────────────────────────────────────────────
    const createRes = await fetch(`${BASE}/image_to_video`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: 'gen3a_turbo',
        promptImage: startImageUrl,
        promptText: prompt,
        duration: durationSeconds,
        ratio: '768:1280', // portrait 9:16 — image_to_video only accepts "768:1280"|"1280:768"
      }),
    })

    if (!createRes.ok) {
      const body = await createRes.text()
      throw new Error(`Runway submit failed (HTTP ${createRes.status}): ${body}`)
    }

    const createBody = await createRes.json() as { id?: string }
    const taskId = createBody.id
    if (!taskId) throw new Error(`Runway returned no task ID: ${JSON.stringify(createBody)}`)

    // ── 2. Poll until terminal state ──────────────────────────────────────────
    const deadline = Date.now() + POLL_TIMEOUT_MS

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS)

      let task: {
        status: 'PENDING' | 'THROTTLED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
        output?: string[]
        failure?: string
        failureCode?: string
      }

      try {
        const pollRes = await fetch(`${BASE}/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${this.apiKey}`, 'X-Runway-Version': VERSION },
        })
        if (!pollRes.ok) {
          // Transient HTTP error — keep polling
          console.warn(`[runway] poll HTTP ${pollRes.status} for task ${taskId}, retrying`)
          continue
        }
        task = await pollRes.json()
      } catch (err) {
        // Network hiccup — keep polling
        console.warn(`[runway] poll error for task ${taskId}:`, err)
        continue
      }

      switch (task.status) {
        case 'SUCCEEDED': {
          const url = task.output?.[0]
          if (!url) throw new Error(`Runway task ${taskId} succeeded but output is empty`)
          return url
        }
        case 'FAILED':
        case 'CANCELLED':
          throw new Error(
            `Runway task ${taskId} ${task.status}` +
            (task.failure ? `: ${task.failure}` : '') +
            (task.failureCode ? ` (${task.failureCode})` : '')
          )
        // PENDING | THROTTLED | RUNNING → keep waiting
      }
    }

    throw new Error(`Runway task ${taskId} timed out after ${POLL_TIMEOUT_MS / 1000}s`)
  }
}
