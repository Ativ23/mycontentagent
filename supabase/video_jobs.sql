-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)

create table public.video_jobs (
  id          uuid default gen_random_uuid() primary key,
  package_id  text not null,
  script      text not null,
  audio_url   text not null,
  bg_video_url text,
  status      text not null default 'pending',  -- pending | processing | complete | failed
  video_url   text,
  error       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Index for fast pending-job polling
create index video_jobs_status_created on public.video_jobs (status, created_at asc);

-- Service role can read/write (worker uses service role key)
alter table public.video_jobs enable row level security;
create policy "service role full access" on public.video_jobs
  using (true) with check (true);
