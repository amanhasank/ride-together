'use client';

import { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import type { Waypoint } from '@/lib/types';
import { MapPin } from './icons';

/**
 * Google Places Autocomplete search box. Lets the leader type a place/address
 * and pick from live suggestions (the dropdown is the native Google `.pac-container`,
 * styled via globals.css). On selection, returns lat/lng + a friendly label.
 */
export function DestinationSearch({ onSelect }: { onSelect: (w: Waypoint) => void }) {
  const places = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const ac = new places.Autocomplete(inputRef.current, {
      fields: ['geometry', 'name', 'formatted_address'],
    });
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      const label = place.name || place.formatted_address || 'Destination';
      onSelectRef.current({ lat: loc.lat(), lng: loc.lng(), label });
      if (inputRef.current) inputRef.current.value = label;
    });
    return () => listener.remove();
  }, [places]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <MapPin width={18} height={18} />
      </span>
      <input
        ref={inputRef}
        type="text"
        placeholder={places ? 'Search a place or address…' : 'Loading search…'}
        disabled={!places}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-base outline-none ring-brand-500 focus:ring-2 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
      />
    </div>
  );
}
