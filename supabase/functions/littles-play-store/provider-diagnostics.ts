// Provider error bodies can contain purchase URLs/tokens. Log only bounded enums.
export async function reportProviderFailure(response: Response, operation: 'lookup' | 'acknowledge') {
  let reason = 'unknown';
  try {
    const body = await response.json();
    const candidate = body?.error?.errors?.[0]?.reason || body?.error?.status;
    if (typeof candidate === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(candidate)) reason = candidate;
  } catch { /* An HTML/empty error body is still a provider failure. */ }
  console.warn('LITTLES_PLAY_PROVIDER_FAILURE', JSON.stringify({ operation, http_status: response.status, reason }));
}
