// POST /functions/v1/ride-action
// Leader-only mutations. Authority is proven by leader_token, validated here
// against the ride row using the service role — never trusted from the client.
// Body: { rideId, leaderToken, action, payload? }
//   action: 'rename' | 'set-destination' | 'clear-destination' |
//           'lock' | 'unlock' | 'remove-participant' | 'end'
import { adminClient, corsHeaders, err, json } from '../_shared/util.ts';

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
  const action = String(body.action ?? '');
  const payload = body.payload ?? {};
  if (!rideId || !leaderToken || !action) return err('Missing rideId, leaderToken or action');

  const sb = adminClient();

  // ── Authority check ─────────────────────────────────────────────────────
  const { data: ride, error: rErr } = await sb
    .from('rides')
    .select('id, leader_token, dest_lat, dest_lng, dest_label')
    .eq('id', rideId)
    .maybeSingle();
  if (rErr) return err(rErr.message, 500);
  if (!ride) return err('Ride not found.', 404);
  if (ride.leader_token !== leaderToken) return err('Not authorized.', 403);

  switch (action) {
    case 'rename': {
      const name = String(payload.name ?? '').trim().slice(0, 40);
      if (!name) return err('name required');
      await sb.from('rides').update({ name }).eq('id', rideId);
      break;
    }
    case 'set-destination': {
      const { lat, lng, label } = payload;
      if (typeof lat !== 'number' || typeof lng !== 'number') return err('lat/lng required');
      await sb
        .from('rides')
        .update({ dest_lat: lat, dest_lng: lng, dest_label: String(label ?? '').slice(0, 60) || 'Destination' })
        .eq('id', rideId);
      break;
    }
    case 'clear-destination':
      await sb.from('rides').update({ dest_lat: null, dest_lng: null, dest_label: null }).eq('id', rideId);
      break;
    case 'lock':
      await sb.from('rides').update({ status: 'locked' }).eq('id', rideId);
      break;
    case 'unlock':
      await sb.from('rides').update({ status: 'active' }).eq('id', rideId);
      break;
    case 'remove-participant': {
      const pid = String(payload.participantId ?? '');
      if (!pid) return err('participantId required');
      await sb.from('participants').delete().eq('id', pid).eq('ride_id', rideId);
      break;
    }
    case 'end':
      await sb
        .from('rides')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', rideId);
      break;
    default:
      return err('Unknown action');
  }

  return json({ ok: true });
});
