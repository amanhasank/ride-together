'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getRide, claimLeader } from '@/lib/ride';
import { loadSession, type RideSession } from '@/lib/session';
import type { Ride } from '@/lib/types';
import { ConfigNeeded } from '@/components/ConfigNeeded';
import { JoinForm } from '@/components/JoinForm';
import { EndedScreen } from '@/components/EndedScreen';
import { RideRoom } from '@/components/RideRoom';
import { Navigation } from '@/components/icons';

export default function RidePage() {
  const params = useParams();
  const rideId = String(params.id || '').toUpperCase();

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const missing: string[] = [];
  if (!isSupabaseConfigured) missing.push('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!mapsKey) missing.push('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');

  const [state, setState] = useState<'loading' | 'notfound' | 'join' | 'room'>('loading');
  const [ride, setRide] = useState<Ride | null>(null);
  const [session, setSession] = useState<RideSession | null>(null);

  useEffect(() => {
    if (missing.length) return;
    let active = true;
    (async () => {
      try {
        const r = await getRide(rideId);
        if (!active) return;
        if (!r) return setState('notfound');
        setRide(r);

        // Private leader link (?leader=<token>) → reclaim leadership on any device.
        const leaderParam = new URLSearchParams(window.location.search).get('leader');
        if (leaderParam) {
          try {
            const ls = await claimLeader(rideId, leaderParam);
            // Strip the secret token from the address bar / history.
            window.history.replaceState({}, '', `/ride/${rideId}`);
            if (!active) return;
            setSession(ls);
            setState('room');
            return;
          } catch {
            // Invalid token → fall through to normal session/join flow.
            window.history.replaceState({}, '', `/ride/${rideId}`);
          }
        }

        const s = loadSession(rideId);
        if (s) {
          setSession(s);
          setState('room');
        } else {
          setState('join');
        }
      } catch {
        if (active) setState('notfound');
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  if (missing.length) return <ConfigNeeded missing={Array.from(new Set(missing))} />;

  if (state === 'loading') {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-slate-950 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <Navigation width={28} height={28} className="animate-pulse text-brand-400" />
          <p className="text-sm">Loading ride {rideId}…</p>
        </div>
      </div>
    );
  }

  if (state === 'notfound') {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-slate-950 px-6 text-center text-slate-200">
        <div>
          <h1 className="text-2xl font-bold">Ride not found</h1>
          <p className="mt-2 text-slate-400">
            We couldn&apos;t find a ride with code <span className="font-mono">{rideId}</span>.
          </p>
          <a href="/" className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white">
            Go home
          </a>
        </div>
      </div>
    );
  }

  if (state === 'join' && ride) {
    return (
      <JoinForm
        ride={ride}
        onJoined={() => {
          setSession(loadSession(rideId));
          setState('room');
        }}
      />
    );
  }

  if (state === 'room' && ride && session) {
    return <RideRoom rideId={rideId} initialRide={ride} session={session} mapsKey={mapsKey!} />;
  }

  return <EndedScreen rideName={ride?.name ?? 'Ride'} />;
}
