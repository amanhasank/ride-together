'use client';

/**
 * Per-device, per-ride session state stored in localStorage so a participant
 * can reload or reconnect and resume their identity without re-joining.
 */

export interface RideSession {
  participantId: string;
  sessionToken: string;
  name: string;
  color: string;
  isLeader: boolean;
  leaderToken?: string; // present only for the ride creator
}

const key = (rideId: string) => `rt-session:${rideId}`;

export function loadSession(rideId: string): RideSession | null {
  try {
    const raw = localStorage.getItem(key(rideId));
    return raw ? (JSON.parse(raw) as RideSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(rideId: string, s: RideSession): void {
  try {
    localStorage.setItem(key(rideId), JSON.stringify(s));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSession(rideId: string): void {
  try {
    localStorage.removeItem(key(rideId));
  } catch {
    /* ignore */
  }
}

/** Cryptographically-random token (URL-safe). */
export function randomToken(bytes = 18): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars
/** Short, human-shareable ride code, e.g. "K7P2QX". */
export function generateRideCode(len = 6): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[a[i] % CODE_ALPHABET.length];
  return out;
}
