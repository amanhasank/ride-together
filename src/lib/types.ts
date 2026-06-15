export type RideStatus = 'active' | 'locked' | 'ended';

export interface Waypoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface Ride {
  id: string;
  name: string;
  description: string | null;
  status: RideStatus;
  dest_lat: number | null;
  dest_lng: number | null;
  dest_label: string | null;
  waypoints: Waypoint[];
  created_at: string;
  ended_at: string | null;
}

/** Row as stored in Postgres (includes secrets we never expose in the UI). */
export interface ParticipantRow {
  id: string;
  ride_id: string;
  session_token: string;
  name: string;
  color: string;
  is_leader: boolean;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed: number | null;
  last_seen: string;
  joined_at: string;
}

/** Live participant view used across the UI (merges DB row + broadcast pings). */
export interface Participant {
  id: string;
  name: string;
  color: string;
  isLeader: boolean;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed: number | null; // m/s
  lastSeen: number; // epoch ms
  isSelf: boolean;
}

/** Payload broadcast on every location tick (kept tiny for bandwidth). */
export interface LocPing {
  id: string;
  lat: number;
  lng: number;
  h?: number; // heading
  s?: number; // speed m/s
  t: number; // epoch ms
}

export type LiveStatus = 'live' | 'recent' | 'stale' | 'offline';

export const AVATAR_COLORS = [
  '#2f7dff',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
] as const;
