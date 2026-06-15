import type { LiveStatus } from './types';

const EARTH_M = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in meters between two lat/lng points. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(s));
}

/** Initial bearing (compass heading) from a -> b, in degrees [0,360). */
export function bearing(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLng = rad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLng);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function formatDistance(m: number): string {
  if (!isFinite(m)) return '—';
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatSpeed(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms) || ms < 0) return '—';
  const kmh = ms * 3.6;
  return `${Math.round(kmh)} km/h`;
}

/** Rough ETA in seconds from distance + current speed (fallback when no
 *  Directions API result is available). Assumes a sensible floor speed. */
export function naiveEtaSeconds(distanceM: number, speedMs: number | null): number | null {
  if (!isFinite(distanceM)) return null;
  const v = speedMs && speedMs > 1 ? speedMs : 8.3; // ~30 km/h default
  return distanceM / v;
}

export function formatEta(seconds: number | null): string {
  if (seconds == null || !isFinite(seconds)) return '—';
  const m = Math.round(seconds / 60);
  if (m < 1) return '<1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function compass(headingDeg: number | null | undefined): string {
  if (headingDeg == null || !isFinite(headingDeg)) return '—';
  return COMPASS[Math.round(headingDeg / 45) % 8];
}

/** Map "seconds since last update" to a live status bucket. */
export function liveStatus(lastSeenMs: number, now = Date.now()): LiveStatus {
  const age = (now - lastSeenMs) / 1000;
  if (age <= 12) return 'live';
  if (age <= 45) return 'recent';
  if (age <= 180) return 'stale';
  return 'offline';
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
