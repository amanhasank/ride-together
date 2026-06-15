// POST /functions/v1/join-ride
// Adds a participant after verifying the ride is joinable (active & not locked).
// Body: { rideId, name, color }
import { adminClient, corsHeaders, err, fingerprint, json, rateLimit, token } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return err('Method not allowed', 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON');
  }

  const rideId = String(body.rideId ?? '').trim().toUpperCase().slice(0, 8);
  const name = String(body.name ?? '').trim().slice(0, 24);
  const color = String(body.color ?? '#2f7dff').slice(0, 9);
  if (!rideId) return err('rideId is required');
  if (!name) return err('name is required');

  const sb = adminClient();

  const fp = await fingerprint(req);
  if (!(await rateLimit(sb, fp, 'join', 20, 60)))
    return err('Too many join attempts. Please wait a moment.', 429);

  const { data: ride, error: rErr } = await sb
    .from('rides')
    .select('id, name, status')
    .eq('id', rideId)
    .maybeSingle();
  if (rErr) return err(rErr.message, 500);
  if (!ride) return err('Ride not found.', 404);
  if (ride.status === 'ended') return err('This ride has ended.', 409);
  if (ride.status === 'locked') return err('This ride is locked.', 409);

  const sessionToken = token();
  const { data: part, error: pErr } = await sb
    .from('participants')
    .insert({ ride_id: rideId, session_token: sessionToken, name, color, is_leader: false })
    .select('id')
    .single();
  if (pErr) return err(pErr.message, 500);

  return json({ participantId: part.id, sessionToken });
});
