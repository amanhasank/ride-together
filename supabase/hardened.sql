-- ============================================================================
-- RideTogether — PRODUCTION HARDENING
-- Run AFTER schema.sql. Pairs with NEXT_PUBLIC_SECURE_MODE=true + Edge Functions.
--
-- What this does:
--   * Removes anonymous write access to rides/participants (reads stay open).
--   * Routes all privileged writes through Edge Functions (service role) OR
--     two ownership-checked RPCs for the high-frequency self-service paths.
--   * Adds an atomic sliding-window rate limiter (rl_hit) used by Edge Functions.
--   * Schedules automatic cleanup via pg_cron (no permanent location history).
-- ============================================================================

-- ── 1. Lock down direct writes ──────────────────────────────────────────────
-- Keep open SELECT (codes are unguessable); drop the permissive write policies.
drop policy if exists "rides insertable"        on public.rides;
drop policy if exists "rides updatable"         on public.rides;
drop policy if exists "participants insertable" on public.participants;
drop policy if exists "participants updatable"  on public.participants;
drop policy if exists "participants deletable"  on public.participants;

-- Reads remain (recreate idempotently in case schema.sql versions differ).
drop policy if exists "rides readable" on public.rides;
create policy "rides readable" on public.rides for select using (true);
drop policy if exists "participants readable" on public.participants;
create policy "participants readable" on public.participants for select using (true);

-- After this, the anon role can ONLY read. All writes go through service-role
-- Edge Functions or the SECURITY DEFINER functions below.

-- ── 2. Ownership-checked self-service RPCs ──────────────────────────────────
-- High-frequency location updates shouldn't pay Edge Function cold-start cost,
-- so they run as security-definer functions that verify the caller owns the row
-- via their secret session_token.

create or replace function public.update_my_location(
  p_id uuid,
  p_token text,
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null,
  p_speed double precision default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.participants
     set lat = p_lat,
         lng = p_lng,
         heading = p_heading,
         speed = p_speed,
         last_seen = now()
   where id = p_id
     and session_token = p_token;
end; $$;

create or replace function public.leave_ride(
  p_id uuid,
  p_token text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.participants
   where id = p_id and session_token = p_token;
end; $$;

-- Allow anon to execute only these two functions.
revoke all on function public.update_my_location(uuid, text, double precision, double precision, double precision, double precision) from public;
grant execute on function public.update_my_location(uuid, text, double precision, double precision, double precision, double precision) to anon, authenticated;
revoke all on function public.leave_ride(uuid, text) from public;
grant execute on function public.leave_ride(uuid, text) to anon, authenticated;

-- ── 3. Rate limiter (atomic sliding window) ─────────────────────────────────
create table if not exists public.ratelimit (
  key         text primary key,
  count       integer not null default 0,
  window_start timestamptz not null default now()
);
alter table public.ratelimit enable row level security;
-- No policies → anon cannot touch it directly; only service role / definer fn.

-- Returns true if the hit is allowed, false if the limit is exceeded.
create or replace function public.rl_hit(p_key text, p_max integer, p_window integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.ratelimit%rowtype;
begin
  insert into public.ratelimit(key, count, window_start)
    values (p_key, 1, now())
  on conflict (key) do update
    set count = case
                  when public.ratelimit.window_start < now() - make_interval(secs => p_window)
                  then 1
                  else public.ratelimit.count + 1
                end,
        window_start = case
                  when public.ratelimit.window_start < now() - make_interval(secs => p_window)
                  then now()
                  else public.ratelimit.window_start
                end
  returning * into rec;
  return rec.count <= p_max;
end; $$;

grant execute on function public.rl_hit(text, integer, integer) to service_role;

-- ── 4. Scheduled cleanup (pg_cron) ──────────────────────────────────────────
-- Enable pg_cron once: Dashboard → Database → Extensions → enable "pg_cron".
create extension if not exists pg_cron;

-- Extend cleanup to also prune the rate-limit table.
create or replace function public.ridetogether_cleanup()
returns void language plpgsql as $$
begin
  delete from public.participants where last_seen < now() - interval '30 minutes';
  delete from public.rides
   where (status = 'ended' and ended_at < now() - interval '2 hours')
      or (created_at < now() - interval '12 hours');
  delete from public.ratelimit where window_start < now() - interval '10 minutes';
end; $$;

-- Schedule every 15 minutes (idempotent: unschedule a prior job of same name first).
do $$
begin
  perform cron.unschedule('ridetogether-cleanup')
    where exists (select 1 from cron.job where jobname = 'ridetogether-cleanup');
exception when others then null;
end $$;

select cron.schedule(
  'ridetogether-cleanup',
  '*/15 * * * *',
  $$ select public.ridetogether_cleanup(); $$
);
