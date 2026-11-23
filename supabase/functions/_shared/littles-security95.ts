import { emitSecuritySignal } from './fairplay-security-contract-v1.mjs';

type Rpc = (name: string, args: Record<string, unknown>) => Promise<any>;
type Source = 'littles-play-store' | 'littles-cloud-save';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Observations never change a save, purchase, entitlement or public response. */
export function createLittlesEvidence(rpc: Rpc, source: Source, now = Date.now) {
  let nextHeartbeat = -Infinity;
  async function heartbeat() {
    const at = now();
    if (at < nextHeartbeat) return;
    nextHeartbeat = at + 60000;
    try {
      const result = await rpc('fairplay_game_detector_heartbeat_v1', {
        p_app: 'littles', p_source: source, p_version: 'littles-security95',
      });
      if ((result?.data ?? result)?.accepted !== true) throw Error('Unavailable');
    } catch { /* Coverage stays stale when the observer cannot report. */ }
  }
  async function rejectedSave(actor: string, requestId: unknown, code: unknown, message: unknown) {
    // Only this exact database branch proves a changed payload under a stored request reference.
    // Actor comes from auth.getUser AND the live session RPC, never from the save body.
    if (source !== 'littles-cloud-save' || !uuid.test(actor) ||
        typeof requestId !== 'string' || !uuid.test(requestId) ||
        code !== 'PT409' || message !== 'LITTLES_REQUEST_BINDING_CONFLICT') return { accepted: false };
    try {
      const canonicalActor = actor.toLowerCase(), canonicalRequest = requestId.toLowerCase();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
        JSON.stringify(['littles', source, canonicalActor, canonicalRequest, 'request_payload_conflict']),
      ));
      const correlation = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
      return await emitSecuritySignal(rpc, {
        app: 'littles', actor: canonicalActor, event_id: crypto.randomUUID(), source,
        code: 'request_payload_conflict',
        context: { operation: 'save', request_id: canonicalRequest, correlation_hash: correlation,
          protocol: 'meadow-littles-cloud-v1', verification_stage: 'authenticated_rpc_rejected_binding' },
      });
    } catch { return { accepted: false, unavailable: true }; }
  }
  return { heartbeat, rejectedSave };
}
