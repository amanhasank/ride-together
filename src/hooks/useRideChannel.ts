'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { getParticipants, getRide, persistLocation } from '@/lib/ride';
import type { LocPing, Participant, ParticipantRow, Ride } from '@/lib/types';
import type { RideSession } from '@/lib/session';
import type { GeoFix } from './useGeolocation';

export type ConnState = 'connecting' | 'connected' | 'reconnecting' | 'error';

interface Args {
  rideId: string;
  initialRide: Ride;
  session: RideSession;
  selfFix: GeoFix | null;
}

const PERSIST_EVERY_MS = 15000; // write last-known location to DB at most this often

/**
 * Single source of truth for a ride room. Combines:
 *   • Postgres state  → durable ride config + participant roster
 *   • Broadcast       → high-frequency location pings (no row writes)
 *   • Presence        → who is currently connected
 * Handles reconnection, late-join hydration, and self-removal ("kicked").
 */
export function useRideChannel({ rideId, initialRide, session, selfFix }: Args) {
  const [ride, setRide] = useState<Ride>(initialRide);
  const [rows, setRows] = useState<Record<string, ParticipantRow>>({});
  const [pings, setPings] = useState<Record<string, LocPing>>({});
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [conn, setConn] = useState<ConnState>('connecting');
  const [kicked, setKicked] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastPersist = useRef(0);

  // ── Initial + re-hydration fetch ──────────────────────────────────────────
  const hydrate = useCallback(async () => {
    try {
      const [r, ps] = await Promise.all([getRide(rideId), getParticipants(rideId)]);
      if (r) setRide(r);
      const map: Record<string, ParticipantRow> = {};
      for (const p of ps) map[p.id] = p;
      setRows(map);
      // If our own row is gone, the leader removed us.
      if (!map[session.participantId]) setKicked(true);
    } catch {
      /* transient; realtime will keep us current */
    }
  }, [rideId, session.participantId]);

  // ── Channel lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getSupabase();
    void hydrate();

    const channel = sb.channel(`ride:${rideId}`, {
      config: { broadcast: { ack: false }, presence: { key: session.participantId } },
    });

    channel
      .on('broadcast', { event: 'loc' }, ({ payload }) => {
        const p = payload as LocPing;
        if (!p?.id) return;
        setPings((prev) =>
          prev[p.id] && prev[p.id].t >= p.t ? prev : { ...prev, [p.id]: p }
        );
      })
      .on('broadcast', { event: 'kick' }, ({ payload }) => {
        if (payload?.id === session.participantId) setKicked(true);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnline(new Set(Object.keys(state)));
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const r = payload.new as any;
          setRide((prev) => ({
            ...prev,
            name: r.name,
            description: r.description ?? null,
            status: r.status,
            dest_lat: r.dest_lat ?? null,
            dest_lng: r.dest_lng ?? null,
            dest_label: r.dest_label ?? null,
            waypoints: Array.isArray(r.waypoints) ? r.waypoints : [],
            ended_at: r.ended_at ?? null,
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `ride_id=eq.${rideId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as any)?.id;
            if (!id) return;
            setRows((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
            if (id === session.participantId) setKicked(true);
          } else {
            const row = payload.new as ParticipantRow;
            setRows((prev) => ({ ...prev, [row.id]: row }));
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConn('connected');
          await channel.track({
            id: session.participantId,
            name: session.name,
            color: session.color,
          });
          void hydrate(); // catch anything missed while disconnected
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConn('reconnecting');
        } else if (status === 'CLOSED') {
          setConn('reconnecting');
        }
      });

    channelRef.current = channel;

    return () => {
      sb.removeChannel(channel);
      channelRef.current = null;
    };
  }, [rideId, session.participantId, session.name, session.color, hydrate]);

  // ── Broadcast our own location + periodically persist ─────────────────────
  const broadcast = useCallback(
    (fix: GeoFix) => {
      const ch = channelRef.current;
      if (!ch) return;
      const ping: LocPing = {
        id: session.participantId,
        lat: fix.lat,
        lng: fix.lng,
        h: fix.heading ?? undefined,
        s: fix.speed ?? undefined,
        t: fix.timestamp,
      };
      ch.send({ type: 'broadcast', event: 'loc', payload: ping });
      // Optimistically reflect our own marker locally.
      setPings((prev) => ({ ...prev, [ping.id]: ping }));

      const now = Date.now();
      if (now - lastPersist.current > PERSIST_EVERY_MS) {
        lastPersist.current = now;
        void persistLocation(session.participantId, session.sessionToken, {
          lat: fix.lat,
          lng: fix.lng,
          heading: fix.heading,
          speed: fix.speed,
        });
      }
    },
    [session.participantId, session.sessionToken]
  );

  useEffect(() => {
    if (selfFix && !kicked && ride.status !== 'ended') broadcast(selfFix);
  }, [selfFix, kicked, ride.status, broadcast]);

  // ── Merge rows + pings + presence into the live participant list ──────────
  const participants = useMemo<Participant[]>(() => {
    return Object.values(rows).map((row) => {
      const ping = pings[row.id];
      const rowSeen = new Date(row.last_seen).getTime();
      const pingNewer = ping && ping.t >= rowSeen;
      const lat = pingNewer ? ping!.lat : row.lat;
      const lng = pingNewer ? ping!.lng : row.lng;
      const lastSeen = Math.max(rowSeen || 0, ping?.t ?? 0);
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        isLeader: row.is_leader,
        lat,
        lng,
        heading: pingNewer ? ping!.h ?? null : row.heading,
        speed: pingNewer ? ping!.s ?? null : row.speed,
        lastSeen: online.has(row.id) ? Math.max(lastSeen, Date.now() - 1) : lastSeen,
        isSelf: row.id === session.participantId,
      };
    });
  }, [rows, pings, online, session.participantId]);

  const reconnect = useCallback(() => {
    setConn('reconnecting');
    void hydrate();
  }, [hydrate]);

  return { ride, participants, conn, kicked, reconnect };
}
