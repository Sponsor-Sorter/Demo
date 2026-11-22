const bytes = (value: string) => new TextEncoder().encode(value);
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export function signatureRaw(der: Uint8Array) {
  let at = 0;
  if (der[at++] !== 0x30 || der[at++] !== der.length - 2 || der.length >= 130) throw Error('INVALID_SIGNATURE');
  const result = new Uint8Array(64);
  for (let part = 0; part < 2; part++) {
    if (der[at++] !== 2) throw Error('INVALID_SIGNATURE');
    const length = der[at++];
    if (length < 1 || length > 33 || at + length > der.length) throw Error('INVALID_SIGNATURE');
    let integer = der.slice(at, at + length); at += length;
    if (integer[0] & 0x80 || integer.length > 1 && integer[0] === 0 && !(integer[1] & 0x80)) throw Error('INVALID_SIGNATURE');
    if (integer[0] === 0) integer = integer.slice(1);
    if (integer.length > 32) throw Error('INVALID_SIGNATURE');
    result.set(integer, part * 32 + 32 - integer.length);
  }
  if (at !== der.length) throw Error('INVALID_SIGNATURE');
  return result;
}
export function createVerifier(fetcher: typeof fetch = fetch, now = Date.now) {
  let cached: { until: number; keys: Array<{ keyId: number; pem: string }> } | null = null;
  return async (url: URL) => {
    const query = url.search.slice(1), cut = query.indexOf('&signature=');
    if (query.length > 8192 || cut < 1) throw Error('INVALID_SIGNATURE');
    const signed = query.slice(0, cut), suffix = new URLSearchParams(query.slice(cut + 1)), params = new URLSearchParams(signed);
    if ([...suffix.keys()].join(',') !== 'signature,key_id' || new Set(params.keys()).size !== [...params.keys()].length) throw Error('INVALID_SIGNATURE');
    if (!cached || cached.until <= now()) {
      const response = await fetcher('https://www.gstatic.com/admob/reward/verifier-keys.json', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Error('KEYS_UNAVAILABLE');
      const data = await response.json();
      if (!Array.isArray(data.keys) || data.keys.length > 50 || data.keys.some((k: any) => !Number.isSafeInteger(k.keyId) || typeof k.pem !== 'string' || k.pem.length > 4096)) throw Error('INVALID_KEYS');
      cached = { until: now() + 3600000, keys: data.keys };
    }
    const key = cached.keys.find(k => String(k.keyId) === suffix.get('key_id'));
    if (!key) { cached = null; throw Error('UNKNOWN_KEY'); }
    const der = decode(key.pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''));
    const publicKey = await crypto.subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signatureRaw(decode(suffix.get('signature') || '')), bytes(signed))) throw Error('INVALID_SIGNATURE');
    return params;
  };
}
export const verifyCallback = createVerifier();
