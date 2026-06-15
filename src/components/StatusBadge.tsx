import type { LiveStatus } from '@/lib/types';
import type { ConnState } from '@/hooks/useRideChannel';

const MAP: Record<LiveStatus, { label: string; dot: string; text: string }> = {
  live: { label: 'Live', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  recent: {
    label: 'Recently updated',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  stale: { label: 'Stale', dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
  offline: { label: 'Offline', dot: 'bg-slate-400', text: 'text-slate-500' },
};

export function StatusDot({ status }: { status: LiveStatus }) {
  const s = MAP[status];
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === 'live' && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${s.dot} opacity-60 animate-pulseRing`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.dot}`} />
    </span>
  );
}

export function StatusLabel({ status }: { status: LiveStatus }) {
  const s = MAP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <StatusDot status={status} />
      {s.label}
    </span>
  );
}

export function ConnectionPill({ conn }: { conn: ConnState }) {
  if (conn === 'connected') return null;
  const text =
    conn === 'connecting'
      ? 'Connecting…'
      : conn === 'reconnecting'
        ? 'Reconnecting…'
        : 'Connection issue';
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 animate-fadeIn rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur dark:bg-white/90 dark:text-slate-900">
      {text}
    </div>
  );
}
