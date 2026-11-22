export async function rpc(name: string, body: unknown, bearer?: string) {
  const base = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!base || !key) throw Error('AD_BACKEND_UNAVAILABLE');
  const response = await fetch(base + '/rest/v1/rpc/' + name, {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { apikey: key, Authorization: 'Bearer ' + (bearer || key), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw Error('AD_BACKEND_UNAVAILABLE');
  return response.json();
}
