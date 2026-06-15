'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Navigation, Users, MapPin, Share, Crosshair } from '@/components/icons';

export default function Landing() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) router.push(`/ride/${c}`);
  };

  return (
    <main className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {/* Nav */}
      <header className="safe-top mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <Navigation width={18} height={18} />
          </span>
          RideTogether
        </span>
        <ThemeToggle />
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pb-10 pt-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> No app install · Works in any browser
        </span>
        <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Keep your group on{' '}
          <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
            one live map
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-slate-500 dark:text-slate-400">
          For bikers, cyclists, road trips and friends on the move. Create a ride, share the link,
          and everyone appears on the map in real time.
        </p>

        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
          <Link
            href="/create"
            className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition active:scale-[0.98]"
          >
            <Navigation width={20} height={20} /> Create a ride
          </Link>

          <form
            onSubmit={join}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900"
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter ride code"
              maxLength={8}
              className="flex-1 bg-transparent px-3 py-2.5 font-mono text-base tracking-widest outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              <Users width={16} height={16} /> Join
            </button>
          </form>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto grid max-w-5xl gap-3 px-5 pb-16 sm:grid-cols-3">
        <Feature icon={<Share width={20} height={20} />} title="Share in one tap">
          Get a link + QR code instantly. Drop it in any chat app — riders join in seconds.
        </Feature>
        <Feature icon={<MapPin width={20} height={20} />} title="Live positions">
          Smooth marker updates, last-seen times, and clear live / stale status for every rider.
        </Feature>
        <Feature icon={<Crosshair width={20} height={20} />} title="Shared destination">
          Set a meeting point and route. Everyone sees distance and ETA, sorted by who&apos;s closest.
        </Feature>
      </section>

      <footer className="safe-bottom border-t border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800">
        Location is shared only during an active ride · No permanent history
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-left dark:border-slate-800 dark:bg-slate-900">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400">
        {icon}
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{children}</p>
    </div>
  );
}
