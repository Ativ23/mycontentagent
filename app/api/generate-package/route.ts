import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { getAuthUser } from '@/lib/supabase-server'

const NICHE_RULES: Record<string, string> = {
  'Beauty & Skincare': `
NICHE RULES:
- Name the specific product, ingredient, or technique — never generic ("this serum" not "a product")
- Use friend-sharing tone: "I've been using X for 3 weeks and here's what happened"
- Specificity wins: "$18 at Target" > "affordable", "retinol 0.5%" > "anti-aging ingredient"
- CTA: "TikTok Shop link in bio" or "linked in bio" — drive to purchase, not just follow

VIRAL FORMATS THAT WORK:
- "I stopped using [X] and here's what happened to my skin in 30 days" (transformation reveal)
- "This $12 product does what my $80 serum couldn't" (comparison with specific prices)
- "Dermatologists don't want you knowing this ingredient combo" (insider gatekeep)`,

  'Personal Finance': `
NICHE RULES:
- Use REAL specific numbers: "$340/month", "0.01% vs 4.75% APY", "saved $2,400 in 6 months"
- Name real platforms: Marcus by Goldman Sachs, YNAB, Fidelity, Robinhood, Discover it
- Never vague: "save more" is dead. "Automate $50/week to a HYSA" is alive
- No guaranteed income or returns — speak like a knowledgeable friend, not a financial advisor
- CTA: comment-based drives MORE reach than "follow me" — use "drop a 1 if this hit different" or "save this"

VIRAL FORMATS THAT WORK:
- Confession + fix: "I spent 3 years thinking I was bad with money. Turns out I was only doing ONE thing wrong."
- Myth bust: "Unpopular opinion: your savings rate isn't the problem. Your income strategy is."
- Insider reveal: "Your bank is paying you 0.01% interest. Inflation is 3%. Here's the switch I made."`,

  'Fitness & Health': `
NICHE RULES:
- Specific beats vague: "lost 11 lbs in 6 weeks" > "lost weight", "30g protein at breakfast" > "eat more protein"
- Name real products, apps, or workouts — not generic "a supplement" or "some exercises"
- Transformation angles: week 1 vs week 6, before/after a specific protocol change
- CTA: "comment your goal below" or "drop a 1 if you needed this" — drives engagement without promising replies

VIRAL FORMATS THAT WORK:
- "I've been doing this ONE thing for 30 days and here's what changed" (specific habit reveal)
- "The gym mistake I made for 2 years that killed my results" (mistake confession)
- "Nobody's talking about this [exercise/method] and it's why most people plateau" (gatekeep)`,

  'Tech & Gadgets': `
NICHE RULES:
- Always name the product AND the price: "the Anker 737, $80 on Amazon"
- Lead with the problem, then reveal the product as the solution
- "Under $50", "I returned my MacBook for this", "replaced 3 devices" angles drive clicks
- CTA: "link in bio" or "Amazon link in bio" with urgency — "price goes up constantly"

VIRAL FORMATS THAT WORK:
- "I spent $[X] testing every [category] on Amazon so you don't have to. Here are the only 2 worth it." (I tried it for you)
- "This $[X] [product] does what [expensive alternative] does for 10x less" (comparison reveal)
- "I almost returned this. Then I found the hidden feature." (unexpected twist)`,

  'Home & Kitchen': `
NICHE RULES:
- Show the problem BEFORE the product — make viewers relate to the frustration first
- Price anchor every product: "only $16 on Amazon" increases impulse decision
- Kitchen gadgets and storage products are TikTok Shop's #1 category
- CTA: "Amazon link in bio" or "TikTok Shop link" — always point to purchase

VIRAL FORMATS THAT WORK:
- "I threw out everything in my kitchen and only kept these 5 things" (ruthless curation)
- "This $14 Amazon find solved a problem I've had for 3 years" (specific problem + price)
- "Stop buying [common item] at the grocery store. This is cheaper and lasts longer." (contrarian tip)`,

  'Fashion & Style': `
NICHE RULES:
- Name brands and prices — "Zara trousers, $45" not "some pants I found"
- Dupe reveals, "get the look for less", and outfit breakdowns drive the highest saves
- TikTok Shop fashion earns 10-20% commissions — lean into "shop this look" CTA
- CTA: "Shop my TikTok" or "full outfit breakdown in bio"

VIRAL FORMATS THAT WORK:
- "I bought 10 things from [brand] and only kept 2. Here's which ones." (honest haul)
- "$30 [brand] dupe for $200 [luxury brand] — I'm not kidding" (dupe reveal with prices)
- "This one outfit formula works for every body type. Here it is." (universal value)`,

  'Relationships': `
NICHE RULES:
- Make viewers feel SEEN before delivering the insight — start from their pain point
- High-emotion and validation content gets shared more than advice
- Red flags, green flags, attachment styles, "this is why you keep attracting [X]" all go viral
- CTA: "comment your situation below" or "drop a 1 if this is you" — drives replies without promising a personal response

VIRAL FORMATS THAT WORK:
- "I used to think [X about relationships] until I realized this." (mindset shift reveal)
- "If someone does this, it's a green flag most people miss." (insider pattern recognition)
- "This is why you keep attracting [unavailable people / narcissists / the wrong ones]." (root cause reveal)`,

  'Food & Recipes': `
NICHE RULES:
- 3-5 steps MAX — any longer and completion rate drops below 50%
- Specific and visual: "1 cup arborio rice" not "some rice", "caramelized until deep amber" not "cooked"
- Trending formats: viral food recreations, 5-ingredient meals, $5 meals that taste like $50
- CTA: "comment 'recipe' if you want this" or "save this before you forget" — drives engagement without promising DMs

VIRAL FORMATS THAT WORK:
- "I made [viral restaurant dish] at home for $8. Here's exactly how." (viral recreation)
- "The only [dish] recipe you'll ever need. 4 ingredients." (definitive simplicity)
- "I tried the TikTok [food trend]. Here's the honest verdict." (trend reaction)`,

  'Pet Content': `
NICHE RULES:
- Connect every tip or product to a real, specific pet owner pain point — "my dog was scratching constantly until..."
- Warm and authentic beats clinical — this is TikTok, not a vet visit
- Pet product TikTok Shop (food, toys, supplements, grooming) earns 10-15% commissions
- CTA: "TikTok Shop link in bio" or "Amazon storefront in bio" — show the product, link the product

VIRAL FORMATS THAT WORK:
- "My vet told me to stop buying [common product]. Here's what to use instead." (authority + insider reveal)
- "3 signs your dog is [stressed / bored / in pain] that most owners miss" (pattern recognition)
- "I spent $[X] testing every [category] on Amazon for my [pet]. These are the only ones worth it." (I tried it for you)`,

  'Digital Products': `
NICHE RULES:
- Tease the full method without giving it away — "here's the framework" not the framework itself
- Use realistic income framing: "my first $300 month" not "I make $10K/month" — credibility wins
- Sell the transformation, not the product: "how I went from nothing to [specific result]"
- CTA: "link in bio for the free [template / guide / checklist]" — free lead magnet converts better than paid first

VIRAL FORMATS THAT WORK:
- "Here's every income stream I have and exactly how much each one made last month." (income transparency)
- "I built a $[X]/month digital product business with zero following. Here's the honest breakdown." (I tried it for you)
- "The reason your digital products aren't selling has nothing to do with the product." (myth bust)`,
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
  const { idea, niche, tone } = await req.json()

  if (!idea || !niche || !tone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const nicheRules = NICHE_RULES[niche] ?? ''

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are an expert TikTok scriptwriter who studies viral content daily. Today is ${today}.

Write a complete TikTok content package for this idea:
Title: ${idea.title}
Hook: ${idea.hook}
Angle: ${idea.angle}
Niche: ${niche}
Tone: ${tone}

${nicheRules}

Return ONLY a valid JSON object with this exact structure, no other text:
{
  "script": "the full spoken script",
  "caption": "TikTok caption under 150 characters",
  "hashtags": "10-15 relevant hashtags as a single string starting with #"
}

HIGH-RETENTION TIKTOK SCRIPT RULES — follow every rule exactly:

STRUCTURE:
1. HOOK (0-3s): Maximum 10 words. Scroll-stopping. Controversial, curiosity-driven, or money/results-based.
2. PATTERN INTERRUPT (3-6s): Immediately challenge or destabilize the viewer's assumption. One short punch.
3. BODY (6-38s): Short punchy sentences — 5 to 10 words max each. Add a pattern interrupt every 2-3 lines (a question, a reversal, a single word like "Stop." or "Wait."). 3 fast beats of value.
4. TWIST (38-43s): One line that reframes everything — the payoff the viewer stayed for.
5. CTA (43-48s): Comment-based CTA only ("Drop a 1 if this helped", "Save this", "Comment [word] below") — NOT "follow me", NOT "I'll send you" or "I'll reply". Never promise a personal response. Feels natural, not scripted.

SENTENCE RULES — non-negotiable:
- Every sentence: 5 to 10 words MAX. No exceptions.
- Short fragments are good. "Not science." "Zone 1. The whole time." are perfect.
- Zero filler: cut "basically", "literally", "actually", "so", "you know", "kind of"
- No Gen Z slang: no "bestie", "no cap", "fr", "hits different", "vibe", "slay"
- No corporate language: no "leverage", "optimize", "utilize", "synergy"
- Specific numbers only: "$340" not "hundreds". "27 days" not "about a month"
- Only verifiable facts — never invent studies, statistics, or citations
- TARGET LENGTH: 110 to 130 words total. That reads at 45-55 seconds. Cut ruthlessly to hit this.

EMOTIONAL TRIGGERS — use at least 3:
- Urgency: "Most people never figure this out."
- Ego: "You've been doing this wrong."
- Curiosity: "Here's the part nobody says out loud."
- Scarcity: "This won't work once everyone knows it."
- Validation: "If you've been frustrated, this is why."

TONE: Confident. Slightly aggressive. High energy. Sounds like a real person, not an AI.

HOOK PATTERNS — use one:
- Accusation: "You've been lied to about [X]."
- Controversy: "[Common belief] is the reason you're failing."
- Transparency: "I [made/lost/discovered] [specific thing]. Here's exactly how."
- Warning: "Stop [doing X]. It's costing you [specific consequence]."
- Never start with: "What if", "Imagine", "Did you know", "Here's how", "Hey guys"`,
    }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const pkg = JSON.parse(jsonMatch?.[0] ?? raw)
    return NextResponse.json(pkg)
  } catch {
    return NextResponse.json({ error: 'Failed to parse content package from AI response' }, { status: 500 })
  }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Script generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
