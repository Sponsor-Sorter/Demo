import {farmHandler,farmDatabaseError,type Services} from '../supabase/functions/meadow-market-farm-actions/handler.ts';
import {earnedTutorial} from './check-meadow-fixtures209.ts';
import {commandReceiptConflictDetail,commandReceiptSignal,createCommandSecurityObserver,commandSecurityRuntimeVersion,type CommandSecuritySignal,type SecurityObserverFailure,type SecurityHeartbeat} from '../supabase/functions/_shared/meadow-security-v1.ts';
const actor='10000000-0000-4000-8000-000000000001',session='10000000-0000-4000-8000-000000000002',requestId='10000000-0000-4000-8000-000000000003';
function assert(v:unknown,note='Security fixture failed'){if(!v)throw Error(note);}
const equal=(a:unknown,b:unknown)=>assert(JSON.stringify(a)===JSON.stringify(b));
const body={request_id:requestId,expected_revision:5,commands:[{type:'workers.tick'}]};
const request=(extra={},headers={authorization:'Bearer fixture-token',origin:'https://sponsorsorter.com'})=>new Request('https://fixture.invalid',{method:'POST',headers,body:JSON.stringify({...body,...extra})});
const conflict=()=>farmDatabaseError('22023','Command receipt reused for different actions',commandReceiptConflictDetail);
const accepted={accepted:true,duplicate:false,reference:'50000000-0000-4000-8000-000000000005',flag_id:null,mode:'flag',count:1};
function fixture(rpc:Services['rpc']=async()=>{throw conflict();},overrides:Partial<Services>={}){
 const signals:CommandSecuritySignal[]=[],order:string[]=[],failures:SecurityObserverFailure[]=[];
 const services:Services={requireSession:true,identity:async()=>({id:actor,session_id:session}),rpc:async(...args)=>{try{return await rpc(...args);}finally{order.push('rpc_settled');}},securitySignal:async signal=>{order.push('signal');signals.push(signal);return accepted;},securityFailure:notice=>failures.push(notice),...overrides};
 return {services,signals,order,failures,handler:farmHandler(services)};
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
  const f=fixture(undefined,{securitySignal:emitter});const response=await f.handler(request());assert(response.status===422);assert(!(await response.text()).includes('private-provider-body'));
 }
});
Deno.test('A hung observer is aborted within its bound and cannot delay the denied action indefinitely',async()=>{
 let signal:AbortSignal|undefined;const notices:SecurityObserverFailure[]=[];
 const observer=createCommandSecurityObserver({emit:async(_body,s)=>{signal=s;return await new Promise(()=>{});},timeoutMs:10,onFailure:n=>notices.push(n)});
 await observer.report(actor,requestId);assert(signal?.aborted===true);assert(notices[0].reason==='timeout');
});

