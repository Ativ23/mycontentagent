import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { getSupabaseAdmin } from '@/lib/supabase'

const NICHE_RULES: Record<string, string> = {
  'Beauty & Skincare': `
- Focus on specific products with TikTok Shop affiliate potential (serums, SPFs, cleansers, treatments)
- Mention before/after results, ingredient benefits, or price comparisons
- Authentic and relatable beats salesy — speak like a friend sharing a find`,
  'Personal Finance': `
- No guaranteed income claims — focus on real, actionable strategies and tools
- Mention specific apps, accounts, or methods beginners can start today
- Speak like a knowledgeable friend, never a financial advisor`,
  'Fitness & Health': `
- Use transformation angles — before/after, week 1 vs week 8, mistake reveals
- Specific exercises, macros, or supplement recommendations add credibility
- Supplement affiliate programs and fitness apps are the primary monetization`,
  'Tech & Gadgets': `
- Focus on Amazon affiliate potential — specific product recommendations with price context
- "Under $50", "This changed everything", "You need this" angles drive clicks
- Unboxing and demo formats convert highest`,
  'Home & Kitchen': `
- Kitchen gadgets and organisation products are the #1 TikTok Shop category
- Show the problem first, then the product as the solution
- Price anchoring ("only $X on Amazon") increases conversions`,
  'Fashion & Style': `
- Outfit reveals, dupes, and "get the look for less" angles perform best
- TikTok Shop fashion hauls earn 10–20% commissions
- Fast fashion and affordable styling content reaches the widest audience`,
  'Relationships': `
- Red flags, green flags, attachment styles, and dating advice drive massive engagement
- High-emotion and relatable topics get shared — make it feel like validation
- Sell coaching, guides, or courses via link in bio`,
  'Food & Recipes': `
- Quick visually satisfying recipes under 60 seconds
- Kitchen tool and ingredient affiliate links perform well
- Viral food trends and "I tried the viral X" hooks get massive reach`,
  'Pet Content': `
- Pet product TikTok Shop (food, toys, supplements) earns 10–15% commissions
- Emotional, funny, or heartwarming pet content goes viral easily
- Product recommendations feel organic when tied to a pet's story`,
  'Digital Products': `
- Creators sell their own products (Notion templates, courses, guides) at 100% margin
- "How I make money without a job" and income-report formats drive massive traffic
- Tease the value, hold back the full method — drive to link in bio
- NEVER use fake income claims like "I made $3,000/day" — keep it realistic`,
}

const VARIATION_SEEDS = [
  'confession + fix: creator admits a mistake they made for years and reveals the correction',
  'insider gatekeep reveal: something most people don\'t know that directly benefits them',
  'myth bust / unpopular opinion: challenges widely-held conventional advice',
  '"I tried it for you" experiment: creator tested something so the viewer doesn\'t have to — with real results',
  'income/results transparency: specific numbers, timelines, and what actually worked vs what didn\'t',
  'pattern recognition: "if you do X, here\'s what it really means" — validation and insight',
  'comparison reveal: cheap vs expensive, before vs after, wrong way vs right way — with specifics',
  'root cause reveal: the REAL reason why something isn\'t working (not what people assume)',
  '"nobody talks about this" format: underrated tip, tool, or strategy that\'s still wide open',
  'transformation timeline: specific result over specific timeframe with the exact method used',
  'warning / stop doing this: urgent framing around a common costly mistake',
  'step-by-step micro-tutorial: 3 fast numbered steps, each 5-8 seconds, zero filler',
]

export async function POST(req: NextRequest) {
  const { niche, tone } = await req.json()

  if (!niche || !tone) {
    return NextResponse.json({ error: 'Missing niche or tone' }, { status: 400 })
  }

  // Fetch recent titles to avoid duplicates
  let avoidSection = ''
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('content_packages')
      .select('title')
      .eq('niche', niche)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data?.length) {
      avoidSection = `\n\nAvoid these already-generated titles — generate fresh angles:\n${data.map((r) => `- ${r.title}`).join('\n')}`
    }
  } catch { /* non-fatal */ }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const seed = VARIATION_SEEDS[Math.floor(Math.random() * VARIATION_SEEDS.length)]
  const nicheRules = NICHE_RULES[niche] ?? ''

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a TikTok content strategist who studies what goes viral every day. Today is ${today}.

Generate exactly 5 fresh, high-virality TikTok video ideas for the niche: "${niche}" with a ${tone} tone.

Primary format theme for this batch: ${seed}
Apply this theme across all 5 ideas — vary the specific angles and hooks.

${nicheRules}${avoidSection}

Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "title": "short punchy title (under 10 words)",
    "hook": "the first spoken line — maximum 10 words, grabs in 2 seconds",
    "angle": "the specific content approach and what makes this video worth watching"
  }
]

HOOK RULES (every idea must follow these):
- Maximum 10 words — if it takes longer to read, cut it
- Uses ONE of these proven viral hook patterns:
  • Confession: "I spent [time] doing [X] wrong. Here's the fix."
  • Insider reveal: "[Specific entity] is paying/doing [surprising specific thing]."
  • Myth bust: "Unpopular opinion: [common advice] is why you're not [result]."
  • Warning: "Stop [doing X] right now. It's costing you [specific amount/result]."
  • Transparency: "Here's exactly how much I [made/lost/saved] doing [X] in [timeframe]."
- Uses SPECIFIC numbers, names, or dollar amounts — never vague claims
- Bold and direct — not a question, not generic
- Never starts with: "What if", "Imagine", "Did you know", "Here's how", "Hey guys"

QUALITY BAR: Each idea must be specific enough that a viewer immediately knows EXACTLY what they'll learn and why it matters to them right now.`,
    }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    const ideas = JSON.parse(jsonMatch?.[0] ?? raw)
    return NextResponse.json({ ideas })
  } catch {
    return NextResponse.json({ error: 'Failed to parse ideas from AI response' }, { status: 500 })
  }
}
