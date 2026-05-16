-- Run in Supabase SQL Editor → New Query

create table if not exists public.tiktok_tokens (
  id            uuid default gen_random_uuid() primary key,
  user_id       text not null unique,           -- 'default' for single-user setup
  access_token  text not null,
  refresh_token text not null,
  open_id       text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz default now()
);

alter table public.tiktok_tokens enable row level security;

create policy "service role full access" on public.tiktok_tokens
  using (true) with check (true);
