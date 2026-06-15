'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ColorPicker } from '@/components/ColorPicker';
import { ConfigNeeded } from '@/components/ConfigNeeded';
import { AVATAR_COLORS } from '@/lib/types';
import { createRide } from '@/lib/ride';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Navigation, Crown } from '@/components/icons';

export default function CreatePage() {
  const router = useRouter();
  const [rideName, setRideName] = useState('');
  const [description, setDescription] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [color, setColor] = useState<string>(AVATAR_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <ConfigNeeded missing={['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']} />
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaderName.trim()) return setError('Enter your display name.');
    setBusy(true);
    setError(null);
    try {
      const ride = await createRide({
        name: rideName,
        description,
        leaderName,
        leaderColor: color,
      });
      router.push(`/ride/${ride.id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Could not create the ride.');
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950">
      <header className="safe-top mx-auto flex max-w-lg items-center justify-between px-5 py-5">
        <Link href="/" className="text-sm font-medium text-slate-500">
          ← Back
        </Link>
        <ThemeToggle />
      </header>

      <div className="mx-auto max-w-lg px-5 pb-12">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <Crown width={20} height={20} />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Create a ride</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">You&apos;ll be the ride leader.</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <Field label="Ride name" optional>
            <input
              value={rideName}
              onChange={(e) => setRideName(e.target.value)}
              maxLength={40}
              placeholder="Sunday Morning Loop"
              className={inputCls}
            />
          </Field>

          <Field label="Description" optional>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={140}
              rows={2}
              placeholder="Meet at the café, easy pace, ~40km"
              className={`${inputCls} resize-none`}
            />
          </Field>

          <div className="h-px bg-slate-200 dark:bg-slate-800" />

          <Field label="Your display name">
            <input
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
              maxLength={24}
              placeholder="e.g. Alex"
              className={inputCls}
            />
          </Field>

          <Field label="Your color">
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition active:scale-[0.98] disabled:opacity-60"
          >
            <Navigation width={20} height={20} />
            {busy ? 'Creating…' : 'Create ride'}
          </button>
          <p className="text-center text-xs text-slate-400">
            You can set the destination on the map once the ride starts.
          </p>
        </form>
      </div>
    </main>
  );
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-brand-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900';

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-slate-400">optional</span>}
      </label>
      {children}
    </div>
  );
}
