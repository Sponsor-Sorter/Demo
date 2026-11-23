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
export const commandSecurityRuntimeVersion='meadow-command-security-v1.1';
export type SecurityHeartbeat={p_app:'meadow';p_source:'meadow-market-farm-actions';p_version:typeof commandSecurityRuntimeVersion};
export type HeartbeatEmitter=(body:SecurityHeartbeat,signal:AbortSignal)=>Promise<unknown>;
type Operation='signal'|'heartbeat';
type FailureReason='delivery'|'timeout'|'rpc_error'|'invalid_ack';
export type SecurityObserverFailure={event:'security_observer_unavailable';app:'meadow';source:'meadow-market-farm-actions';version:typeof commandSecurityRuntimeVersion;operation:Operation;reason:FailureReason;failures:number};
export type FailureReporter=(notice:SecurityObserverFailure)=>unknown;
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

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function ackFailure(raw:unknown,operation:Operation):FailureReason|undefined{
 if(!record(raw))return 'invalid_ack';
 if(raw.error!=null)return 'rpc_error';
 const ack=Object.hasOwn(raw,'data')?raw.data:raw;
 if(!record(ack))return 'invalid_ack';
 if(ack.error!=null)return 'rpc_error';
 if(operation==='heartbeat')return ack.accepted===true&&ack.disabled!==true&&ack.capped!==true?undefined:'invalid_ack';
 if(ack.accepted===false&&((ack.disabled===true&&ack.capped!==true)||(ack.capped===true&&ack.disabled!==true)))return;
 if(ack.accepted!==true||typeof ack.duplicate!=='boolean'||typeof ack.reference!=='string'||!uuid(ack.reference)
  ||(ack.flag_id!=null&&(typeof ack.flag_id!=='string'||!uuid(ack.flag_id)))||ack.disabled===true||ack.capped===true)return 'invalid_ack';
}

// One instance per gateway isolate. No actor/request identity is retained here.
// Failed attempts also consume the heartbeat interval, preventing outage storms.
export function createCommandSecurityObserver(options:{emit?:SecurityEmitter;heartbeat?:HeartbeatEmitter;onFailure?:FailureReporter;now?:()=>number;timeoutMs?:number}={}){
 const now=options.now||(()=>performance.now()),timeoutMs=Number.isFinite(options.timeoutMs)?Math.max(1,Math.min(1000,options.timeoutMs!)):1000;
 const onFailure=options.onFailure||((notice:SecurityObserverFailure)=>console.warn('MEADOW_SECURITY_OBSERVER',JSON.stringify(notice)));
 const attempts={signal:0,heartbeat:0},failures={signal:0,heartbeat:0},lastLog:{signal:number|null;heartbeat:number|null}={signal:null,heartbeat:null};
 let lastHeartbeat:number|null=null;
 function failed(operation:Operation,reason:FailureReason){
  failures[operation]=Math.min(1e12,failures[operation]+1);
  const at=now(),previous=lastLog[operation];if(previous!==null&&at-previous<60000)return;
  lastLog[operation]=at;
  const notice:SecurityObserverFailure={event:'security_observer_unavailable',app:'meadow',source:'meadow-market-farm-actions',version:commandSecurityRuntimeVersion,operation,reason,failures:failures[operation]};
  try{void Promise.resolve(onFailure(notice)).catch(()=>{});}catch{/* A log sink cannot change the game result. */}
 }
 async function deliver(operation:Operation,send:(signal:AbortSignal)=>Promise<unknown>){
  attempts[operation]=Math.min(1e12,attempts[operation]+1);
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,timedOut=false;
  const deadline=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{timedOut=true;controller.abort();reject(Error('Observer timeout'));},timeoutMs);});
  try{const reason=ackFailure(await Promise.race([send(controller.signal),deadline]),operation);if(reason)failed(operation,reason);}
  catch{failed(operation,timedOut?'timeout':'delivery');}
  finally{clearTimeout(timer);controller.abort();}
 }
 return {
  // Invoke only after the database transaction has rolled back.
  async report(actor:string,requestId:string){
   if(options.emit)await deliver('signal',async signal=>{const body=await commandReceiptSignal(actor,requestId);if(signal.aborted)throw Error('Observer cancelled');return options.emit!(body,signal);});
  },
  // Called only by the validated live-control-session handler, never by a timer
  // or service SQL probe. Claim the interval synchronously to coalesce requests.
  async heartbeat(){
   if(!options.heartbeat)return;
   const at=now();if(lastHeartbeat!==null&&at-lastHeartbeat<300000)return;
   lastHeartbeat=at;
   await deliver('heartbeat',signal=>options.heartbeat!({p_app:'meadow',p_source:'meadow-market-farm-actions',p_version:commandSecurityRuntimeVersion},signal));
  },
  snapshot:()=>({attempts:{...attempts},failures:{...failures}})
 };
}

// Retained for isolated callers; the gateway uses one long-lived observer above.
export async function reportCommandReceiptConflict(emit:SecurityEmitter|undefined,actor:string,requestId:string,timeoutMs=1000){
 await createCommandSecurityObserver({emit,timeoutMs}).report(actor,requestId);
}
