'use client';

import { track } from '@vercel/analytics';
import { getSupabase } from './supabase';
import {
  generateRideCode,
  randomToken,
  saveSession,
  loadSession,
  type RideSession,
} from './session';
import type { Ride, ParticipantRow, Waypoint } from './types';

/**
 * SECURE_MODE routes all privileged writes through Supabase Edge Functions
 * (service role, leader_token validated server-side) and self-service writes
 * through ownership-checked RPCs. Pair with supabase/hardened.sql.
 *
 * When false (default for quick local dev), writes go directly to Postgres
 * under the permissive policies in supabase/schema.sql.
 */
const SECURE_MODE = process.env.NEXT_PUBLIC_SECURE_MODE === 'true';

function rowToRide(r: any): Ride {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    status: r.status,
    dest_lat: r.dest_lat ?? null,
    dest_lng: r.dest_lng ?? null,
    dest_label: r.dest_label ?? null,
    waypoints: Array.isArray(r.waypoints) ? r.waypoints : [],
    created_at: r.created_at,
    ended_at: r.ended_at ?? null,
  };
}

async function callEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) {
    // Edge Functions return a JSON { error } body on failure.
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      const parsed = ctx && (await ctx.json?.());
      if (parsed?.error) msg = parsed.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

// ── Reads (always direct; RLS allows SELECT) ─────────────────────────────────
export async function getRide(rideId: string): Promise<Ride | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from('rides').select().eq('id', rideId).maybeSingle();
  if (error) throw error;
  return data ? rowToRide(data) : null;
}

export async function getParticipants(rideId: string): Promise<ParticipantRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('participants').select().eq('ride_id', rideId);
  if (error) throw error;
  return (data ?? []) as ParticipantRow[];
}

// ── Create ───────────────────────────────────────────────────────────────────
export interface CreateRideInput {
  name?: string;
  description?: string;
  destination?: Waypoint;
  leaderName: string;
  leaderColor: string;
}

export async function createRide(input: CreateRideInput): Promise<Ride> {
  if (SECURE_MODE) {
    const res = await callEdge<{
      ride: any;
      participantId: string;
      sessionToken: string;
      leaderToken: string;
    }>('create-ride', {
      name: input.name,
      description: input.description,
      destination: input.destination ?? null,
      leaderName: input.leaderName,
      leaderColor: input.leaderColor,
    });
    saveSession(res.ride.id, {
      participantId: res.participantId,
      sessionToken: res.sessionToken,
      name: input.leaderName.trim() || 'Leader',
      color: input.leaderColor,
      isLeader: true,
      leaderToken: res.leaderToken,
    });
    track('ride_created', { mode: 'secure' });
    return rowToRide(res.ride);
  }

  // ── Direct path ──
  const sb = getSupabase();
  const leaderToken = randomToken();
  let ride: any = null;
  for (let attempt = 0; attempt < 5 && !ride; attempt++) {
    const { data, error } = await sb
      .from('rides')
      .insert({
        id: generateRideCode(),
        name: input.name?.trim() || 'Group Ride',
        description: input.description?.trim() || null,
        leader_token: leaderToken,
        dest_lat: input.destination?.lat ?? null,
        dest_lng: input.destination?.lng ?? null,
        dest_label: input.destination?.label ?? null,
        status: 'active',
      })
      .select()
      .single();
    if (!error) ride = data;
    else if (!`${error.message}`.includes('duplicate')) throw error;
  }
  if (!ride) throw new Error('Could not allocate a ride code. Try again.');

  const sessionToken = randomToken();
  const { data: part, error: pErr } = await sb
    .from('participants')
    .insert({
      ride_id: ride.id,
      session_token: sessionToken,
      name: input.leaderName.trim() || 'Leader',
      color: input.leaderColor,
      is_leader: true,
    })
    .select()
    .single();
  if (pErr) throw pErr;

  saveSession(ride.id, {
    participantId: part.id,
    sessionToken,
    name: part.name,
    color: part.color,
    isLeader: true,
    leaderToken,
  });
  track('ride_created', { mode: 'direct' });
  return rowToRide(ride);
}

// ── Join ──────────────────────────────────────────────────────────────────────
export interface JoinRideInput {
  rideId: string;
  name: string;
  color: string;
}

