'use client';

import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { DestinationSearch } from './DestinationSearch';
import type { Ride, Waypoint } from '@/lib/types';
import { endRide, updateRideConfig } from '@/lib/ride';
import { loadSession } from '@/lib/session';
import { Lock, Unlock, Power, Pencil, MapPin, Crosshair, Copy, Check, Crown } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
  ride: Ride;
  onPickDestination: () => void;
  onEnded: () => void;
}

export function LeaderControls({ open, onClose, ride, onPickDestination, onEnded }: Props) {
  const [name, setName] = useState(ride.name);
  const [destLabel, setDestLabel] = useState(ride.dest_label ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [copiedLeader, setCopiedLeader] = useState(false);

  // Private leader link — lets the leader regain control from another device.
  const leaderToken = loadSession(ride.id)?.leaderToken;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const leaderLink = leaderToken
    ? `${baseUrl}/ride/${ride.id}?leader=${leaderToken}`
    : null;

  const copyLeaderLink = async () => {
    if (!leaderLink) return;
    try {
      await navigator.clipboard.writeText(leaderLink);
      setCopiedLeader(true);
      setTimeout(() => setCopiedLeader(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const saveName = async () => {
    if (name.trim() && name !== ride.name) {
      setBusy(true);
      await updateRideConfig(ride.id, { name: name.trim() });
      setBusy(false);
    }
  };

  const saveDestLabel = async () => {
    if (destLabel !== (ride.dest_label ?? '') && ride.dest_lat != null) {
      await updateRideConfig(ride.id, {
        destination: { lat: ride.dest_lat, lng: ride.dest_lng!, label: destLabel.trim() },
      });
    }
  };

  const toggleLock = async () => {
    setBusy(true);
    await updateRideConfig(ride.id, { status: ride.status === 'locked' ? 'active' : 'locked' });
    setBusy(false);
  };

  const pickFromSearch = async (w: Waypoint) => {
    setBusy(true);
    setDestLabel(w.label ?? '');
    await updateRideConfig(ride.id, { destination: w });
    setBusy(false);
  };

  const clearDest = async () => {
    setBusy(true);
    await updateRideConfig(ride.id, { destination: null });
    setDestLabel('');
    setBusy(false);
  };

  const doEnd = async () => {
    setBusy(true);
    await endRide(ride.id);
    onEnded();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Ride controls">
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Ride name</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              maxLength={40}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none ring-brand-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              onClick={saveName}
              className="grid w-11 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <Pencil width={18} height={18} />
            </button>
          </div>
        </div>

        {leaderLink && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
              <Crown width={15} height={15} /> Leader link (keep private)
            </p>
            <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/70">
              Save this to regain leader control from another device. Anyone with it becomes leader.
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-white px-3 py-2 dark:bg-slate-900">
              <span className="flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {leaderLink}
              </span>
              <button
                onClick={copyLeaderLink}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                aria-label="Copy leader link"
              >
                {copiedLeader ? <Check width={16} height={16} /> : <Copy width={16} height={16} />}
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium">Destination</label>

          {/* Search a place — Google Places Autocomplete */}
          <div className="mb-2">
            <DestinationSearch onSelect={pickFromSearch} />
          </div>

          <input
            value={destLabel}
            onChange={(e) => setDestLabel(e.target.value)}
            onBlur={saveDestLabel}
            placeholder="Or rename this spot (optional)"
            className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none ring-brand-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                onClose();
                onPickDestination();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Crosshair width={16} height={16} /> Set on map
            </button>
            {ride.dest_lat != null && (
              <button
                onClick={clearDest}
                disabled={busy}
                className="rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
          {ride.dest_lat != null && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-slate-400">
              <MapPin width={12} height={12} /> {ride.dest_lat.toFixed(4)}, {ride.dest_lng!.toFixed(4)}
            </p>
          )}
        </div>

        <button
          onClick={toggleLock}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold dark:border-slate-700"
        >
          {ride.status === 'locked' ? (
            <>
              <Unlock width={18} height={18} /> Unlock ride (allow new riders)
            </>
          ) : (
            <>
              <Lock width={18} height={18} /> Lock ride (no new riders)
            </>
          )}
        </button>

        {confirmEnd ? (
          <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/40">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              End the ride for everyone? This stops all location sharing.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={doEnd}
                disabled={busy}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white"
              >
                {busy ? 'Ending…' : 'Yes, end ride'}
              </button>
              <button
                onClick={() => setConfirmEnd(false)}
                className="flex-1 rounded-lg bg-white py-2.5 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmEnd(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-sm font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400"
          >
            <Power width={18} height={18} /> End ride
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
