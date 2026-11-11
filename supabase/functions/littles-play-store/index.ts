import { PACKAGE, PRODUCT } from './rules.ts';
import { signProof } from './google.ts';
import { reconcile, rpc } from './service.ts';
const origins = new Set(['https://sponsorsorter.com', 'https://localhost']);
Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'https://sponsorsorter.com', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS', Vary: 'Origin' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.has(origin)) return reply(403, { error: 'UNSUPPORTED_ADDRESS' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'POST_REQUIRED' });
  try {
    const bearer = (request.headers.get('authorization') || '').replace(/^Bearer /i, '');
    if (!bearer) return reply(401, { error: 'PARENT_SIGN_IN_REQUIRED' });
    const raw = await request.text();
    if (raw.length > 8192) return reply(413, { error: 'REQUEST_TOO_LARGE' });
    const body = JSON.parse(raw), status = await rpc('meadow_littles_play_status', {}, bearer);
    if (body.action === 'verify') {
      if (!status.parent_ready) return reply(403, { error: 'PARENT_SIGN_IN_REQUIRED' });
      if (typeof body.token !== 'string') return reply(400, { error: 'INVALID_PURCHASE' });
      await reconcile(body.token, status.user_id);
    } else if (body.action !== 'status') return reply(400, { error: 'UNKNOWN_ACTION' });
    const current = body.action === 'verify' ? await rpc('meadow_littles_play_status', {}, bearer) : status;
    // Owner admin and consumer reads use the same fresh paid/gift projection.
    const projection = await rpc('meadow_littles_plus_projection', { p_user: current.user_id });
    const eligible = current.parent_ready === true;
    const plus = { active: eligible && projection.effective_plus === true, paid: eligible && projection.paid_active === true, complimentary: eligible && projection.complimentary_active === true }, now = Math.floor(Date.now() / 1000);
    const proofUntil = Math.min(now + (plus.paid ? 86400 : 300), plus.paid ? Math.floor(Date.parse(projection.paid_until) / 1000) : now + 300);
    const proof = plus.active ? await signProof({ iss: 'littles-play-v1', aud: PACKAGE, sub: current.user_id, product: PRODUCT, iat: now, exp: proofUntil, paid: plus.paid, complimentary: plus.complimentary }) : null;
    return reply(200, { contract: 'littles-play-v1', ...current, paid_active: projection.paid_active, paid_until: projection.paid_until, entitlement_verified: projection.effective_verified, plus: plus.active, sources: plus, proof });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return reply(code === 'PURCHASE_ACCOUNT_MISMATCH' ? 403 : 503, { error: ['PURCHASE_ACCOUNT_MISMATCH', 'PURCHASE_PRODUCT_MISMATCH', 'LICENSE_TEST_NOT_ENABLED'].includes(code) ? code : 'PURCHASE_CHECK_UNAVAILABLE' });
  }
});
