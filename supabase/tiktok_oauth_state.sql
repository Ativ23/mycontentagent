-- Run in Supabase SQL Editor → New Query
-- Single-row table used for server-side OAuth CSRF state validation.
-- Row id=1 is upserted at auth start and deleted after callback completes.

create table if not exists public.tiktok_oauth_state (
  id         int primary key default 1,         -- always exactly one row
  state      text not null,
  created_at timestamptz default now()
);

-- Enforce single-row constraint
alter table public.tiktok_oauth_state
  add constraint tiktok_oauth_state_single_row check (id = 1);

alter table public.tiktok_oauth_state enable row level security;

create policy "service role full access" on public.tiktok_oauth_state
  using (true) with check (true);
