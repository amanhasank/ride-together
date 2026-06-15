'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BottomSheet } from './BottomSheet';
import { Copy, Check, Share } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
  rideId: string;
  rideName: string;
  url: string;
}

export function InviteSheet({ open, onClose, rideId, rideName, url }: Props) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  const copy = async (text: string, which: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: rideName, text: `Join my ride "${rideName}" on RideTogether`, url });
      } catch {
        /* user cancelled */
      }
    } else {
      void copy(url, 'link');
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Invite riders">
      <div className="flex flex-col items-center gap-5">
        <div className="rounded-2xl bg-white p-4 shadow-inner ring-1 ring-slate-100">
          <QRCodeSVG value={url} size={188} level="M" includeMargin={false} />
        </div>

        <button
          onClick={() => copy(rideId, 'code')}
          className="flex flex-col items-center"
          aria-label="Copy ride code"
        >
          <span className="text-xs uppercase tracking-wider text-slate-400">Ride code</span>
          <span className="font-mono text-3xl font-bold tracking-[0.3em] text-brand-600 dark:text-brand-400">
            {rideId}
          </span>
        </button>

        <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <span className="flex-1 truncate text-sm text-slate-600 dark:text-slate-300">{url}</span>
          <button
            onClick={() => copy(url, 'link')}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-600 shadow-sm dark:bg-slate-700 dark:text-slate-200"
          >
            {copied === 'link' ? <Check width={16} height={16} /> : <Copy width={16} height={16} />}
          </button>
        </div>

        <button
          onClick={nativeShare}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition active:scale-[0.98]"
        >
          <Share width={20} height={20} />
          Share link
        </button>
        <p className="text-center text-xs text-slate-400">
          Anyone with this link can join while the ride is active.
        </p>
      </div>
    </BottomSheet>
  );
}
