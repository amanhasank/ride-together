'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import type { Participant, Ride } from '@/lib/types';
import { liveStatus, haversineMeters } from '@/lib/geo';

interface Props {
  ride: Ride;
  participants: Participant[];
  selfId: string;
  followId: string | null; // recenter to follow this participant (e.g. leader)
  recenterNonce: number; // bump to recenter on self
  focus: { lat: number; lng: number; nonce: number } | null; // pan to an arbitrary point
  onMapClick?: (lat: number, lng: number) => void;
  pickingDestination?: boolean;
}

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

export function MapView({
  ride,
  participants,
  selfId,
  followId,
  recenterNonce,
  focus,
  onMapClick,
  pickingDestination,
}: Props) {
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
  const self = participants.find((p) => p.id === selfId);
  const initialCenter =
    self && self.lat != null && self.lng != null
      ? { lat: self.lat, lng: self.lng }
      : ride.dest_lat != null
        ? { lat: ride.dest_lat, lng: ride.dest_lng! }
        : DEFAULT_CENTER;

  return (
    <Map
      mapId={mapId}
      defaultCenter={initialCenter}
      defaultZoom={14}
      gestureHandling="greedy"
      disableDefaultUI
      clickableIcons={false}
      onClick={(e) => {
        if (pickingDestination && e.detail.latLng)
          onMapClick?.(e.detail.latLng.lat, e.detail.latLng.lng);
      }}
      className="h-full w-full"
    >
      {participants.map((p) =>
        p.lat != null && p.lng != null ? (
          <AdvancedMarker key={p.id} position={{ lat: p.lat, lng: p.lng }} zIndex={p.isSelf ? 999 : 1}>
            <RiderPin participant={p} />
          </AdvancedMarker>
        ) : null
      )}

      {ride.dest_lat != null && ride.dest_lng != null && (
        <AdvancedMarker position={{ lat: ride.dest_lat, lng: ride.dest_lng }} zIndex={500}>
          <DestinationPin label={ride.dest_label} />
        </AdvancedMarker>
      )}

      <RouteLayer ride={ride} leader={participants.find((p) => p.isLeader) ?? self ?? null} />
      <Recenter target={self ?? null} nonce={recenterNonce} />
      <FocusPanner focus={focus} />
      <FollowCamera participants={participants} followId={followId} />
    </Map>
  );
}

function RiderPin({ participant }: { participant: Participant }) {
  const status = liveStatus(participant.lastSeen);
  const dim = status === 'offline' || status === 'stale';
  // Show a directional arrow (Google-nav style) when we know which way they're
  // facing; otherwise a simple location dot.
  const heading = participant.heading;
  const directional = heading != null && isFinite(heading) && !dim;

  return (
    <div className="relative flex -translate-y-1/2 flex-col items-center">
      <div
        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-md"
        style={{ backgroundColor: participant.color, opacity: dim ? 0.5 : 1 }}
      >
        {participant.isLeader && '★ '}
        {participant.name}
        {participant.isSelf && ' (you)'}
      </div>
      <div className="relative mt-1 grid place-items-center">
        {status === 'live' && (
          <span
            className="absolute h-5 w-5 rounded-full animate-pulseRing"
            style={{ backgroundColor: participant.color, opacity: 0.45 }}
          />
        )}
        {directional ? (
          // Colored disc with a white chevron rotated to the heading.
          <svg
            width={34}
            height={34}
            viewBox="0 0 34 34"
            className="relative drop-shadow-md"
            style={{ transform: `rotate(${heading}deg)`, transition: 'transform 0.4s ease-out' }}
          >
            <circle cx="17" cy="17" r="14" fill={participant.color} stroke="#ffffff" strokeWidth="3" />
            <path d="M17 7.5 L23.5 23 L17 19 L10.5 23 Z" fill="#ffffff" />
          </svg>
        ) : (
          <div
            className="relative h-5 w-5 rounded-full border-2 border-white shadow-md"
            style={{ backgroundColor: participant.color, opacity: dim ? 0.5 : 1 }}
          />
        )}
      </div>
    </div>
  );
}