Deno.test('Healthy raw/Supabase signal acknowledgements, disabled rules and capped evidence are not failures',async()=>{
 for(const ack of [accepted,{data:accepted,error:null},{...accepted,duplicate:true},{accepted:false,disabled:true},{accepted:false,capped:true},{data:{accepted:false,disabled:true},error:null},{data:{accepted:false,capped:true},error:null}]){
  const f=fixture(undefined,{securitySignal:async()=>ack});assert((await f.handler(request())).status===422);assert(!f.failures.length);
 }
});
Deno.test('Supabase errors and malformed acknowledgements cannot masquerade as successful evidence',async()=>{
 for(const ack of [undefined,null,[],{}, {accepted:true},{accepted:'true'}, {accepted:false},
  {...accepted,reference:'not-a-reference'}, {...accepted,duplicate:'yes'}, {...accepted,flag_id:'bad'},
  {data:null,error:null},{data:accepted,error:{message:'private-token-and-provider-body'}},
  {data:{...accepted,error:'private-inner-body'},error:null},{accepted:false,disabled:true,capped:true}]){
  const f=fixture(undefined,{securitySignal:async()=>ack});const response=await f.handler(request());assert(response.status===422);
  assert(f.failures.length===1);assert(['rpc_error','invalid_ack'].includes(f.failures[0].reason));
  const text=JSON.stringify(f.failures)+await response.text();assert(!text.includes('private-token')&&!text.includes('private-inner'));
 }
});
Deno.test('Failure logging is static, throttled and counted, with no actor/reference/provider payload',async()=>{
 let clock=0;const f=fixture(undefined,{securityNow:()=>clock,securitySignal:async()=>({error:{message:'private-provider-token'}})});
 for(let i=0;i<8;i++)assert((await f.handler(request())).status===422);
 assert(f.failures.length===1&&f.failures[0].failures===1);
 clock=60000;assert((await f.handler(request())).status===422);assert(f.failures.length===2&&f.failures[1].failures===9);
 equal(Object.keys(f.failures[1]),['event','app','source','version','operation','reason','failures']);
 const text=JSON.stringify(f.failures);for(const value of [actor,requestId,session,'fixture-token','private-provider-token'])assert(!text.includes(value));
});
Deno.test('Synchronous and asynchronous log-sink failures preserve the original denial',async()=>{
 for(const sink of [()=>{throw Error('private-sink');},async()=>{throw Error('private-sink');}]){
  const f=fixture(undefined,{securitySignal:async()=>null,securityFailure:sink});assert((await f.handler(request())).status===422);
 }
});
Deno.test('Heartbeat is emitted by an actual validated control-session handler with fixed runtime identity',async()=>{
 let verified=false;const beats:SecurityHeartbeat[]=[];
 const f=fixture(async()=>{assert(beats.length===1);return {ok:true,replayed:true,revision:7};},{
  identity:async()=>{verified=true;return {id:actor,session_id:session};},
  securityHeartbeat:async b=>{assert(verified);beats.push(b);return {accepted:true};}
 });
 assert((await f.handler(request())).status===200);
 equal(beats,[{p_app:'meadow',p_source:'meadow-market-farm-actions',p_version:commandSecurityRuntimeVersion}]);assert(!f.failures.length&&!f.signals.length);
});
Deno.test('Unverified, expired, malformed and non-controlled requests cannot publish a heartbeat',async()=>{
 for(const identity of [async()=>null,async()=>({id:actor}),async()=>{throw farmDatabaseError('28000');}]){
  let beats=0;const f=fixture(undefined,{identity,securityHeartbeat:async()=>{beats++;return {accepted:true};}});
  assert((await f.handler(request())).status===401);assert(beats===0);
 }
 let beats=0;const f=fixture(undefined,{securityHeartbeat:async()=>{beats++;return {accepted:true};}});
 for(const extra of [{actor},{p_version:'spoof'},{commands:[]},{expected_revision:-1}])assert((await f.handler(request(extra))).status===422);
 assert((await f.handler(request({}, {authorization:'',origin:'https://sponsorsorter.com'}))).status===401);assert(beats===0);
 const uncontrolled=fixture(async()=>({ok:true,replayed:true}),{requireSession:false,securityHeartbeat:async()=>{beats++;return {accepted:true};}});
 assert((await uncontrolled.handler(request())).status===200&&beats===0);
});
Deno.test('Heartbeat shares a five-minute isolate throttle across users and repeated worker polls',async()=>{
 let clock=0,beats=0;const f=fixture(async()=>({ok:true,replayed:true,revision:7}),{securityNow:()=>clock,securityHeartbeat:async()=>{beats++;return {data:{accepted:true},error:null};}});
 for(let i=0;i<20;i++)assert((await f.handler(request())).status===200);
 clock=299999;f.services.identity=async()=>({id:'20000000-0000-4000-8000-000000000002',session_id:session});
 assert((await f.handler(request())).status===200&&beats===1);
 clock=300000;assert((await f.handler(request())).status===200&&beats===2);assert(!f.failures.length&&!f.signals.length);
});
Deno.test('Concurrent validated requests coalesce a heartbeat before its network operation completes',async()=>{
 let enter!:()=>void,release!:(ack:unknown)=>void,beats=0;
 const entered=new Promise<void>(resolve=>{enter=resolve;});
 const f=fixture(async()=>({ok:true,replayed:true,revision:7}),{securityNow:()=>0,securityHeartbeat:async()=>{beats++;enter();return await new Promise(resolve=>{release=resolve;});}});
 const first=f.handler(request());await entered;
 const replies=await Promise.all(Array.from({length:12},()=>f.handler(request())));assert(replies.every(r=>r.status===200)&&beats===1);
 release({accepted:true});assert((await first).status===200&&!f.failures.length);
});
Deno.test('Failed heartbeat attempts are throttled too; failures never alter a successful game response',async()=>{
 let clock=0,beats=0;const f=fixture(async()=>({ok:true,replayed:true,revision:7}),{securityNow:()=>clock,securityHeartbeat:async()=>{beats++;throw Error('private-network-body');}});
 for(let i=0;i<12;i++)assert((await f.handler(request())).status===200);
 assert(beats===1&&f.failures[0].operation==='heartbeat'&&f.failures[0].reason==='delivery');
 clock=300000;assert((await f.handler(request())).status===200&&beats===2);assert(f.failures[1].failures===2);
});
Deno.test('Heartbeat RPC errors, malformed ACKs and timeout are recorded without touching game results',async()=>{
 for(const ack of [null,{}, {accepted:false,disabled:true},{accepted:true,capped:true},{data:{accepted:true},error:{message:'private-error'}},{data:null,error:null}]){
  const f=fixture(async()=>({ok:true,replayed:true}),{securityHeartbeat:async()=>ack});const response=await f.handler(request());
  assert(response.status===200&&f.failures.length===1&&f.failures[0].operation==='heartbeat');assert(!JSON.stringify(f.failures).includes('private-error'));
 }
 let signal:AbortSignal|undefined;const f=fixture(async()=>({ok:true,replayed:true}),{securityTimeoutMs:10,securityHeartbeat:async(_body,s)=>{signal=s;return await new Promise(()=>{});}});
 assert((await f.handler(request())).status===200&&signal?.aborted===true);assert(f.failures[0].reason==='timeout');
});

