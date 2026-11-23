// Game-owned commerce evidence. References enter only a one-way correlation;
// caller tokens, callback bodies and ledger owner identifiers are never logged.
type Source='meadow-market-store'|'meadow-market-ad-reward';
type Field='receipt_owner'|'receipt_product'|'nonce_transaction';
type Data=Record<string,unknown>;
export type SecurityRpc=(name:string,body:Data,signal:AbortSignal)=>Promise<unknown>;
export type CommerceObserver={heartbeat:()=>Promise<void>;signal:(actor:string,references:string[],field:Field)=>Promise<void>;unattributed:()=>void};
export const commerceSecurityVersion='meadow-commerce-security-v1';
const record=(x:unknown):x is Data=>!!x&&typeof x==='object'&&!Array.isArray(x);
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x);
export async function securityHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
export class StoreBindingConflict extends Error{
 constructor(readonly field:'receipt_owner'|'receipt_product'){super('STORE_DELIVERY_UNAVAILABLE');}
}
export function storeDatabaseError(code:unknown,message:unknown,details:unknown){
 if(code==='22023'&&message==='Purchase belongs to another account or was revoked'){
  if(details==='MEADOW_STORE_RECEIPT_OWNER_CONFLICT_V1')return new StoreBindingConflict('receipt_owner');
  if(details==='MEADOW_STORE_RECEIPT_PRODUCT_CONFLICT_V1')return new StoreBindingConflict('receipt_product');
 }
 return Error('STORE_DELIVERY_UNAVAILABLE');
}
// Actor is supplied by the DB's locked nonce row, never callback user_id.
export function rewardDatabaseDenial(value:unknown):{actor:string}|null{
 if(!record(value)||value.code!=='22023'||value.message!=='Ad nonce reused'||typeof value.details!=='string')return null;
 try{const detail=JSON.parse(value.details);if(record(detail)&&Object.keys(detail).length===2&&detail.code==='MEADOW_AD_NONCE_TRANSACTION_CONFLICT_V1'&&uuid(detail.actor))return {actor:detail.actor.toLowerCase()};}catch{/* Not a typed DB outcome. */}
 return null;
}
export function createCommerceObserver(source:Source,rpc:SecurityRpc,options:{now?:()=>number;timeoutMs?:number;log?:(notice:Data)=>unknown}={}):CommerceObserver{
 const now=options.now||(()=>performance.now()),timeout=Number.isFinite(options.timeoutMs)?Math.max(1,Math.min(1000,options.timeoutMs!)):1000;
 const log=options.log||((notice:Data)=>console.warn('MEADOW_SECURITY_OBSERVER',JSON.stringify(notice)));
 const failures={signal:0,heartbeat:0,unattributed:0},lastLog:{[key:string]:number|undefined}={};let lastBeat:number|undefined;
 function notice(operation:keyof typeof failures,reason:string){
  failures[operation]=Math.min(1e12,failures[operation]+1);const at=now();if(lastLog[operation]!==undefined&&at-lastLog[operation]<60000)return;lastLog[operation]=at;
  try{void Promise.resolve(log({event:operation==='unattributed'?'security_rejection_unattributed':'security_observer_unavailable',app:'meadow',source,version:commerceSecurityVersion,operation,reason,failures:failures[operation]})).catch(()=>{});}catch{/* Logging never changes commerce. */}
 }
 function invalid(raw:unknown,heartbeat:boolean){
  if(!record(raw))return 'invalid_ack';if(raw.error!=null)return 'rpc_error';const value=Object.hasOwn(raw,'data')?raw.data:raw;
  if(!record(value))return 'invalid_ack';if(value.error!=null)return 'rpc_error';
  if(heartbeat)return value.accepted===true&&value.disabled!==true&&value.capped!==true?null:'invalid_ack';
  if(value.accepted===false&&((value.disabled===true&&value.capped!==true)||(value.capped===true&&value.disabled!==true)))return null;
  return value.accepted===true&&typeof value.duplicate==='boolean'&&uuid(value.reference)&&(value.flag_id==null||uuid(value.flag_id))&&value.disabled!==true&&value.capped!==true?null:'invalid_ack';
 }
 async function deliver(operation:'signal'|'heartbeat',work:(signal:AbortSignal)=>Promise<unknown>){
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,timedOut=false;
  const deadline=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{timedOut=true;controller.abort();reject(Error('Observer timeout'));},timeout);});
  try{const reason=invalid(await Promise.race([work(controller.signal),deadline]),operation==='heartbeat');if(reason)notice(operation,reason);}
  catch{notice(operation,timedOut?'timeout':'delivery');}finally{clearTimeout(timer);controller.abort();}
 }
 return {
  async heartbeat(){const at=now();if(lastBeat!==undefined&&at-lastBeat<300000)return;lastBeat=at;await deliver('heartbeat',signal=>rpc('fairplay_game_detector_heartbeat_v1',{p_app:'meadow',p_source:source,p_version:commerceSecurityVersion},signal));},
  async signal(actor,references,field){
   await deliver('signal',async signal=>{
    if(!uuid(actor)||!references.length||references.some(r=>typeof r!=='string'||r.length>256)||!((source==='meadow-market-store'&&['receipt_owner','receipt_product'].includes(field))||(source==='meadow-market-ad-reward'&&field==='nonce_transaction')))throw Error('Invalid trusted evidence');
    const code=source==='meadow-market-store'?'receipt_binding_conflict':'reward_binding_conflict';
    const hash=await securityHash(JSON.stringify(['meadow-commerce-security-v1',source,code,actor.toLowerCase(),field,...references]));
    if(signal.aborted)throw Error('Observer cancelled');
    const event=hash.slice(0,8)+'-'+hash.slice(8,12)+'-8'+hash.slice(13,16)+'-'+((parseInt(hash[16],16)&3)|8).toString(16)+hash.slice(17,20)+'-'+hash.slice(20,32);
    return rpc('fairplay_game_security_signal_v1',{p_app:'meadow',p_actor:actor.toLowerCase(),p_event_id:event,p_source:source,p_code:code,p_context:{correlation_hash:hash,operation:source==='meadow-market-store'?'store.purchase':'ad.reward',provider:source==='meadow-market-store'?'google_play':'admob_ssv',verification_stage:source==='meadow-market-store'?'provider_and_token_ledger':'signature_and_nonce_ledger',field}},signal);
   });
  },
  unattributed(){notice('unattributed','verified_ssv_nonce_or_account_unattributed');}
 };
}
