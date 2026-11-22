import { rpc } from '../littles-ad-rounds/backend.ts';
import { verifyCallback } from './verify.ts';
import { createHandler } from './handler.ts';
// This webhook has no user JWT. Every non-probe write requires Google's ECDSA signature.
Deno.serve(createHandler({ verify: verifyCallback, record: data => rpc('meadow_littles_record_ad_round', data) }));
