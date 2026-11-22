export const UNIT = 'ca-app-pub-6946008351204848/6193791997';
type Dependencies = { verify: (url: URL) => Promise<URLSearchParams>; record: (data: unknown) => Promise<unknown>; now?: () => number };
export function rewardData(params: URLSearchParams, now = Date.now()) {
  const unit = params.get('ad_unit'), transaction = params.get('transaction_id'), challenge = params.get('custom_data'), timestamp = Number(params.get('timestamp'));
  if (![UNIT, UNIT.split('/')[1]].includes(unit || '') || params.get('reward_amount') !== '1' || params.get('reward_item') !== 'extra_round' ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(challenge || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(transaction || '') ||
    !Number.isSafeInteger(timestamp) || timestamp <= now - 86400000 || timestamp > now + 60000) throw Error('INVALID_RECEIPT');
  return { p_challenge: challenge, p_transaction: transaction, p_unit: UNIT, p_at: new Date(timestamp).toISOString() };
}
export function createHandler(deps: Dependencies) {
  return async (request: Request) => {
    if (request.method !== 'GET') return new Response('GET required', { status: 405 });
    try {
      const params = await deps.verify(new URL(request.url));
      // Google's signed configuration test proves transport only and never issues a credit.
      if (params.get('user_id') === 'littles-admob-setup' && params.get('custom_data') === 'verification-only') return new Response('Verified setup; no reward issued', { status: 200 });
      const result = await deps.record(rewardData(params, (deps.now || Date.now)())) as { recorded?: boolean };
      if (result?.recorded !== true) throw Error('RECEIPT_NOT_RECORDED');
      return new Response('OK', { status: 200, headers: { 'Cache-Control': 'no-store' } });
    } catch { return new Response('Reward verification unavailable', { status: 403 }); }
  };
}
