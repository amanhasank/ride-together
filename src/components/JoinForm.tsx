'use client';

import { useState } from 'react';
import { ColorPicker } from './ColorPicker';
import { ThemeToggle } from './ThemeToggle';
import { AVATAR_COLORS } from '@/lib/types';
import type { Ride } from '@/lib/types';
import { joinRide } from '@/lib/ride';
import { MapPin, Navigation, Users } from './icons';

interface Props {
  ride: Ride;
  onJoined: () => void;
}

export function JoinForm({ ride, onJoined }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(AVATAR_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = ride.status !== 'active';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter a display name.');
    setBusy(true);
    setError(null);
    try {
      await joinRide({ rideId: ride.id, name, color });
      // Prompt for location right after joining (gesture-driven).
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => onJoined(),
          () => onJoined(), // join even if they deny; UX surfaces the prompt again
          { enableHighAccuracy: true, timeout: 15000 }
        );
      } else {
        onJoined();
      }
    } catch (err: any) {
      setError(err?.message ?? 'Could not join the ride.');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-brand-600 to-brand-800 text-white">
      <div className="safe-top flex items-center justify-between px-5 pt-5">
        <span className="flex items-center gap-2 font-semibold">
          <Navigation width={20} height={20} /> RideTogether
        </span>
        <ThemeToggle className="border-white/20 bg-white/10 text-white hover:bg-white/20" />
      </div>

      <div className="flex flex-1 flex-col justify-center px-5 py-8">
        <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
          <p className="text-sm font-medium text-brand-600 dark:text-brand-400">You&apos;re invited to</p>
          <h1 className="mt-1 text-2xl font-bold">{ride.name}</h1>
          {ride.description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ride.description}</p>
          )}
          {ride.dest_label && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <MapPin width={14} height={14} /> {ride.dest_label}
            </p>
          )}

          {locked ? (
            <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {ride.status === 'ended'
                ? 'This ride has ended.'
                : 'This ride is currently locked. Ask the leader to unlock it to join.'}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Display name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  autoFocus
                  placeholder="e.g. Alex"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none ring-brand-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Your color</label>
                <ColorPicker value={color} onChange={setColor} />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition active:scale-[0.98] disabled:opacity-60"
              >
                <Users width={20} height={20} />
                {busy ? 'Joining…' : 'Join ride'}
              </button>
              <p className="text-center text-xs text-slate-400">
                We&apos;ll ask for location permission. Your location is shared only while you&apos;re in this ride.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
