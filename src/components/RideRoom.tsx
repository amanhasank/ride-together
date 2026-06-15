'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@vercel/analytics';
import { APIProvider } from '@vis.gl/react-google-maps';
import type { Ride } from '@/lib/types';
import type { RideSession } from '@/lib/session';
import { clearSession } from '@/lib/session';
import { leaveRide, removeParticipant, updateRideConfig } from '@/lib/ride';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRideChannel } from '@/hooks/useRideChannel';
import { MapView } from './MapView';
import { ParticipantPanel } from './ParticipantPanel';
import { InviteSheet } from './InviteSheet';
import { LeaderControls } from './LeaderControls';
import { EndedScreen } from './EndedScreen';
import { ConnectionPill } from './StatusBadge';
import { Users, Share, Crown, Crosshair, Navigation, MapPin, X } from './icons';

interface Props {
  rideId: string;
  initialRide: Ride;
  session: RideSession;
  mapsKey: string;
}

export function RideRoom({ rideId, initialRide, session, mapsKey }: Props) {
  const router = useRouter();
  const [invite, setInvite] = useState(false);
  const [controls, setControls] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [followLeader, setFollowLeader] = useState(false);
  const [recenter, setRecenter] = useState(0);
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const [picking, setPicking] = useState(false);

  const { permission, fix, error: geoError, request } = useGeolocation({ minIntervalMs: 3000 });
  const { ride, participants, conn, kicked, reconnect } = useRideChannel({
    rideId,
    initialRide,
    session,
    selfFix: fix,
  });

  const leader = participants.find((p) => p.isLeader);
  const followId = followLeader && leader && !session.isLeader ? leader.id : null;

  const shareUrl = useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}/ride/${rideId}`;
  }, [rideId]);

  // Fire once when the rider first grants location — the key funnel step.
  const trackedGrant = useRef(false);
  useEffect(() => {
    if (permission === 'granted' && !trackedGrant.current) {
      trackedGrant.current = true;
      track('location_shared', { role: session.isLeader ? 'leader' : 'rider' });
    }
  }, [permission, session.isLeader]);

  // Recover ride state on reconnect when the tab returns to foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && conn !== 'connected') reconnect();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [conn, reconnect]);

  if (ride.status === 'ended') return <EndedScreen rideName={ride.name} />;
  if (kicked) return <EndedScreen rideName={ride.name} kicked />;

  const handleRemove = async (id: string) => {
    await removeParticipant(rideId, id);
  };

  const handleLeave = async () => {
    await leaveRide(session.participantId, session.sessionToken).catch(() => {});
    clearSession(rideId);
    router.push('/');
  };

  const handlePickedDestination = async (lat: number, lng: number) => {
    setPicking(false);
    await updateRideConfig(rideId, {
      destination: { lat, lng, label: ride.dest_label || 'Destination' },
    });
  };

  const liveCount = participants.length;

  return (
    <APIProvider apiKey={mapsKey} libraries={['geometry', 'places']}>
      <div className="relative h-[100dvh] w-full overflow-hidden bg-slate-200 dark:bg-slate-900">
        <MapView
          ride={ride}
          participants={participants}
          selfId={session.participantId}
          followId={followId}
          recenterNonce={recenter}
          focus={focus}
          pickingDestination={picking}
          onMapClick={handlePickedDestination}
        />

      <ConnectionPill conn={conn} />

      {/* Top bar */}
      <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-[600] p-3">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-white/40 bg-white/85 px-3 py-2 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/85">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <Navigation width={18} height={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{ride.name}</p>
            <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Users width={12} height={12} /> {liveCount} rider{liveCount === 1 ? '' : 's'}
              {ride.status === 'locked' && ' · 🔒 locked'}
            </p>
          </div>
          <button
            onClick={() => setInvite(true)}
            className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400"
            aria-label="Invite"
          >
            <Share width={18} height={18} />
          </button>
          {session.isLeader && (
            <button
              onClick={() => setControls(true)}
              className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
              aria-label="Leader controls"
            >
              <Crown width={18} height={18} />
            </button>
          )}
        </div>
      </div>

      {/* Floating right controls */}
      <div className="absolute right-3 top-24 z-[600] flex flex-col gap-2">
        <button
          onClick={() => setRecenter((n) => n + 1)}
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-700 shadow-lg dark:bg-slate-800 dark:text-slate-200"
          aria-label="Recenter on me"
        >
          <Crosshair width={20} height={20} />
        </button>
        {!session.isLeader && leader && (
          <button
            onClick={() => setFollowLeader((v) => !v)}
            className={`grid h-11 w-11 place-items-center rounded-full shadow-lg transition ${
              followLeader
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
            aria-label="Follow leader"
          >
            <Crown width={20} height={20} />
          </button>
        )}
      </div>

      {/* Location permission banner */}
      {permission !== 'granted' && (
        <div className="absolute inset-x-0 bottom-28 z-[600] mx-auto max-w-lg px-3">
          <button
            onClick={request}
            className="flex w-full items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-left text-sm text-white shadow-xl dark:bg-white dark:text-slate-900"
          >
            <MapPin width={18} height={18} />
            <span className="flex-1">
              {permission === 'denied'
                ? 'Location is blocked. Enable it in your browser settings to appear on the map.'
                : 'Tap to share your location with the group.'}
            </span>
          </button>
        </div>
      )}

      {/* Destination picking banner */}
      {picking && (
        <div className="absolute inset-x-0 bottom-28 z-[700] mx-auto max-w-lg px-3">
          <div className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm text-white shadow-xl">
            <Crosshair width={18} height={18} />
            <span className="flex-1">Tap anywhere on the map to set the destination.</span>
            <button onClick={() => setPicking(false)} aria-label="Cancel">
              <X width={18} height={18} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom participant sheet */}
      <div className="safe-bottom absolute inset-x-0 bottom-0 z-[600]">
        <div className="mx-auto max-w-lg rounded-t-3xl border-t border-slate-200 bg-white px-4 pb-2 pt-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between py-2"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Users width={18} height={18} /> Riders ({liveCount})
            </span>
            <span className="text-xs text-slate-400">{expanded ? 'Hide' : 'Show'}</span>
          </button>
          <div
            className={`overflow-y-auto transition-[max-height] duration-300 ${
              expanded ? 'max-h-[45dvh]' : 'max-h-[22dvh]'
            }`}
          >
            <ParticipantPanel
              ride={ride}
              participants={participants}
              selfId={session.participantId}
              isLeader={session.isLeader}
              onRemove={handleRemove}
              onFocus={(id) => {
                const t = participants.find((p) => p.id === id);
                if (t?.lat != null && t?.lng != null)
                  setFocus({ lat: t.lat, lng: t.lng, nonce: Date.now() });
              }}
            />
          </div>
          <button
            onClick={handleLeave}
            className="mt-1 w-full rounded-xl py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Leave ride
          </button>
        </div>
      </div>

      <InviteSheet
        open={invite}
        onClose={() => setInvite(false)}
        rideId={rideId}
        rideName={ride.name}
        url={shareUrl}
      />

      {session.isLeader && (
        <LeaderControls
          open={controls}
          onClose={() => setControls(false)}
          ride={ride}
          onPickDestination={() => setPicking(true)}
          onEnded={() => router.refresh()}
        />
      )}

      {geoError && permission === 'granted' && (
        <div className="absolute bottom-2 left-1/2 z-[500] -translate-x-1/2 text-xs text-slate-400">
          {geoError}
        </div>
      )}
      </div>
    </APIProvider>
  );
}
