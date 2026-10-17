// One authenticated request; the deadline covers both headers and JSON parsing.
export async function affiliateRequest({ base, path, token, method = 'GET', body, fetchImpl = fetch, timeoutMs = 12000 }) {
  if (!token || token === 'undefined' || token === 'null') throw new Error('Please sign in again.');
  const baseUrl = String(base ?? '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(baseUrl)) throw new Error('Affiliate service address is unavailable.');
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(`${baseUrl}/${path}`, {
          method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data || Array.isArray(data) || typeof data !== 'object' || data.ok === false || data.success === false || data.error) {
          throw new Error('Affiliate request failed. Please try again later.');
        }
        return data;
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Affiliate request timed out. Please check its status before trying again.')); }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
