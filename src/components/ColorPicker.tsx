'use client';

import { AVATAR_COLORS } from '@/lib/types';
import { Check } from './icons';

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {AVATAR_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Pick color ${c}`}
          className="grid h-10 w-10 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-white transition dark:ring-offset-slate-900"
          style={{ backgroundColor: c, boxShadow: value === c ? `0 0 0 2px ${c}` : 'none' }}
        >
          <span style={{ borderColor: 'transparent' }} className={value === c ? 'text-white' : 'opacity-0'}>
            <Check width={18} height={18} />
          </span>
        </button>
      ))}
    </div>
  );
}