Deno.test('Heartbeat outage preserves a genuine reducer/commit result without an extra write or lost crop action',async()=>{
 const save={version:1,tutorial:earnedTutorial(),coins:250,level:1,xp:0,active:'willow',farms:{willow:{objects:[{id:'plot',type:'plot',x:4,y:3,stage:0}],inventory:{},shop:{unlocked:false,stock:{}}}}};
 const writes:string[]=[];
 const f=fixture(async(name,args)=>{
  writes.push(name);return name==='meadow_market_read_farm_command'?{ok:true,enabled:true,revision:5,server_time:1793354400000,save_data:save,owned_collections:[]}:{ok:true,revision:6,save_data:args.p_save_data};
 },{securityHeartbeat:async()=>{throw Error('private-network-diagnostic');}});
 const response=await f.handler(request({commands:[{type:'plot.till',map:'willow',target:'plot'}]}));assert(response.status===200);
 const answer=await response.json();assert(answer.revision===6&&answer.save_data.coins===250&&answer.save_data.farms.willow.objects[0].stage===1);
 equal(writes,['meadow_market_read_farm_command','meadow_market_commit_farm_command']);assert(!f.signals.length&&f.failures.length===1);
});
Deno.test('The emitted request passes the actual central contract; forbidden context is rejected',async()=>{
 const url=Deno.env.get('MEADOW_SECURITY_CONTRACT');if(!url)throw Error('Set MEADOW_SECURITY_CONTRACT to the frozen central security-contract.mjs file URL');
 const {validateSecuritySignal}=await import(url);const s=await commandReceiptSignal(actor,requestId);
 const packet={app:s.p_app,actor:s.p_actor,event_id:s.p_event_id,source:s.p_source,code:s.p_code,context:s.p_context};
 equal(validateSecuritySignal(packet),s);
 for(const extra of [{token:'fixture-secret'},{save_data:'fixture-snapshot'},{code:'raw-code'}]){
  let rejected=false;try{validateSecuritySignal({...packet,context:{...packet.context,...extra}});}catch{rejected=true;}assert(rejected);
 }
});
