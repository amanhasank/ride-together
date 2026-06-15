'use client';

import { useMemo } from 'react';
import type { Participant, Ride } from '@/lib/types';
import {
  haversineMeters,
  formatDistance,
  formatSpeed,
  formatEta,
  naiveEtaSeconds,
  liveStatus,
  timeAgo,
  compass,
} from '@/lib/geo';
import { StatusLabel } from './StatusBadge';
import { Crown, Trash, Navigation, Gauge, Crosshair } from './icons';

interface Props {
  ride: Ride;
  participants: Participant[];
  selfId: string;
  isLeader: boolean;
  onRemove: (id: string) => void;
  onFocus: (id: string) => void;
}

export function ParticipantPanel({
  ride,
  participants,
  selfId,
  isLeader,
  onRemove,
  onFocus,
}: Props) {
  const leader = participants.find((p) => p.isLeader);
  const dest =
    ride.dest_lat != null && ride.dest_lng != null
      ? { lat: ride.dest_lat, lng: ride.dest_lng }
      : null;

  const rows = useMemo(() => {
    const enriched = participants.map((p) => {
      const hasLoc = p.lat != null && p.lng != null;
      const distToDest =
        hasLoc && dest ? haversineMeters({ lat: p.lat!, lng: p.lng! }, dest) : Infinity;
      const distToLeader =
        hasLoc && leader?.lat != null && leader?.lng != null && !p.isLeader
          ? haversineMeters({ lat: p.lat!, lng: p.lng! }, { lat: leader.lat, lng: leader.lng })
          : p.isLeader
            ? 0
            : Infinity;
      const eta = dest && hasLoc ? naiveEtaSeconds(distToDest, p.speed) : null;
      return { p, distToDest, distToLeader, eta };
    });
    // Sort by proximity to destination (closest first); fall back to leader distance.
    enriched.sort((a, b) => {
      if (dest) return a.distToDest - b.distToDest;
      return a.distToLeader - b.distToLeader;
    });
    return enriched;
  }, [participants, dest, leader]);

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map(({ p, distToLeader, eta }) => {
        const status = liveStatus(p.lastSeen);
        return (
          <button
            key={p.id}
            onClick={() => onFocus(p.id)}
            className="flex w-full items-center gap-3 px-1 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white shadow"
              style={{ backgroundColor: p.color }}
            >
              {p.name.charAt(0).toUpperCase()}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold">
                  {p.name}
                  {p.isSelf && <span className="text-slate-400"> (you)</span>}
                </span>
                {p.isLeader && <Crown width={14} height={14} className="text-amber-500" />}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                <StatusLabel status={status} />
                <span>{timeAgo(p.lastSeen)}</span>
                {!p.isLeader && isFinite(distToLeader) && (
                  <span className="inline-flex items-center gap-1">
                    <Navigation width={11} height={11} />
                    {formatDistance(distToLeader)} from leader
                  </span>
                )}
                {p.speed != null && p.speed > 0.5 && (
                  <span className="inline-flex items-center gap-1">
                    <Gauge width={11} height={11} />
                    {formatSpeed(p.speed)} {compass(p.heading)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              {eta != null && (
                <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  ETA {formatEta(eta)}
                </span>
              )}
              {isLeader && !p.isSelf ? (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(p.id);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                  aria-label={`Remove ${p.name}`}
                >
                  <Trash width={14} height={14} />
                </span>
              ) : (
                <Crosshair width={14} height={14} className="text-slate-300 dark:text-slate-600" />
              )}
            </div>
          </button>
        );
      })}
      {rows.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">No riders yet — share the link!</p>
      )}
    </div>
  );
}
