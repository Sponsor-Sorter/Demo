const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PDF_PREFIX = 'data:application/pdf;base64,';
const MAX_PDF_BYTES = 256000;
const UNAVAILABLE = 'The campaign recap could not be generated. Please try again.';

export function validateCampaignRecap(data, offerId) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.error !== null ||
      data.documentType !== 'campaign-recap' || typeof data.documentId !== 'string' ||
      !/^campaign-recap:[0-9a-f-]{36}:v1$/i.test(data.documentId) ||
      !UUID.test(data.documentId.split(':')[1]) ||
      (offerId !== undefined && data.documentId !== `campaign-recap:${offerId}:v1`) ||
      typeof data.generated_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(data.generated_at) ||
      !Number.isFinite(Date.parse(data.generated_at)) ||
      data.metrics_source !== 'stored_unverified_observations' || data.provider_refreshed !== false ||
      data.financial_evidence !== false || typeof data.url !== 'string' || !data.url.startsWith(PDF_PREFIX)) {
    throw new Error(UNAVAILABLE);
  }
  const encoded = data.url.slice(PDF_PREFIX.length);
  if (!encoded || encoded.length > Math.ceil(MAX_PDF_BYTES / 3) * 4 || encoded.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error(UNAVAILABLE);
  let binary;
  try { binary = atob(encoded); } catch { throw new Error(UNAVAILABLE); }
  if (binary.length > MAX_PDF_BYTES || !binary.startsWith('%PDF-') ||
      !binary.slice(-1024).includes('%%EOF')) throw new Error(UNAVAILABLE);
  return {
    bytes: Uint8Array.from(binary, character => character.charCodeAt(0)),
    documentId: data.documentId, generatedAt: data.generated_at,
  };
}

export async function loadCampaignRecap(client, offerId, { signal } = {}) {
  if (typeof offerId !== 'string' || !UUID.test(offerId)) throw new Error(UNAVAILABLE);
  const controller = new AbortController();
  let timer;
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) throw new Error(UNAVAILABLE);
    const cancelled = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error(UNAVAILABLE)), { once: true });
      timer = setTimeout(abort, 25000);
    });
    return await Promise.race([
      (async () => {
        const sessionReply = await client.auth.getSession();
        const session = sessionReply?.data?.session;
        if (sessionReply?.error || !session?.access_token || !UUID.test(session?.user?.id || '')) {
          throw new Error('Sign in to generate a campaign recap.');
        }
        if (controller.signal.aborted) throw new Error(UNAVAILABLE);
        // The SDK supplies the project apikey and rejects non-success HTTP responses.
        const reply = await client.functions.invoke('generate_campaign_recap', {
          body: { offer_id: offerId },
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal,
        });
        if (reply?.error || (reply?.response && !reply.response.ok)) throw new Error(UNAVAILABLE);
        return validateCampaignRecap(reply?.data, offerId);
      })(),
      cancelled,
    ]);
  } catch (error) {
    if (error?.message === 'Sign in to generate a campaign recap.') throw error;
    throw new Error(UNAVAILABLE);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
