import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  try {
  const { script, niche } = await req.json()

  if (!script) {
    return NextResponse.json({ error: 'Missing script' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a high-retention TikTok content auditor. Analyze this script against 4 checks, then rewrite if it fails any.

Script:
${script}

Niche: ${niche || 'General'}

CHECK 1 — HOOK STRENGTH
PASS: First line is scroll-stopping. Uses accusation, controversy, specific money/result, or strong pattern interrupt. Max 10 words. No filler opener.
FAIL: Generic, starts with "Today"/"In this video"/"Hey guys", or lacks urgency.

CHECK 2 — EMOTIONAL TRIGGERS
PASS: Contains at least 2 of: urgency ("most people never figure this out"), ego ("you've been doing this wrong"), curiosity ("here's the part nobody tells you"), scarcity, or validation.
FAIL: Informational only, no emotional charge.

CHECK 3 — PACING
PASS: Sentences are 5–10 words max. Has at least 2 pattern interrupts (short questions, single-word lines, reversals). No long paragraphs.
FAIL: Long sentences, walls of text, no rhythm variation.

CHECK 4 — HUMAN FEEL
PASS: Sounds like a confident person talking directly to one viewer. No corporate language, no Gen Z slang overload, no AI filler phrases.
FAIL: Sounds scripted, stiff, or uses "bestie/no cap/literally/basically/utilize/leverage".

Return ONLY valid JSON:
{
  "checks": {
    "hook":     { "passed": true, "note": "one short sentence" },
    "triggers": { "passed": true, "note": "one short sentence" },
    "pacing":   { "passed": true, "note": "one short sentence" },
    "human":    { "passed": true, "note": "one short sentence" }
  },
  "improved": false,
  "script": "original script here if all passed"
}

If ANY check fails: set improved=true and put a fully rewritten script in "script" that passes all 4 checks. Keep the same topic and verifiable facts. Rules: sentences 5–10 words max, 2+ pattern interrupts, 2+ emotional triggers, comment-based CTA ("Drop a 1 if this helped", "Save this") — never promise to send or reply, no filler, no slang, confident direct tone, 110–130 words total.`,
    }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const result = JSON.parse(jsonMatch?.[0] ?? raw)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to parse enhancement result' }, { status: 500 })
  }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Script enhancement failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
