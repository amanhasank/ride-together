# 🏍️ RideTogether

Share a single **live map** with your group — bikers, cyclists, road trips, or friends on the move. One person creates a ride, shares a link/QR, and everyone appears on the same map in real time. **No app install. No accounts.**

Built with **Next.js (App Router) · TypeScript · Tailwind · Supabase Realtime · Google Maps**.

---

## How it works (architecture)

The design keeps cost and latency low even at 100+ concurrent riders by splitting traffic by frequency:

| Concern | Transport | Why |
|---|---|---|
| High-frequency GPS pings | **Supabase Realtime Broadcast** | Ephemeral fan-out, *no* DB writes per tick |
| Who's currently online | **Supabase Realtime Presence** | Accurate live/offline without polling |
| Durable ride config + roster | **Postgres + `postgres_changes`** | Survives reload/reconnect; late joiners hydrate |
| "Last known location" | Postgres (written ≤ every 15s) | Restores positions after disconnect |

Location is broadcast peer-to-peer through the channel; the database only stores a periodic snapshot. Stale data is auto-purged (see `ridetogether_cleanup()`), so there's **no permanent location history**.

```
Browser (watchPosition)
   │  throttled ping (~3s)
   ▼
Supabase Realtime channel  ──broadcast──►  all riders' maps
   │  snapshot ≤15s
   ▼
Postgres (rides, participants)  ──postgres_changes──►  roster + config sync
```

## Features

- **Landing / Create / Join** flows, mobile-first, dark mode, PWA-installable
- **Live map** with smooth markers, heading arrows, live/recent/stale/offline status, last-seen times
- **Shared destination + route** (Google Directions) with per-rider distance & ETA
- **Participant panel** sorted by proximity to destination
- **Leader controls**: rename, set/clear destination on map, lock/unlock, remove riders, end ride
- **Invite**: QR code, copy link, native share sheet
- **Reconnection**: auto-resumes on focus, re-hydrates roster, recovers session from `localStorage`
- **Privacy**: location only shared during an active ride; leaving deletes your participant row
- **Follow-leader**, recenter, compass heading, speed estimation

---

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`supabase/schema.sql`](./supabase/schema.sql).
3. **Project Settings → API** → copy the **Project URL** and **anon public** key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. (Optional) Enable `pg_cron` and schedule cleanup:
   ```sql
   select cron.schedule('ridetogether-cleanup','*/15 * * * *',
     $$ select public.ridetogether_cleanup(); $$);
   ```

### 3. Google Maps

1. In [Google Cloud Console](https://console.cloud.google.com), enable **Maps JavaScript API** + **Directions API**.
2. Create a **browser API key**, restrict it by HTTP referrer in production.
3. (Optional) Create a **Map ID** (Maps → Map Management) for Advanced Markers + styling.
4. Add to `.env.local`:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
   NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=...        # optional
   NEXT_PUBLIC_APP_URL=http://localhost:3000 # used for share links/QR
   ```

### 4. Run

```bash
npm run dev        # http://localhost:3000
npm run build && npm start   # production
```

> Geolocation in browsers requires a **secure context**. `localhost` works; on a LAN/phone use HTTPS (e.g. `vercel dev`, a tunnel, or deploy).

---

## Deploy (Vercel)

1. Push to GitHub, import into Vercel.
2. Add the four `NEXT_PUBLIC_*` env vars in Project Settings.
3. Set `NEXT_PUBLIC_APP_URL` to your production domain (so QR/share links are correct).
4. Deploy. The included `public/manifest.json` + `public/sw.js` make it installable as a PWA.

> Add PNG icons at `public/icons/icon-192.png` and `public/icons/icon-512.png` for the install prompt.

---

## Project structure

```
src/
  app/
    layout.tsx            # theme bootstrap, PWA meta, SW registration
    page.tsx              # landing
    create/page.tsx       # create ride (leader)
    ride/[id]/page.tsx     # gate: load → join | room | ended
  components/
    RideRoom.tsx          # the live room (map + panels + controls)
    MapView.tsx           # Google map, markers, route, camera
    ParticipantPanel.tsx  # roster sorted by proximity, ETA, status
    InviteSheet.tsx       # QR + copy + native share
    LeaderControls.tsx    # rename / destination / lock / end
    JoinForm.tsx · ColorPicker · ThemeProvider · ...
  hooks/
    useGeolocation.ts     # throttled watchPosition, permission, resume-on-focus
    useRideChannel.ts     # broadcast + presence + postgres_changes + reconnect
  lib/
    ride.ts · supabase.ts · session.ts · geo.ts · types.ts
supabase/
  schema.sql              # tables, RLS, realtime publication, cleanup fn
  hardened.sql            # secure-mode: lock RLS, ownership RPCs, rate limit, cron
  config.toml             # function settings (verify_jwt=false)
  functions/              # Deno Edge Functions: create-ride, join-ride, ride-action
```

---

## Production hardening (secure mode)

The repo ships in two modes, toggled by `NEXT_PUBLIC_SECURE_MODE`:

| | `false` (default) | `true` (production) |
|---|---|---|
| Privileged writes | Direct to Postgres under permissive RLS | **Edge Functions** (service role) |
| Leader authority | Enforced client-side only | `leader_token` validated **server-side** |
| Location updates | Direct row update | `update_my_location` RPC (ownership-checked) |
| Rate limiting | none | `rl_hit` sliding window in `create`/`join` |
| RLS | read + write open | **read-only** for anon |

### Enable secure mode

1. **Apply hardened schema** — after `schema.sql`, run [`supabase/hardened.sql`](./supabase/hardened.sql). This drops anon write policies, adds the ownership RPCs (`update_my_location`, `leave_ride`), the rate-limit table + `rl_hit`, and schedules cleanup via `pg_cron` (enable the extension first under Database → Extensions).

2. **Deploy the Edge Functions** (Deno):
   ```bash
   supabase link --project-ref <your-ref>
   supabase functions deploy create-ride join-ride ride-action
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key> ALLOWED_ORIGIN=https://your-domain.com
   ```
   `verify_jwt = false` is already set per-function in `supabase/config.toml` (these endpoints are intentionally public; authority comes from the ride code + `leader_token`).

3. **Flip the flag** — set `NEXT_PUBLIC_SECURE_MODE=true` and redeploy the frontend.

> The client code path is identical in both modes (`src/lib/ride.ts` branches internally), so you can develop against `false` and ship `true`.

## Security notes

- No accounts: rides are protected by **unguessable codes** + per-device **session tokens**; the **leader token** is held only by the creator and (in secure mode) checked server-side on every privileged action.
- The `service_role` key lives **only** in the Edge Function runtime via `supabase secrets` — it is never shipped to the browser (only `NEXT_PUBLIC_*` vars are).
- Restrict the **Google Maps key by HTTP referrer** (Cloud Console → Credentials) and the **Supabase project by allowed origins**. Both are console-only steps.
- `geolocation` is restricted to same-origin via the `Permissions-Policy` header in `vercel.json`.

## Scaling to 100+ riders

- GPS pings ride Broadcast, not DB writes → constant DB load regardless of update rate.
- `eventsPerSecond` is capped (see `lib/supabase.ts`) and client pings are throttled to ~3s.
- For very large rides, raise Supabase Realtime quotas and consider regional channels.
```
# ride-together
# ride-together
