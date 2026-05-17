-- Migration: add user_id to content_packages and video_jobs
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS throughout.
-- Run in Supabase Dashboard → SQL Editor → New Query

-- ─────────────────────────────────────────────────────────────────────────────
-- content_packages
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.content_packages
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists content_packages_user_id_idx
  on public.content_packages (user_id, created_at desc);

-- Drop the old open policy — it allowed ANY client (including anon) full access.
drop policy if exists "service role full access" on public.content_packages;

-- Users can only read/write their own rows.
-- NOTE: In Supabase, the service role key bypasses RLS automatically — it never
-- goes through these policies. getSupabaseAdmin() in the API routes and the
-- GitHub Actions worker (which use SUPABASE_SERVICE_ROLE_KEY) are unaffected.
create policy "users_own_packages" on public.content_packages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- video_jobs
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.video_jobs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists video_jobs_user_id_idx
  on public.video_jobs (user_id, created_at desc);

-- Drop the old open policy.
drop policy if exists "service role full access" on public.video_jobs;

-- Users can only read/write their own jobs.
-- The worker (service role) bypasses this automatically — no worker changes needed.
create policy "users_own_jobs" on public.video_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
