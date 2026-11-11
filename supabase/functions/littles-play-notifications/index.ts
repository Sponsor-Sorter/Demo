import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.9.6/index.ts';
import { parseNotification } from '../littles-play-store/rules.ts';
import { reconcile } from '../littles-play-store/service.ts';
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('POST required', { status: 405 });
  const audience = Deno.env.get('LITTLES_PLAY_RTDN_AUDIENCE'), email = Deno.env.get('LITTLES_PLAY_PUBSUB_EMAIL');
  if (!audience || !email) return new Response('Notifications not configured', { status: 503 });
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer /i, '');
    const { payload } = await jwtVerify(token, keys, { audience, issuer: ['https://accounts.google.com', 'accounts.google.com'], algorithms: ['RS256'] });
    if (payload.email !== email || payload.email_verified !== true) return new Response('Unauthorized', { status: 401 });
  } catch { return new Response('Unauthorized', { status: 401 }); }
  try {
    const token = parseNotification(await request.text());
    if (token) await reconcile(token);
    return new Response('OK');
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    // Retry temporary provider failures. Never log/reflect provider purchase tokens.
    return new Response('Notification not processed', { status: ['INVALID_NOTIFICATION', 'WRONG_PACKAGE'].includes(code) ? 400 : 503 });
  }
});
