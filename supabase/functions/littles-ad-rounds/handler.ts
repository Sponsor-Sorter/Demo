type Rpc = (name: string, data: unknown, bearer?: string) => Promise<any>;
const origins = new Set(['https://sponsorsorter.com', 'https://localhost']);
export function createHandler(rpc: Rpc) {
  return async (request: Request) => {
    const origin = request.headers.get('origin') || '';
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'https://sponsorsorter.com', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS', Vary: 'Origin' };
    const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !origins.has(origin)) return reply(403, { error: 'UNSUPPORTED_ADDRESS' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'POST_REQUIRED' });
    const bearer = (request.headers.get('authorization') || '').replace(/^Bearer /i, '');
    if (!bearer) return reply(401, { error: 'SIGN_IN_REQUIRED' });
    try {
      const raw = await request.text();
      if (raw.length > 4096) return reply(413, { error: 'REQUEST_TOO_LARGE' });
      const body = JSON.parse(raw);
      if (!body || !['status', 'prepare', 'claim'].includes(body.action) || typeof body.data !== 'object' || !body.data || Array.isArray(body.data)) return reply(400, { error: 'INVALID_AD_REQUEST' });
      // The RPC derives the actor from the live user session, never from body fields.
      const result = await rpc('meadow_littles_ad_rounds', { p_action: body.action, p_data: body.data }, bearer);
      if (result?.contract !== 'littles-ad-round-v1') throw Error('INVALID_AD_RESPONSE');
      return reply(200, result);
    } catch { return reply(503, { error: 'AD_NOT_AVAILABLE' }); }
  };
}
