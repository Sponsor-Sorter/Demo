const assert = (v: unknown, label = 'Assertion failed') => { if (!v) throw Error(label); };

Deno.test('actual cloud handler preserves responses and only observes exact binding conflicts', async t => {
  const names = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const prior = names.map(n => Deno.env.get(n)), fetchBefore = globalThis.fetch, serveBefore = Deno.serve;
  const actor = '11111111-1111-4111-8111-111111111111', foreign = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let mode = 'conflict', handler: (request: Request) => Promise<Response>;
  const calls: { path: string; body: any; authorization: string | null }[] = [];
  Deno.env.set(names[0], 'https://fixture.invalid'); Deno.env.set(names[1], 'fixture-anon'); Deno.env.set(names[2], 'fixture-service');
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init), url = new URL(req.url), body = req.method === 'POST' ? await req.json() : null;
    calls.push({ path: url.pathname, body, authorization: req.headers.get('authorization') });
    if (url.pathname === '/auth/v1/user') return mode === 'auth' ? Response.json({ message: 'invalid token' }, { status: 401 }) : Response.json({ id: actor, aud: 'authenticated', role: 'authenticated', is_anonymous: false });
    if (url.pathname.endsWith('/meadow_littles_validate_session')) return Response.json(mode !== 'expired');
    if (url.pathname === '/rest/v1/meadow_littles_profiles') return Response.json({ user_id: actor });
    if (url.pathname.endsWith('/fairplay_game_moderation_status')) return Response.json({ app: 'littles', banned: false, restricted: false, decisions: [] });
    if (url.pathname.endsWith('/fairplay_game_detector_heartbeat_v1')) return Response.json({ accepted: true });
    if (url.pathname.endsWith('/fairplay_game_security_signal_v1')) {
      assert(req.headers.get('authorization') === 'Bearer fixture-service', 'Signal must use service credentials');
      return Response.json(mode === 'observer-fails' ? { error: 'unavailable' } : { accepted: true }, { status: mode === 'observer-fails' ? 503 : 200 });
    }
    if (url.pathname.endsWith('/meadow_littles_save')) {
      assert(body.p_expected_user_id === actor, 'The save must bind the verified actor');
      if (mode === 'success' || mode === 'replay') return Response.json({ ok: true, replayed: mode === 'replay', revision: 2 });
      const errors: Record<string, [string, string]> = {
        revision: ['PT409', 'LITTLES_SAVE_REVISION_CONFLICT'], rate: ['PT429', 'LITTLES_SAVE_RATE_LIMIT'],
        invalid: ['22023', 'LITTLES_INVALID_SAVE'], banned: ['42501', 'LITTLES_BANNED'],
        generic: ['50000', 'infrastructure unavailable'],
      };
      const [code, message] = errors[mode] ?? ['PT409', 'LITTLES_REQUEST_BINDING_CONFLICT'];
      return Response.json({ code, message, details: null, hint: null }, { status: 409 });
    }
    throw Error('Unexpected isolated request: ' + url.pathname);
  }) as typeof fetch;
  (Deno as any).serve = (run: typeof handler) => { handler = run; return {}; };
  try {
    await import('./index.ts?security95-test');
    Deno.serve = serveBefore;
    const save = { p_request_id: '22222222-2222-4222-8222-222222222222', p_expected_revision: 1, p_cloud_version: 1, p_save_data: { schema: 1, stars: 10 } };
    for (const [name, status, signals] of [
      ['conflict', 409, 1], ['revision', 409, 0], ['rate', 409, 0], ['invalid', 409, 0],
      ['banned', 403, 0], ['generic', 409, 0], ['success', 200, 0], ['replay', 200, 0],
      ['observer-fails', 409, 1], ['auth', 401, 0], ['expired', 401, 0],
      ['forged-top-actor', 400, 0], ['forged-save-actor', 400, 0], ['unsupported-version', 400, 0],
    ] as [string, number, number][]) await t.step(name, async () => {
      mode = name; calls.length = 0;
      const body = name === 'forged-top-actor' ? { action: 'save', save, actor: foreign } :
        name === 'forged-save-actor' ? { action: 'save', save: { ...save, p_expected_user_id: foreign } } :
        name === 'unsupported-version' ? { action: 'save', save: { ...save, p_cloud_version: 2 } } : { action: 'save', save };
      const response = await handler!(new Request('https://fixture.invalid/functions/v1/meadow-littles-fairplay', {
        method: 'POST', headers: { authorization: 'Bearer fixture-user-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }));
      const result = await response.json(), observed = calls.filter(c => c.path.endsWith('/fairplay_game_security_signal_v1'));
      assert(response.status === status, name + ' changed public HTTP status');
      assert(observed.length === signals, name + ' produced incorrect evidence');
      if (signals) {
        const p = observed[0].body;
        assert(p.p_actor === actor && p.p_source === 'littles-cloud-save' && p.p_code === 'request_payload_conflict');
        assert(!JSON.stringify(p).includes(foreign) && !JSON.stringify(p).includes('stars'));
        assert(result.code === 'LITTLES_REQUEST_BINDING_CONFLICT', 'Observation changed original rejection');
      }
      if (name === 'replay') assert(result.result.replayed === true);
      if (name.startsWith('forged-') || name === 'auth' || name === 'expired' || name === 'unsupported-version')
        assert(!calls.some(c => c.path.endsWith('/meadow_littles_save')), 'Invalid identity reached save');
    });
  } finally {
    Deno.serve = serveBefore; globalThis.fetch = fetchBefore;
    names.forEach((n, i) => prior[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, prior[i]!));
  }
});
