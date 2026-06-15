// POST /functions/v1/claim-leader
// Re-establish leadership from any device using the secret leader token.
// The token is validated server-side (service role) and never exposed to clients.
// Body: { rideId, leaderToken }
import { adminClient, corsHeaders, err, json, token } from '../_shared/util.ts';

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
  const leaderToken = String(body.leaderToken ?? '');
  if (!rideId || !leaderToken) return err('Missing rideId or leaderToken');

  const sb = adminClient();

  const { data: ride, error: rErr } = await sb
    .from('rides')
    .select('id, leader_token, status')
    .eq('id', rideId)
    .maybeSingle();
  if (rErr) return err(rErr.message, 500);
  if (!ride) return err('Ride not found.', 404);
  if (ride.status === 'ended') return err('This ride has ended.', 409);
  if (ride.leader_token !== leaderToken) return err('Invalid leader link.', 403);

  // Create a fresh leader participant for this device.
  const sessionToken = token();
  const name = 'Leader';
  const color = '#2f7dff';
  const { data: part, error: pErr } = await sb
    .from('participants')
    .insert({ ride_id: rideId, session_token: sessionToken, name, color, is_leader: true })
    .select('id')
    .single();
  if (pErr) return err(pErr.message, 500);

  return json({ participantId: part.id, sessionToken, name, color });
});
