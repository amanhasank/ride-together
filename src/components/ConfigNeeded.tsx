'use client';

/** Friendly setup screen shown when env keys are missing (great for first run). */
export function ConfigNeeded({ missing }: { missing: string[] }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-xl font-bold">⚙️ Almost there</h1>
        <p className="mt-2 text-sm text-slate-400">
          RideTogether needs a couple of environment variables before it can run. Copy{' '}
          <code className="rounded bg-slate-800 px-1">.env.example</code> to{' '}
          <code className="rounded bg-slate-800 px-1">.env.local</code> and fill in:
        </p>
        <ul className="mt-4 space-y-1.5 text-sm">
          {missing.map((m) => (
            <li key={m} className="rounded-lg bg-slate-800 px-3 py-2 font-mono text-xs text-brand-300">
              {m}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          See the README for Supabase + Google Maps setup steps.
        </p>
      </div>
    </div>
  );
}
