// POST /functions/v1/create-ride
// Creates a ride + leader participant with server-generated secrets.
// Body: { name?, description?, destination?: {lat,lng,label}, leaderName, leaderColor }
import { adminClient, corsHeaders, err, fingerprint, json, rateLimit, rideCode, token } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return err('Method not allowed', 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON');
  }

  const leaderName = String(body.leaderName ?? '').trim().slice(0, 24);
  if (!leaderName) return err('leaderName is required');
  const leaderColor = String(body.leaderColor ?? '#2f7dff').slice(0, 9);

  const sb = adminClient();

  // Rate limit: max 5 rides / minute per caller.
  const fp = await fingerprint(req);
  if (!(await rateLimit(sb, fp, 'create', 5, 60)))
    return err('Too many rides created. Please wait a moment.', 429);

  const leaderToken = token();
  const sessionToken = token();
  const dest = body.destination;

  // Insert ride, retrying on the (rare) code collision.
  let ride: any = null;
  for (let i = 0; i < 5 && !ride; i++) {
    const { data, error } = await sb
      .from('rides')
      .insert({
        id: rideCode(),
        name: String(body.name ?? '').trim().slice(0, 40) || 'Group Ride',
        description: String(body.description ?? '').trim().slice(0, 140) || null,
        leader_token: leaderToken,
        status: 'active',
        dest_lat: dest?.lat ?? null,
        dest_lng: dest?.lng ?? null,
        dest_label: dest?.label ?? null,
      })
      .select()
      .single();
    if (!error) ride = data;
    else if (!`${error.message}`.includes('duplicate')) return err(error.message, 500);
  }
  if (!ride) return err('Could not allocate a ride code. Try again.', 500);

  const { data: part, error: pErr } = await sb
    .from('participants')
    .insert({
      ride_id: ride.id,
      session_token: sessionToken,
      name: leaderName,
      color: leaderColor,
      is_leader: true,
    })
    .select('id')
    .single();
  if (pErr) return err(pErr.message, 500);

  return json({
    ride: { ...ride, leader_token: undefined },
    participantId: part.id,
    sessionToken,
    leaderToken,
  });
});
