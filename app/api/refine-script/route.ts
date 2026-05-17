import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  const { script, instruction, niche, tone } = await req.json()

  if (!script || !instruction) {
    return NextResponse.json({ error: 'Missing script or instruction' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are a high-retention TikTok script editor. Apply the instruction below while keeping the script in the HIGH-RETENTION format defined here.

Niche: ${niche || 'General'}
Tone: ${tone || 'Confident'}
Instruction: ${instruction}

HIGH-RETENTION FORMAT RULES — maintain these in every edit:
- Sentences: 5 to 10 words max. Fragments are fine and preferred.
- Zero filler words: no "basically", "literally", "actually", "so", "you know"
- Zero Gen Z slang: no "bestie", "no cap", "fr", "hits different", "vibe"
- Pattern interrupt every 2-3 lines: a short question, a reversal, a single sharp word
- Emotional triggers: urgency, curiosity, ego, or validation woven in naturally
- Specific numbers and verifiable facts only — never invent statistics or citations
- CTA must be comment-based ("Drop a 1 if this helped", "Save this", "Comment [word] below") — never "follow me", never "I'll send you" or "I'll reply" — no promises of a personal response
- Tone: confident, slightly aggressive, high energy — sounds like a real person

Current script:
${script}

Return ONLY the refined script text. No JSON, no explanation, no labels — just the script.`,
    }],
  })

  const refined = message.content[0].type === 'text' ? message.content[0].text.trim() : script
  return NextResponse.json({ script: refined })
}