function DestinationPin({ label }: { label: string | null }) {
  return (
    <div className="flex -translate-y-full flex-col items-center">
      <div className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white shadow-lg dark:bg-white dark:text-slate-900">
        🏁 {label || 'Destination'}
      </div>
      <div className="h-2 w-2 rotate-45 -translate-y-1 bg-slate-900 dark:bg-white" />
    </div>
  );
}

/** Draws a route polyline from the leader to the destination via Directions API. */
function RouteLayer({ ride, leader }: { ride: Ride; leader: Participant | null }) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const caseRef = useRef<google.maps.Polyline | null>(null); // darker outer casing
  const lineRef = useRef<google.maps.Polyline | null>(null); // blue inner line
  const svcRef = useRef<google.maps.DirectionsService | null>(null);
  const lastOrigin = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (routesLib && !svcRef.current) svcRef.current = new routesLib.DirectionsService();
  }, [routesLib]);

  const clear = () => {
    caseRef.current?.setMap(null);
    lineRef.current?.setMap(null);
    caseRef.current = null;
    lineRef.current = null;
  };

  useEffect(() => {
    if (!map || !svcRef.current) return;
    if (
      ride.dest_lat == null ||
      ride.dest_lng == null ||
      !leader ||
      leader.lat == null ||
      leader.lng == null
    ) {
      clear();
      lastOrigin.current = null;
      return;
    }

    // Throttle Directions calls: only recompute if the leader moved > ~40m
    // since the last computed origin (destination changes always recompute via deps).
    const origin = { lat: leader.lat, lng: leader.lng };
    if (
      lastOrigin.current &&
      lineRef.current &&
      haversineMeters(lastOrigin.current, origin) < 40
    ) {
      return;
    }
    lastOrigin.current = origin;

    let cancelled = false;
    svcRef.current.route(
      {
        origin,
        destination: { lat: ride.dest_lat, lng: ride.dest_lng },
        waypoints: (ride.waypoints || []).map((w) => ({
          location: { lat: w.lat, lng: w.lng },
          stopover: true,
        })),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (res, status) => {
        if (cancelled || status !== 'OK' || !res) return;
        const path = res.routes[0]?.overview_path;
        if (!path) return;
        clear();
        // Outer casing for the Google-Maps look.
        caseRef.current = new google.maps.Polyline({
          path,
          strokeColor: '#1546b8',
          strokeOpacity: 0.9,
          strokeWeight: 9,
          zIndex: 1,
          map,
        });
        // Inner bright-blue route line.
        lineRef.current = new google.maps.Polyline({
          path,
          strokeColor: '#3b82f6',
          strokeOpacity: 1,
          strokeWeight: 5,
          zIndex: 2,
          map,
        });
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ride.dest_lat, ride.dest_lng, ride.waypoints, leader?.lat, leader?.lng]);

  useEffect(() => () => clear(), []);
  return null;
}

function Recenter({ target, nonce }: { target: Participant | null; nonce: number }) {
  const map = useMap();
  useEffect(() => {
    if (map && target?.lat != null && target?.lng != null) {
      map.panTo({ lat: target.lat, lng: target.lng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);
  return null;
}

function FocusPanner({ focus }: { focus: { lat: number; lng: number; nonce: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && focus) map.panTo({ lat: focus.lat, lng: focus.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);
  return null;
}

function FollowCamera({
  participants,
  followId,
}: {
  participants: Participant[];
  followId: string | null;
}) {
  const map = useMap();
  const target = useMemo(
    () => participants.find((p) => p.id === followId) ?? null,
    [participants, followId]
  );
  useEffect(() => {
    if (map && followId && target?.lat != null && target?.lng != null) {
      map.panTo({ lat: target.lat, lng: target.lng });
    }
  }, [map, followId, target?.lat, target?.lng, target]);
  return null;
}
