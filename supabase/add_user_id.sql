-- Migration: add user_id to content_packages and video_jobs
-- Safe to re-run (IF NOT EXISTS / DROP IF EXISTS throughout).
-- Run in Supabase Dashboard > SQL Editor > New query

-- ============================================================
-- content_packages
-- ============================================================

alter table public.content_packages
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists content_packages_user_id_idx
  on public.content_packages (user_id, created_at desc);

-- Remove the old open policy that allowed all clients full access
drop policy if exists "service role full access" on public.content_packages;

-- Users can only read/write their own rows.
-- The service role key (used by the worker and getSupabaseAdmin()) bypasses
-- RLS automatically in Supabase - no policy change needed for the worker.
create policy "users_own_packages" on public.content_packages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- video_jobs
-- ============================================================

alter table public.video_jobs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists video_jobs_user_id_idx
  on public.video_jobs (user_id, created_at desc);

-- Remove the old open policy
drop policy if exists "service role full access" on public.video_jobs;

-- Users can only read/write their own jobs.
-- The worker (service role) bypasses this automatically.
create policy "users_own_jobs" on public.video_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