export async function joinRide(
  input: JoinRideInput
): Promise<{ ride: Ride; session: RideSession }> {
  if (SECURE_MODE) {
    const res = await callEdge<{ participantId: string; sessionToken: string }>('join-ride', {
      rideId: input.rideId,
      name: input.name,
      color: input.color,
    });
    const ride = await getRide(input.rideId);
    if (!ride) throw new Error('Ride not found.');
    const session: RideSession = {
      participantId: res.participantId,
      sessionToken: res.sessionToken,
      name: input.name.trim() || 'Rider',
      color: input.color,
      isLeader: false,
    };
    saveSession(input.rideId, session);
    track('ride_joined', { mode: 'secure' });
    return { ride, session };
  }

  // ── Direct path ──
  const sb = getSupabase();
  const ride = await getRide(input.rideId);
  if (!ride) throw new Error('Ride not found. Double-check the link or code.');
  if (ride.status === 'ended') throw new Error('This ride has ended.');
  if (ride.status === 'locked')
    throw new Error('This ride is locked — ask the leader to unlock it.');

  const sessionToken = randomToken();
  const { data: part, error } = await sb
    .from('participants')
    .insert({
      ride_id: input.rideId,
      session_token: sessionToken,
      name: input.name.trim() || 'Rider',
      color: input.color,
      is_leader: false,
    })
    .select()
    .single();
  if (error) throw error;

  const session: RideSession = {
    participantId: part.id,
    sessionToken,
    name: part.name,
    color: part.color,
    isLeader: false,
  };
  saveSession(input.rideId, session);
  track('ride_joined', { mode: 'direct' });
  return { ride, session };
}

// ── Self-service writes ────────────────────────────────────────────────────
export async function persistLocation(
  participantId: string,
  sessionToken: string,
  loc: { lat: number; lng: number; heading?: number | null; speed?: number | null }
): Promise<void> {
  const sb = getSupabase();
  if (SECURE_MODE) {
    await sb.rpc('update_my_location', {
      p_id: participantId,
      p_token: sessionToken,
      p_lat: loc.lat,
      p_lng: loc.lng,
      p_heading: loc.heading ?? null,
      p_speed: loc.speed ?? null,
    });
    return;
  }
  await sb
    .from('participants')
    .update({
      lat: loc.lat,
      lng: loc.lng,
      heading: loc.heading ?? null,
      speed: loc.speed ?? null,
      last_seen: new Date().toISOString(),
    })
    .eq('id', participantId);
}

export async function leaveRide(participantId: string, sessionToken: string): Promise<void> {
  const sb = getSupabase();
  if (SECURE_MODE) {
    await sb.rpc('leave_ride', { p_id: participantId, p_token: sessionToken });
    return;
  }
  await sb.from('participants').delete().eq('id', participantId);
}

// ── Leader actions (leader_token looked up from local session) ───────────────
function leaderAuth(rideId: string): string {
  const s = loadSession(rideId);
  if (!s?.leaderToken) throw new Error('You are not the leader of this ride.');
  return s.leaderToken;
}

export async function updateRideConfig(
  rideId: string,
  patch: Partial<Pick<Ride, 'name' | 'description' | 'status'>> & {
    destination?: Waypoint | null;
  }
): Promise<void> {
  if (SECURE_MODE) {
    const leaderToken = leaderAuth(rideId);
    // Translate the patch into discrete authorized actions.
    if (patch.name !== undefined)
      await callEdge('ride-action', { rideId, leaderToken, action: 'rename', payload: { name: patch.name } });
    if (patch.status === 'locked')
      await callEdge('ride-action', { rideId, leaderToken, action: 'lock' });
    if (patch.status === 'active')
      await callEdge('ride-action', { rideId, leaderToken, action: 'unlock' });
    if (patch.destination === null)
      await callEdge('ride-action', { rideId, leaderToken, action: 'clear-destination' });
    else if (patch.destination)
      await callEdge('ride-action', {
        rideId,
        leaderToken,
        action: 'set-destination',
        payload: patch.destination,
      });
    return;
  }

  const sb = getSupabase();
  const upd: Record<string, unknown> = {};
  if (patch.name !== undefined) upd.name = patch.name;
  if (patch.description !== undefined) upd.description = patch.description;
  if (patch.status !== undefined) upd.status = patch.status;
  if (patch.destination !== undefined) {
    upd.dest_lat = patch.destination?.lat ?? null;
    upd.dest_lng = patch.destination?.lng ?? null;
    upd.dest_label = patch.destination?.label ?? null;
  }
  await sb.from('rides').update(upd).eq('id', rideId);
}

export async function endRide(rideId: string): Promise<void> {
  if (SECURE_MODE) {
    await callEdge('ride-action', { rideId, leaderToken: leaderAuth(rideId), action: 'end' });
    return;
  }
  const sb = getSupabase();
  await sb
    .from('rides')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', rideId);
}

export async function removeParticipant(rideId: string, participantId: string): Promise<void> {
  if (SECURE_MODE) {
    await callEdge('ride-action', {
      rideId,
      leaderToken: leaderAuth(rideId),
      action: 'remove-participant',
      payload: { participantId },
    });
    return;
  }
  const sb = getSupabase();
  await sb.from('participants').delete().eq('id', participantId);
}
