import { PACKAGE, PRODUCT } from './rules.ts';
import { reportProviderFailure } from './provider-diagnostics.ts';
const bytes = (s: string) => new TextEncoder().encode(s);
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
export const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(s)))).map(x => x.toString(16).padStart(2, '0')).join('');
let cached: { token: string; until: number } | null = null;
async function accessToken() {
  if (cached && cached.until > Date.now()) return cached.token;
  const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
  if (!raw) throw new Error('STORE_NOT_CONFIGURED');
  const account = JSON.parse(raw), now = Math.floor(Date.now() / 1000);
  const header = b64(bytes(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64(bytes(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const jwt = header + '.' + body + '.' + b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, bytes(header + '.' + body))));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  if (!response.ok) throw new Error('STORE_AUTH_UNAVAILABLE');
  const result = await response.json();
  cached = { token: result.access_token, until: Date.now() + Math.min(Number(result.expires_in) || 3600, 3600) * 1000 - 60000 };
  return cached.token;
}
export async function subscription(token: string) {
  if (token.length < 10 || token.length > 4096) throw new Error('INVALID_PURCHASE');
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Authorization: 'Bearer ' + await accessToken() } });
  if (!response.ok) { await reportProviderFailure(response, 'lookup'); throw new Error('PURCHASE_NOT_VERIFIED'); }
  return response.json();
}
export async function acknowledge(token: string, resubscribeAccount?: string) {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/subscriptions/${PRODUCT}/tokens/${encodeURIComponent(token)}:acknowledge`;
  // Google removes outOfAppPurchaseContext after acknowledgement. Preserve its verified
  // account binding in Google's current identifiers for later renewals and restores.
  const body = resubscribeAccount ? { externalAccountIds: { obfuscatedAccountId: resubscribeAccount } } : {};
  const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(12000), headers: { Authorization: 'Bearer ' + await accessToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { await reportProviderFailure(response, 'acknowledge'); throw new Error('ACKNOWLEDGEMENT_PENDING'); }
}
export async function signProof(claims: Record<string, unknown>) {
  const raw = Deno.env.get('LITTLES_PLUS_SIGNING_JWK');
  if (!raw) throw new Error('STORE_NOT_CONFIGURED');
  const key = await crypto.subtle.importKey('jwk', JSON.parse(raw), {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['sign']);
  const content = b64(bytes(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))) + '.' + b64(bytes(JSON.stringify(claims)));
  return content + '.' + b64(new Uint8Array(await crypto.subtle.sign({name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, key, bytes(content))));
}
