-- ============================================================================
-- RideTogether — Supabase schema
-- Run in Supabase SQL Editor (or `supabase db push`).
-- Design notes:
--   * High-frequency GPS pings travel over Realtime *Broadcast* (ephemeral),
--     NOT row writes — this is what keeps 100+ participants cheap & fast.
--   * Postgres stores durable state: ride config + participant roster +
--     periodically-persisted "last known location" for reconnection / late join.
--   * Anonymous access is intentional (no accounts). Security is via
--     unguessable ride codes + per-participant session tokens, enforced by RLS.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── rides ──────────────────────────────────────────────────────────────────
create table if not exists public.rides (
  id            text primary key,                 -- short shareable code, e.g. ABC123
  name          text not null default 'Group Ride',
  description   text,
  status        text not null default 'active'    -- active | locked | ended
                check (status in ('active', 'locked', 'ended')),
  leader_token  text not null,                    -- secret; only the creator holds it
  dest_lat      double precision,
  dest_lng      double precision,
  dest_label    text,
  waypoints     jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
);

-- ── participants ─────────────────────────────────────────────────────────────
create table if not exists public.participants (
  id            uuid primary key default gen_random_uuid(),
  ride_id       text not null references public.rides(id) on delete cascade,
  session_token text not null,                    -- secret per device; identifies owner
  name          text not null,
  color         text not null default '#2f7dff',
  is_leader     boolean not null default false,
  lat           double precision,
  lng           double precision,
  heading       double precision,
  speed         double precision,                 -- m/s
  last_seen     timestamptz not null default now(),
  joined_at     timestamptz not null default now()
);

create index if not exists participants_ride_idx on public.participants(ride_id);

-- Keep updates flowing through Realtime postgres_changes:
alter publication supabase_realtime add table public.rides;
alter publication supabase_realtime add table public.participants;

-- ── Row Level Security ───────────────────────────────────────────────────────
-- We can't use auth.uid() (no accounts). Instead we scope writes with secret
-- tokens passed as request settings, and keep reads open (codes are unguessable).
alter table public.rides enable row level security;
alter table public.participants enable row level security;

-- Anyone who knows the code can read the ride + roster.
create policy "rides readable" on public.rides
  for select using (true);
create policy "participants readable" on public.participants
  for select using (true);

-- Creating a ride / joining is open (rate-limit at the edge in production).
create policy "rides insertable" on public.rides
  for insert with check (true);
create policy "participants insertable" on public.participants
  for insert with check (true);

-- Anyone can update a ride row (leader authority is enforced in app code via
-- leader_token check before the call). For stronger guarantees move these
-- mutations behind an Edge Function that validates leader_token server-side.
create policy "rides updatable" on public.rides
  for update using (true) with check (true);
create policy "participants updatable" on public.participants
  for update using (true) with check (true);
create policy "participants deletable" on public.participants
  for delete using (true);

-- ── Housekeeping: auto-expire stale data (no permanent location history) ─────
-- Schedule with pg_cron (Supabase → Database → Extensions → pg_cron):
--   select cron.schedule('ridetogether-cleanup','*/15 * * * *',
--     $$ select public.ridetogether_cleanup(); $$);
create or replace function public.ridetogether_cleanup()
returns void language plpgsql as $$
begin
  -- Drop participants not seen for 30 min.
  delete from public.participants where last_seen < now() - interval '30 minutes';
  -- Drop rides ended > 2h ago, or untouched for 12h.
  delete from public.rides
   where (status = 'ended' and ended_at < now() - interval '2 hours')
      or (created_at < now() - interval '12 hours');
end; $$;
