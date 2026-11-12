import { reportProviderFailure } from './provider-diagnostics.ts';

Deno.test('provider diagnostics exclude raw tokens, URLs and provider messages', async () => {
  const lines: string[] = [], prior = console.warn;
  console.warn = (...args: unknown[]) => { lines.push(args.join(' ')); };
  try {
    await reportProviderFailure(new Response(JSON.stringify({ error: { message: 'secret-token https://provider.invalid/secret-token', errors: [{ reason: 'permissionDenied' }] } }), { status: 403 }), 'acknowledge');
    if (lines.length !== 1 || !lines[0].includes('permissionDenied') || !lines[0].includes('403') || /secret-token|provider.invalid/.test(lines[0])) throw new Error('Unsafe provider diagnostic');
  } finally { console.warn = prior; }
});

Deno.test('provider diagnostics reject unbounded or non-enum reason content', async () => {
  const lines: string[] = [], prior = console.warn;
  console.warn = (...args: unknown[]) => { lines.push(args.join(' ')); };
  try {
    await reportProviderFailure(new Response(JSON.stringify({ error: { errors: [{ reason: 'private token / URL' }] } }), { status: 400 }), 'lookup');
    await reportProviderFailure(new Response('<html>private provider payload</html>', { status: 502 }), 'lookup');
    if (lines.length !== 2 || lines.some(line => !line.includes('unknown') || /private|payload|URL/.test(line))) throw new Error('Provider payload escaped enum boundary');
  } finally { console.warn = prior; }
});
