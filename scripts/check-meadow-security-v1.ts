import {farmHandler,farmDatabaseError,type Services} from '../supabase/functions/meadow-market-farm-actions/handler.ts';
import {commandReceiptConflictDetail,commandReceiptSignal,reportCommandReceiptConflict,type CommandSecuritySignal} from '../supabase/functions/_shared/meadow-security-v1.ts';
const actor='10000000-0000-4000-8000-000000000001',session='10000000-0000-4000-8000-000000000002',requestId='10000000-0000-4000-8000-000000000003';
function assert(v:unknown,note='Security fixture failed'):asserts v{if(!v)throw Error(note);}
const equal=(a:unknown,b:unknown)=>assert(JSON.stringify(a)===JSON.stringify(b));
const body={request_id:requestId,expected_revision:5,commands:[{type:'workers.tick'}]};
const request=(extra={},headers={authorization:'Bearer fixture-token',origin:'https://sponsorsorter.com'})=>new Request('https://fixture.invalid',{method:'POST',headers,body:JSON.stringify({...body,...extra})});
const conflict=()=>farmDatabaseError('22023','Command receipt reused for different actions',commandReceiptConflictDetail);
function fixture(rpc:Services['rpc']=async()=>{throw conflict();}){
 const signals:CommandSecuritySignal[]=[],order:string[]=[];
 const services:Services={requireSession:true,identity:async()=>({id:actor,session_id:session}),rpc:async(...args)=>{try{return await rpc(...args);}finally{order.push('rpc_settled');}},securitySignal:async signal=>{order.push('signal');signals.push(signal);return {accepted:true};}};
 return {services,signals,order,handler:farmHandler(services)};
}
Deno.test('Typed receipt denial emits only after the trusted database RPC settles; client response stays unchanged',async()=>{
 const f=fixture(),response=await f.handler(request());
 assert(response.status===422);equal(await response.json(),{error:'INVALID_REQUEST',message:'Reopen your saved farm before retrying this action.'});
 equal(f.order,['rpc_settled','signal']);assert(f.signals.length===1);const s=f.signals[0];
 assert(s.p_actor===actor&&s.p_app==='meadow'&&s.p_source==='meadow-market-farm-actions'&&s.p_code==='request_payload_conflict');
 assert(s.p_context.verification_stage==='command_receipt_hash');
});
Deno.test('Unchanged replay, stale revision, rollout off and ordinary worker polling create no security evidence',async()=>{
 for(const [result,status]of [[{ok:true,replayed:true,revision:7},200],[{ok:false,conflict:true,revision:7},409],[{enabled:false},409]]as const){
  const f=fixture(async()=>result);assert((await f.handler(request())).status===status);assert(f.signals.length===0);
 }
 const f=fixture(async()=>({ok:true,replayed:true,revision:7}));
 for(let i=0;i<25;i++)assert((await f.handler(request())).status===200);
 assert(f.signals.length===0);
});
Deno.test('Generic SQL categories, copied message, wrong marker and malformed detail never classify integrity',async()=>{
 for(const [code,message,details]of [
  ['22023','Invalid farm command',''],['22P02','bad syntax',commandReceiptConflictDetail],
  ['22023','Command receipt reused for different actions',''],
  ['22023','Command receipt reused for different actions',commandReceiptConflictDetail+'-spoof'],
  ['22023','other failure',commandReceiptConflictDetail],
  ['22023','Command receipt reused for different actions',{detail:commandReceiptConflictDetail}],
  ['40001','legacy/offline revision drift',''],['23505','duplicate receipt',''],
 ]as const){const f=fixture(async()=>{throw farmDatabaseError(code,message,details);});await f.handler(request());assert(f.signals.length===0);}
});
Deno.test('Caller-supplied identity, error markers, snapshots and clocks cannot create a signal',async()=>{
 for(const extra of [{actor},{app:'meadow'},{details:commandReceiptConflictDetail},{security_code:'request_payload_conflict'},{save_data:{coins:999999}},{now:1}]){
  const f=fixture();assert((await f.handler(request(extra))).status===422);assert(f.order.length===0&&f.signals.length===0);
 }
});
Deno.test('Missing, expired or unverified sessions cannot attribute evidence to a player',async()=>{
 for(const identity of [async()=>null,async()=>({id:actor}),async()=>{throw farmDatabaseError('28000');}]){
  const f=fixture();f.services.identity=identity;assert((await f.handler(request())).status===401);assert(f.order.length===0&&f.signals.length===0);
 }
 const f=fixture();assert((await f.handler(request({}, {authorization:'',origin:'https://sponsorsorter.com'}))).status===401);assert(!f.signals.length);
});
Deno.test('Bans and maintenance keep their own operational path, not the integrity detector',async()=>{
 for(const code of ['MEADOW_BANNED','MEADOW_SOCIAL_RESTRICTED','MEADOW_MAINTENANCE']){
  const f=fixture(async()=>{throw farmDatabaseError('42501',code);});assert((await f.handler(request())).status===403);assert(!f.signals.length);
 }
});
Deno.test('A repeated denial has immutable correlation; distinct references and actors stay separate',async()=>{
 const one=await commandReceiptSignal(actor,requestId);equal(one,await commandReceiptSignal(actor.toUpperCase(),requestId.toUpperCase()));
 const two=await commandReceiptSignal(actor,'20000000-0000-4000-8000-000000000003');
 const three=await commandReceiptSignal(actor,'30000000-0000-4000-8000-000000000003');
 const other=await commandReceiptSignal('40000000-0000-4000-8000-000000000004',requestId);
 assert(new Set([one,two,three,other].map(s=>s.p_event_id)).size===4);
 assert(new Set([one,two,three,other].map(s=>s.p_context.correlation_hash)).size===4);
 assert(/^[a-f\d]{64}$/.test(one.p_context.correlation_hash));assert(one.p_event_id!==requestId);
});
Deno.test('Signals carry only reference metadata, with no snapshots, bodies, tokens, session or credentials',async()=>{
 const f=fixture();await f.handler(request());const serialized=JSON.stringify(f.signals);
 for(const secret of ['fixture-token',session,'commands','save_data','expected_revision','coins','password','token'])assert(!serialized.includes(secret));
 equal(Object.keys(f.signals[0].p_context),['operation','protocol','request_id','correlation_hash','verification_stage']);
});
Deno.test('Central failure and unavailable rollout preserve the original rejection',async()=>{
 for(const emitter of [undefined,async()=>{throw Error('private-provider-body');},async()=>({accepted:false,disabled:true})]){
  const f=fixture();f.services.securitySignal=emitter;const response=await f.handler(request());assert(response.status===422);assert(!(await response.text()).includes('private-provider-body'));
 }
});
Deno.test('A hung observer is aborted within its bound and cannot delay the denied action indefinitely',async()=>{
 let signal:AbortSignal|undefined;
 await reportCommandReceiptConflict(async(_body,s)=>{signal=s;return await new Promise(()=>{});},actor,requestId,10);
 assert(signal?.aborted===true);
});
Deno.test('The emitted request passes the actual central contract; forbidden context is rejected',async()=>{
 const url=Deno.env.get('MEADOW_SECURITY_CONTRACT');assert(url,'Set MEADOW_SECURITY_CONTRACT to the frozen central security-contract.mjs file URL');
 const {validateSecuritySignal}=await import(url);const s=await commandReceiptSignal(actor,requestId);
 const packet={app:s.p_app,actor:s.p_actor,event_id:s.p_event_id,source:s.p_source,code:s.p_code,context:s.p_context};
 equal(validateSecuritySignal(packet),s);
 for(const extra of [{token:'fixture-secret'},{save_data:'fixture-snapshot'},{code:'raw-code'}]){
  let rejected=false;try{validateSecuritySignal({...packet,context:{...packet.context,...extra}});}catch{rejected=true;}assert(rejected);
 }
});
