import {FarmActionError} from './meadow-farm-actions204.ts';

// This marker is emitted at the authoritative receipt/body-hash comparison only.
// It is not a client field, an SQLSTATE category, or proof of player intent.
export const commandReceiptConflictDetail='MEADOW_COMMAND_RECEIPT_CONFLICT_V1';
export class CommandReceiptConflictError extends FarmActionError {
 constructor(){super('INVALID_REQUEST','Reopen your saved farm before retrying this action.');}
}
export type CommandSecuritySignal={
 p_app:'meadow';p_actor:string;p_event_id:string;
 p_source:'meadow-market-farm-actions';p_code:'request_payload_conflict';
 p_context:{operation:'farm.command';protocol:4;request_id:string;correlation_hash:string;verification_stage:'command_receipt_hash'};
};
export type SecurityEmitter=(body:CommandSecuritySignal,signal:AbortSignal)=>Promise<unknown>;
const uuid=(v:string)=>/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);

// Context is deliberately immutable across transport retries and gateway builds.
// A reused reference counts once, even if many changed payloads are submitted.
export async function commandReceiptSignal(actor:string,requestId:string):Promise<CommandSecuritySignal>{
 if(!uuid(actor)||!uuid(requestId))throw Error('Verified command identity required');
 actor=actor.toLowerCase();requestId=requestId.toLowerCase();
 const input=JSON.stringify(['meadow-security-v1','meadow-market-farm-actions','request_payload_conflict',actor,requestId]);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));
 const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 // Namespace-derived UUIDv8; never reuse the client UUID as an app-global event ID.
 const event=hash.slice(0,8)+'-'+hash.slice(8,12)+'-8'+hash.slice(13,16)+'-'+((parseInt(hash[16],16)&3)|8).toString(16)+hash.slice(17,20)+'-'+hash.slice(20,32);
 return {p_app:'meadow',p_actor:actor,p_event_id:event,p_source:'meadow-market-farm-actions',p_code:'request_payload_conflict',p_context:{operation:'farm.command',protocol:4,request_id:requestId,correlation_hash:hash,verification_stage:'command_receipt_hash'}};
}

// Invoke only from the Edge catch after the failed database RPC has rolled back.
// Missing central rollout, timeout and observer failure cannot change the denial.
export async function reportCommandReceiptConflict(emit:SecurityEmitter|undefined,actor:string,requestId:string,timeoutMs=1000){
 if(!emit)return;
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<void>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve();},timeoutMs);});
 const send=(async()=>{const body=await commandReceiptSignal(actor,requestId);if(!controller.signal.aborted)await emit(body,controller.signal);})();
 try{await Promise.race([send,deadline]);}catch{/* Never log provider bodies, credentials or save contents. */}
 finally{clearTimeout(timer);controller.abort();}
}
