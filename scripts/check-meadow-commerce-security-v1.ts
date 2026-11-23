import {purchaseVerifier,type StoreServices} from '../supabase/functions/meadow-market-store/service.ts';
import {adRewardHandler} from '../supabase/functions/meadow-market-ad-reward/handler.ts';
import {verifyCallback} from '../supabase/functions/meadow-market-ad-reward/verify.ts';
import {createCommerceObserver,storeDatabaseError,rewardDatabaseDenial,securityHash,type CommerceObserver} from '../supabase/functions/_shared/meadow-commerce-security-v1.ts';
const actor='10000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002',nonce='30000000-0000-4000-8000-000000000003',reference='40000000-0000-4000-8000-000000000004';
const ack={accepted:true,duplicate:false,reference,flag_id:null};
function assert(v:unknown,note='Commerce security assertion failed'){if(!v)throw Error(note);}
const same=(a:unknown,b:unknown)=>assert(JSON.stringify(a)===JSON.stringify(b));
async function rejects(fn:()=>Promise<unknown>,code:string){try{await fn();}catch(error){assert((error as Error).message===code);return;}throw Error('Expected rejection');}
function observer(source:'meadow-market-store'|'meadow-market-ad-reward',options:Parameters<typeof createCommerceObserver>[2]={}){
 const calls:{name:string;body:Record<string,any>}[]=[],logs:Record<string,unknown>[]=[];
 const instance=createCommerceObserver(source,async(name,body)=>{calls.push({name,body});return name.endsWith('heartbeat_v1')?{accepted:true}:ack;},{log:n=>logs.push(n),...options});
 return {instance,calls,logs,signals:()=>calls.filter(x=>x.name.endsWith('signal_v1'))};
}
async function store(overrides:Partial<StoreServices>={}){
 const o=observer('meadow-market-store'),events:string[]=[];
 const services:StoreServices={purchase:async()=>{events.push('provider');return {purchaseState:0,quantity:1,obfuscatedExternalAccountId:await securityHash('meadow-markets:'+actor),purchaseType:0,acknowledgementState:0,consumptionState:0};},hash:securityHash,deliver:async()=>{events.push('delivery');return {settled:false,receipt_id:reference,duplicate:false};},settle:async()=>{events.push('settle');},markSettled:async()=>{events.push('mark_settled');},observer:o.instance,...overrides};
 return {...o,events,services,verify:purchaseVerifier(services)};
}
const marker=(field='OWNER')=>storeDatabaseError('22023','Purchase belongs to another account or was revoked','MEADOW_STORE_RECEIPT_'+field+'_CONFLICT_V1');
Deno.test('Store flags only a typed ledger contradiction after Google account/state validation and rollback',async()=>{
 for(const field of ['OWNER','PRODUCT']){
  let rolledBack=false;const f=await store({deliver:async()=>{rolledBack=true;throw marker(field);}});
  await rejects(()=>f.verify(actor,'mm_pocket_gems','private-provider-token'),'STORE_DELIVERY_UNAVAILABLE');assert(rolledBack);
  const signals=f.signals();assert(signals.length===1&&signals[0].body.p_actor===actor&&signals[0].body.p_code==='receipt_binding_conflict');
  assert(signals[0].body.p_context.field==='receipt_'+field.toLowerCase());assert(!f.events.includes('settle'));
  const text=JSON.stringify(f.calls)+JSON.stringify(f.logs);assert(!text.includes('private-provider-token')&&!text.includes('obfuscatedExternalAccountId'));
 }
});
Deno.test('Wrong-account Restore, pending/cancelled purchase and unverified provider failures produce no player evidence',async()=>{
 for(const [patch,code]of [[{obfuscatedExternalAccountId:await securityHash('meadow-markets:'+other)},'PURCHASE_ACCOUNT_MISMATCH'],[{purchaseState:2},'PURCHASE_PENDING'],[{purchaseState:1},'PURCHASE_NOT_COMPLETED'],[{quantity:2},'MULTI_QUANTITY_UNSUPPORTED']] as const){
  const f=await store();const original=f.services.purchase;f.services.purchase=async(p,t)=>({...await original(p,t),...patch});
  await rejects(()=>f.verify(actor,'mm_pocket_gems','private-provider-token'),code);assert(!f.calls.length&&!f.events.includes('delivery'));
 }
 const f=await store({purchase:async()=>{throw Error('PROVIDER_UNAVAILABLE');}});await rejects(()=>f.verify(actor,'mm_pocket_gems','private-provider-token'),'PROVIDER_UNAVAILABLE');assert(!f.calls.length);
});
Deno.test('Normal grant/acknowledgement order and idempotent Restore remain unchanged; refunds and generic SQL are not flags',async()=>{
 const fresh=await store();same(await fresh.verify(actor,'mm_pocket_gems','private-provider-token'),{verified:true,receipt_id:reference,duplicate:false});same(fresh.events,['provider','delivery','settle','mark_settled']);assert(!fresh.signals().length);
 const replay=await store({deliver:async()=>({settled:true,receipt_id:reference,duplicate:true})});assert((await replay.verify(actor,'mm_pocket_gems','private-provider-token')).duplicate);assert(!replay.events.includes('settle')&&!replay.signals().length);
 for(const error of [storeDatabaseError('P0001','Purchase belongs to another account or was revoked',null),storeDatabaseError('22023','Purchase belongs to another account or was revoked','MEADOW_STORE_RECEIPT_OWNER_CONFLICT_V1-spoof'),storeDatabaseError('22023','ordinary quota failure','MEADOW_STORE_RECEIPT_OWNER_CONFLICT_V1')]){
  const f=await store({deliver:async()=>{throw error;}});await rejects(()=>f.verify(actor,'mm_pocket_gems','private-provider-token'),'STORE_DELIVERY_UNAVAILABLE');assert(!f.signals().length);
 }
});
Deno.test('Commerce observer errors/timeouts/malformed ACKs are bounded, static and never change a store grant or denial',async()=>{
 for(const result of [null,{error:{message:'private-token'}},{accepted:true},{accepted:false}]){
  const logs:Record<string,unknown>[]=[],o=createCommerceObserver('meadow-market-store',async()=>result,{log:n=>logs.push(n)});
  const fresh=await store({observer:o});assert((await fresh.verify(actor,'mm_pocket_gems','private-provider-token')).verified);
  const denied=await store({observer:o,deliver:async()=>{throw marker();}});await rejects(()=>denied.verify(actor,'mm_pocket_gems','private-provider-token'),'STORE_DELIVERY_UNAVAILABLE');assert(logs.length>0&&!JSON.stringify(logs).includes('private-token'));
 }
 let signal:AbortSignal|undefined;const logs:Record<string,unknown>[]=[],o=createCommerceObserver('meadow-market-store',async(_name,_body,s)=>{signal=s;return await new Promise(()=>{});},{timeoutMs:5,log:n=>logs.push(n)});
 await o.heartbeat();assert(signal?.aborted===true&&logs[0].reason==='timeout');
});
Deno.test('Commerce ACK off/capped is normal; heartbeat attempts and static logging are throttled',async()=>{
 for(const value of [{accepted:false,disabled:true},{accepted:false,capped:true},{data:ack,error:null}]){
  const logs:unknown[]=[],o=createCommerceObserver('meadow-market-store',async()=>value,{log:n=>logs.push(n)});await o.signal(actor,['a'.repeat(64)],'receipt_owner');assert(!logs.length);
 }
 let clock=0,beats=0;const logs:Record<string,unknown>[]=[],o=createCommerceObserver('meadow-market-store',async name=>{if(name.endsWith('heartbeat_v1'))beats++;return {error:{message:'private-body'}};},{now:()=>clock,log:n=>logs.push(n)});
 for(let i=0;i<8;i++){await o.heartbeat();await o.signal(actor,['a'.repeat(64)],'receipt_owner');}
 assert(beats===1&&logs.filter(n=>n.operation==='signal').length===1);
 clock=60000;await o.signal(actor,['a'.repeat(64)],'receipt_owner');assert(logs.find(n=>n.operation==='signal'&&n.failures===9));
 clock=300000;await o.heartbeat();assert(beats===2&&!JSON.stringify(logs).includes('private-body'));
});
Deno.test('Concurrent commerce heartbeats coalesce and sync/async log failures remain isolated',async()=>{
 for(const log of [()=>{throw Error('private-log');},async()=>{throw Error('private-log');}]){
  let release!:(value:unknown)=>void,enter!:()=>void,calls=0;const entered=new Promise<void>(resolve=>{enter=resolve;});
  const o=createCommerceObserver('meadow-market-store',async()=>{calls++;enter();return await new Promise(resolve=>{release=resolve;});},{now:()=>0,log});
  const first=o.heartbeat();await entered;await Promise.all(Array.from({length:8},()=>o.heartbeat()));assert(calls===1);
  release({error:{message:'private-provider-body'}});await first;
 }
});
const params=()=>new URLSearchParams({ad_unit:'fixture-unit',custom_data:nonce,reward_amount:'5',reward_item:'gems',timestamp:'1793300000000',transaction_id:'private-transaction',user_id:'signed-account-hash'});
const typedAd=()=>({code:'22023',message:'Ad nonce reused',details:JSON.stringify({code:'MEADOW_AD_NONCE_TRANSACTION_CONFLICT_V1',actor})});
function reward(options:{verify?:(url:URL)=>Promise<URLSearchParams>;finish?:(body:Record<string,unknown>)=>Promise<{ok:boolean;error?:unknown}>}={}){
 const o=observer('meadow-market-ad-reward'),finished:Record<string,unknown>[]=[];
 const handler=adRewardHandler({verify:options.verify|| (async()=>params()),unit:'fixture-unit',finish:async body=>{finished.push(body);return options.finish?options.finish(body):{ok:true};},observer:o.instance});
 return {...o,finished,handler};
}
Deno.test('SSV evidence uses locked DB nonce owner after verified signature/config/account stage, never callback user_id',async()=>{
 const f=reward({finish:async()=>({ok:false,error:typedAd()})});const r=await f.handler(new Request('https://fixture.invalid'));assert(r.status===503&&await r.text()==='Reward not delivered');
 const s=f.signals()[0].body;assert(s.p_actor===actor&&s.p_actor!==params().get('user_id')&&s.p_code==='reward_binding_conflict');assert(s.p_context.verification_stage==='signature_and_nonce_ledger');
 assert(!JSON.stringify(f.calls).includes('private-transaction'));assert(!f.logs.length);
});
Deno.test('SSV normal/idempotent success stays OK; expiry/caps are non-fraud and ambiguous binding stays unattributed',async()=>{
 const f=reward();for(let i=0;i<2;i++){const r=await f.handler(new Request('https://fixture.invalid'));assert(r.status===200&&await r.text()==='OK');}assert(!f.signals().length);
 for(const message of ['Ad reward expired','Daily ad reward limit','Account unavailable','Ad account mismatch']){
  const q=reward({finish:async()=>({ok:false,error:{code:'P0001',message}})});assert((await q.handler(new Request('https://fixture.invalid'))).status===503);assert(!q.signals().length);
  assert(q.logs.length===(message==='Ad account mismatch'?1:0));if(q.logs.length)assert(q.logs[0].event==='security_rejection_unattributed'&&!JSON.stringify(q.logs).includes(actor));
 }
});
Deno.test('Unverified or unconfigured callbacks and setup probes cannot reach delivery, heartbeat or player evidence',async()=>{
 const invalid=reward({verify:async()=>{throw Error('INVALID_SIGNATURE');}});assert((await invalid.handler(new Request('https://fixture.invalid'))).status===403);assert(!invalid.finished.length&&!invalid.calls.length);
 for(const patch of [{ad_unit:'wrong-unit'},{reward_amount:'500'},{custom_data:'bad-nonce'},{timestamp:'invalid'}]){
  const f=reward({verify:async()=>{const p=params();for(const [key,value]of Object.entries(patch))p.set(key,value);return p;}});assert((await f.handler(new Request('https://fixture.invalid'))).status>=400);assert(!f.finished.length&&!f.calls.length);
 }
 const probe=reward({verify:async()=>new URLSearchParams({user_id:'meadow-admob-setup',custom_data:'verification-only'})});assert((await probe.handler(new Request('https://fixture.invalid'))).status===200);assert(!probe.finished.length&&!probe.calls.length);
});
Deno.test('Malformed or generic callback SQL errors cannot supply an actor or create a player flag',()=>{
 for(const value of [{...typedAd(),code:'23505'},{...typedAd(),details:'not JSON'},{...typedAd(),details:JSON.stringify({code:'MEADOW_AD_NONCE_TRANSACTION_CONFLICT_V1',actor:'invalid'})},{...typedAd(),details:JSON.stringify({code:'MEADOW_AD_NONCE_TRANSACTION_CONFLICT_V1',actor,token:'private'})},{...typedAd(),message:'Ad account mismatch'}])assert(rewardDatabaseDenial(value)===null);
});
function der(raw:Uint8Array){const part=(v:Uint8Array)=>{while(v.length>1&&v[0]===0)v=v.slice(1);if(v[0]&128)v=new Uint8Array([0,...v]);return new Uint8Array([2,v.length,...v]);};const a=part(raw.slice(0,32)),b=part(raw.slice(32));return new Uint8Array([48,a.length+b.length,...a,...b]);}
const b64=(v:Uint8Array)=>btoa(String.fromCharCode(...v)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
Deno.test('Actual ECDSA verifier gates SSV handler; tampered signed actor never reaches the trusted DB',async()=>{
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),pub=new Uint8Array(await crypto.subtle.exportKey('spki',pair.publicKey));
 const pem='-----BEGIN PUBLIC KEY-----\n'+btoa(String.fromCharCode(...pub))+'\n-----END PUBLIC KEY-----';
 const query=params().toString(),signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(query)));
 const original=globalThis.fetch;let keyReads=0;globalThis.fetch=async input=>{assert(String(input)==='https://www.gstatic.com/admob/reward/verifier-keys.json');keyReads++;return Response.json({keys:[{keyId:991,pem}]});};
 try{
  const f=reward({verify:verifyCallback,finish:async()=>({ok:false,error:typedAd()})});
  const url='https://fixture.invalid/?'+query+'&signature='+b64(der(signature))+'&key_id=991';assert((await f.handler(new Request(url))).status===503);assert(f.signals().length===1);
  assert((await f.handler(new Request(url.replace('signed-account-hash','tampered-account')))).status===403);assert(f.finished.length===1&&f.signals().length===1&&keyReads===1);
 }finally{globalThis.fetch=original;}
});
Deno.test('Commerce evidence matches frozen central contract and remains immutable on repeated verified conflicts',async()=>{
 const url=Deno.env.get('MEADOW_SECURITY_CONTRACT')||new URL('../tools/meadow-security-tests/fixtures/security-contract-v1.mjs',import.meta.url).href;const {validateSecuritySignal}=await import(url);
 for(const source of ['meadow-market-store','meadow-market-ad-reward'] as const){
  const f=observer(source),field=source==='meadow-market-store'?'receipt_owner':'nonce_transaction';await f.instance.signal(actor,['a'.repeat(64)],field);await f.instance.signal(actor,['a'.repeat(64)],field);
  const [a,b]=f.signals().map(x=>x.body);same(a,b);same(validateSecuritySignal({app:a.p_app,actor:a.p_actor,event_id:a.p_event_id,source:a.p_source,code:a.p_code,context:a.p_context}),a);
 }
});
