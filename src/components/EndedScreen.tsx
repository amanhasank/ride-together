'use client';

import Link from 'next/link';
import { Navigation, Power } from './icons';

export function EndedScreen({ rideName, kicked }: { rideName: string; kicked?: boolean }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 px-6 text-center text-white">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10">
        <Power width={30} height={30} />
      </div>
      <h1 className="mt-6 text-2xl font-bold">
        {kicked ? 'You left this ride' : 'Ride ended'}
      </h1>
      <p className="mt-2 max-w-sm text-slate-400">
        {kicked
          ? 'You were removed from the ride or left it. Your location is no longer shared.'
          : `“${rideName}” has ended. Location sharing has stopped for everyone.`}
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/create"
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/20"
        >
          <Navigation width={20} height={20} /> Start a new ride
        </Link>
        <Link href="/" className="rounded-xl border border-white/15 py-3.5 font-medium text-white/80">
          Back home
        </Link>
      </div>
    </div>
  );
}
