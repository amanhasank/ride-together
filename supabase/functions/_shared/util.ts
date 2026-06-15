// Shared helpers for RideTogether Edge Functions (Deno runtime).
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Service-role client — bypasses RLS. NEVER expose this key to the browser. */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

/** Best-effort caller fingerprint for rate limiting (hashed, not stored raw). */
export async function fingerprint(req: Request): Promise<string> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';
  const data = new TextEncoder().encode(ip + (req.headers.get('user-agent') ?? ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sliding-window rate limit backed by the `ratelimit` table. Returns true if
 * the action is allowed. Uses the atomic `rl_hit` RPC (see hardened.sql).
 */
export async function rateLimit(
  sb: SupabaseClient,
  key: string,
  action: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await sb.rpc('rl_hit', {
    p_key: `${action}:${key}`,
    p_max: max,
    p_window: windowSeconds,
  });
  if (error) return true; // fail-open: never block legitimate users on RL infra errors
  return data === true;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function rideCode(len = 6): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[a[i] % CODE_ALPHABET.length];
  return out;
}

export function token(bytes = 18): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
