# 🎬 StacksMadeSimple — AI TikTok Content Engine

> **Turn any topic into a fully produced TikTok video in under 2 minutes.**  
> Live at → [stacksmadesimple.xyz](https://stacksmadesimple.xyz)

---

## The Problem It Solves

Creating consistent TikTok content is a full-time job:
- Writing scripts takes 30–60 minutes per video
- Recording voiceovers requires equipment and retakes
- Editing captions and syncing audio is tedious
- Doing this 3× a day to grow an account is unsustainable

**StacksMadeSimple automates the entire pipeline** — from idea to finished video — using AI at every step.

---

## What It Does

1. **Generates script ideas** based on your niche (finance, fitness, productivity, etc.)
2. **Writes a punchy TikTok script** using Claude AI (Anthropic)
3. **Produces a voiceover** using ElevenLabs text-to-speech
4. **Renders a complete vertical video** with:
   - Animated word-by-word captions (synced to the audio)
   - Ken Burns zoom effect on background images
   - Key words highlighted in red, active word highlighted in yellow
   - Background photos sourced from Pexels
5. **Stores everything** in a content library you can browse and re-generate

---

## Architecture — How It Actually Works

```
User clicks "Generate Video"
        ↓
Next.js API route — inserts a job into Supabase database
        ↓
GitHub Actions worker — fires every 60 seconds
        ↓
Worker claims the job, renders video using Remotion + Chrome headlessly
        ↓
Rendered MP4 uploaded to Supabase Storage
        ↓
Frontend polls every 3 seconds → video appears automatically
```

This is a real **async job queue pattern** — the same architecture used by companies like YouTube, Figma, and Canva for heavy background processing.

---

## Tech Stack

| Layer | Technology | What it does |
|-------|-----------|--------------|
| Frontend | Next.js 16 (App Router) | React-based UI, deployed on Vercel |
| Database | Supabase (PostgreSQL) | Stores scripts, packages, job queue |
| File Storage | Supabase Storage | Hosts audio files and rendered videos |
| AI — Scripts | Anthropic Claude API | Generates and refines TikTok scripts |
| AI — Voice | ElevenLabs TTS | Converts scripts to realistic voiceovers |
| Video Rendering | Remotion + React | Renders animated video compositions |
| Background Worker | GitHub Actions | Processes video jobs every 60 seconds |
| Background Images | Pexels API | Fetches relevant portrait-mode photos |
| Deployment | Vercel (frontend) + GitHub (worker) | Continuous deployment |

---

## Key Features

- **Full async pipeline** — video generation never blocks the UI; jobs queue in Supabase and render in the background
- **Word-level caption sync** — captions use ElevenLabs timestamp data to highlight exactly the right word at the right time
- **Ken Burns motion** — static background images get a slow zoom + pan so videos never look like slideshows
- **AI word highlighting** — Claude picks the 6-8 highest-impact words per script and renders them in red
- **Content library** — all generated packages (script + audio + video) are stored and re-accessible
- **React-based video** — video compositions are written in React/JSX using [Remotion](https://remotion.dev), making them easy to modify

---

## Project Structure

```
mycontentagent/
├── app/
│   ├── api/                    # Backend API routes (Next.js)
│   │   ├── generate-ideas/     # Claude generates topic ideas
│   │   ├── generate-package/   # Creates a full content package
│   │   ├── generate-voiceover/ # ElevenLabs TTS call
│   │   ├── generate-video/     # Queues video render job
│   │   └── generate-video/status/ # Polls job status
│   ├── generator/              # Main content creation page
│   ├── library/                # Browse past content packages
│   └── dashboard/              # Overview stats
├── remotion/
│   ├── Root.tsx                # Registers video compositions
│   ├── TikTokVideo.tsx         # Main video layout + Ken Burns
│   └── CaptionPage.tsx         # Animated word-by-word captions
├── worker/
│   └── index.ts                # Background job processor
├── .github/workflows/
│   └── video-worker.yml        # GitHub Actions: runs worker every minute
└── supabase/
    └── video_jobs.sql          # Database migration
```

---

## Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/Ativ23/mycontentagent.git
cd mycontentagent

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Fill in your API keys — see .env.local.example for the list

# 4. Run the development server
npm run dev
# → http://localhost:3000

# 5. (Optional) Preview video compositions
npm run studio
# → Opens Remotion Studio for live video preview
```

### Required API Keys

| Key | Where to get it |
|-----|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | [supabase.com](https://supabase.com) → Project Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) |
| `PEXELS_API_KEY` | [pexels.com/api](https://www.pexels.com/api/) |

---

## Current Status

✅ Script generation with Claude  
✅ Voiceover with ElevenLabs  
✅ Async video rendering with Remotion  
✅ Word-synced animated captions  
✅ Ken Burns background motion  
✅ Content library  
✅ Live at [stacksmadesimple.xyz](https://stacksmadesimple.xyz)  

---

## Roadmap

- [ ] TikTok OAuth integration (auto-post directly to TikTok)
- [ ] D-ID avatar videos (talking head at 1K followers milestone)
- [ ] Multiple video templates (news-style, listicle, talking head)
- [ ] SaaS tiers ($25 / $59 / $99/month)
- [ ] Analytics dashboard (views, engagement per video)
- [ ] Batch generation (queue 7 days of content at once)

---

## What I Learned Building This

This project taught me things no tutorial covers:

- **Async architecture** — why you can't run FFmpeg/video rendering inside a serverless function, and how to design a proper job queue as the solution
- **API integration at depth** — chaining 5+ APIs (Claude → ElevenLabs → Pexels → Remotion → Supabase) with error handling at each step
- **React for video** — using Remotion to write video animations in React, the same way you'd build a UI component
- **Real debugging** — traced an empty HTTP 500 response back to a Lambda sandbox crash caused by a native addon loading at module scope
- **GitHub Actions as infrastructure** — using CI/CD workflows as a free background job processor instead of paying for a separate server

---

## Built With

- [Next.js](https://nextjs.org/) — React framework
- [Supabase](https://supabase.com/) — Database + Storage
- [Anthropic Claude](https://anthropic.com/) — AI script generation
- [ElevenLabs](https://elevenlabs.io/) — Text-to-speech
- [Remotion](https://remotion.dev/) — Video rendering in React
- [Pexels](https://pexels.com/) — Stock photography
- [Vercel](https://vercel.com/) — Deployment

---

*Building in public. Follow the journey.*
