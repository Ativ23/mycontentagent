-- Run in Supabase SQL Editor → New Query

create table if not exists public.content_packages (
  id          uuid default gen_random_uuid() primary key,
  niche       text not null,
  title       text not null,
  hook        text not null,
  script      text not null,
  caption     text not null,
  hashtags    text not null,
  audio_url   text,
  video_url   text,
  status      text default 'saved',
  created_at  timestamptz default now()
);

-- Speed up library queries (newest first)
create index if not exists content_packages_created_idx on public.content_packages (created_at desc);

-- Row-level security: service role has full access, anon key can read
alter table public.content_packages enable row level security;

create policy "service role full access" on public.content_packages
  using (true) with check (true);
