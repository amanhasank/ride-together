'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { bearing, haversineMeters } from '@/lib/geo';

export type GeoPermission = 'unknown' | 'prompt' | 'granted' | 'denied';

export interface GeoFix {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null; // m/s
  accuracy: number | null;
  timestamp: number;
}

interface Options {
  /** Minimum ms between accepted fixes (battery-conscious throttle). */
  minIntervalMs?: number;
  /** Start watching immediately. */
  enabled?: boolean;
}

/**
 * Watches device location with battery-conscious throttling and graceful
 * handling of permission states. Browsers suspend updates when the tab is
 * backgrounded/locked — we don't fight that; we surface the last known fix and
 * resume automatically when the page becomes visible again.
 */
export function useGeolocation({ minIntervalMs = 3000, enabled = true }: Options = {}) {
  const [permission, setPermission] = useState<GeoPermission>('unknown');
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const lastEmit = useRef(0);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const lastHeading = useRef<number | null>(null);

  // Track the permission state where the API is available.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (cancelled) return;
        setPermission(status.state as GeoPermission);
        status.onchange = () => setPermission(status.state as GeoPermission);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const stop = useCallback(() => {
    if (watchId.current != null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported on this device.');
      return;
    }
    stop();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPermission('granted');
        setError(null);
        const now = Date.now();
        if (now - lastEmit.current < minIntervalMs) return; // throttle
        lastEmit.current = now;

        const cur = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // Prefer the device compass heading; if unavailable (common on laptops
        // and when stationary), derive it from movement so the nav arrow still
        // points the right way. Keep the last known heading when not moving.
        let heading: number | null = Number.isFinite(pos.coords.heading)
          ? (pos.coords.heading as number)
          : null;
        if (heading == null && lastPos.current) {
          if (haversineMeters(lastPos.current, cur) > 4) {
            heading = bearing(lastPos.current, cur);
          } else {
            heading = lastHeading.current;
          }
        }
        if (heading != null) lastHeading.current = heading;
        lastPos.current = cur;

        setFix({
          lat: cur.lat,
          lng: cur.lng,
          heading,
          speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
          accuracy: pos.coords.accuracy ?? null,
          timestamp: now,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermission('denied');
        setError(err.message || 'Unable to read location.');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
  }, [minIntervalMs, stop]);

  // Start/stop based on `enabled`.
  useEffect(() => {
    if (enabled) start();
    else stop();
    return stop;
  }, [enabled, start, stop]);

  // Resume promptly when the page is reopened (mobile lock/background case).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && enabled) start();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, start]);

  /** Imperatively prompt for permission (best-effort one-shot). */
  const request = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(false);
        navigator.geolocation.getCurrentPosition(
          () => {
            setPermission('granted');
            start();
            resolve(true);
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) setPermission('denied');
            resolve(false);
          },
          { enableHighAccuracy: true, timeout: 20000 }
        );
      }),
    [start]
  );

  return { permission, fix, error, start, stop, request };
}
