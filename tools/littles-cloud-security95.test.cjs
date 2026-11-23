'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../meadow-market-littles/littles-cloud.js'),'utf8');
const actor='11111111-1111-4111-8111-111111111111',other='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function fixture(){
 let currentActor=actor,revision=1,data={schema:1,stars:10},last=null,mode='normal',release,signals=0;
 const storage=new Map([['meadow-littles-cloud-v1:'+actor+':meta',JSON.stringify({revision:1})]]),requests=[],timers=new Map();let timer=0;
 const clone=x=>JSON.parse(JSON.stringify(x)),envelope=()=>({ok:true,contract:'meadow-littles-cloud-v1',entitlements_verified:false,profile:{user_id:currentActor,display_name:'Fixture'},save:{cloud_version:1,revision,data:clone(data)}});
 const identity=()=>({id:currentActor,is_anonymous:false,email_confirmed_at:'2026-01-01T00:00:00Z'});
 function save(input){const p=clone(input),fingerprint=JSON.stringify([p.p_expected_revision,p.p_cloud_version,p.p_save_data]);requests.push(p);
  if(last?.id===p.p_request_id){if(last.fingerprint!==fingerprint){signals++;return{error:{message:'LITTLES_REQUEST_BINDING_CONFLICT'}};}return{ok:true,result:{request_id:p.p_request_id,revision,replayed:true}};}
  if(p.p_expected_revision!==revision)return{error:{message:'LITTLES_SAVE_REVISION_CONFLICT'}};
  revision++;data=clone(p.p_save_data);last={id:p.p_request_id,fingerprint};return{ok:true,result:{request_id:p.p_request_id,revision,replayed:false}};
 }
 const client={auth:{getSession:async()=>({data:{session:{user:identity(),access_token:'fixture'}},error:null}),getUser:async()=>({data:{user:identity()},error:null}),onAuthStateChange:()=>{}},rpc:async name=>{assert.equal(name,'meadow_littles_open');return{data:envelope(),error:null};},functions:{invoke:async(_,args)=>{
  const p=args.body;if(p.action==='connect')return{data:{ok:true,account:envelope(),moderation:{banned:false}},error:null};if(p.action==='status')return{data:{ok:true,moderation:{banned:false}},error:null};assert.equal(p.action,'save');
  if(mode==='hold'){mode='normal';return await new Promise(resolve=>{release=()=>resolve({data:save(p.save),error:null});});}
  const response=save(p.save);if(mode==='lose-response'){mode='normal';return{data:null,error:{context:{json:async()=>({code:'LITTLES_CONTROL_UNAVAILABLE'})}}};}
  if(response.error)return{data:null,error:{context:{json:async()=>({code:response.error.message})}}};return{data:response,error:null};
 }}};
 let local={schema:1,stars:10};const context={crypto:crypto.webcrypto,console,URL,TextEncoder,AbortSignal,setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),fetch:()=>{throw Error('NO_NETWORK');}};
 vm.runInNewContext(source,context);const api=context.meadowLittlesCloud;
 await api.init({client,storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},getState:()=>clone(local),applyState:s=>{local=clone(s);return true;}});
 assert.equal(api.getStatus().state,'ready');
 return{api,requests,get signals(){return signals;},get revision(){return revision;},get data(){return data;},set mode(v){mode=v;},release:()=>release(),setLocal:v=>local=clone(v),switchActor:()=>currentActor=other};
}
(async()=>{
 const tests=[];
 {
  const f=await fixture();f.api.queueSave({schema:1,stars:11});f.mode='lose-response';assert.equal((await f.api.flush()).ok,false);
  f.api.queueSave({schema:1,stars:12});assert.equal((await f.api.retryPending()).replayed,true);
  assert.equal(JSON.stringify(f.requests[0]),JSON.stringify(f.requests[1]),'Retry must preserve its exact reference/revision/payload');
  await f.api.flush();assert.notEqual(f.requests[2].p_request_id,f.requests[0].p_request_id);assert.equal(f.signals,0);tests.push('lost-response retry and subsequent coalesced save');
 }
 {
  const f=await fixture();f.mode='hold';f.api.queueSave({schema:1,stars:11});const first=f.api.flush();await new Promise(setImmediate);
  f.api.queueSave({schema:1,stars:12});assert.equal((await f.api.flush()).ok,false);f.release();await first;await f.api.flush();
  assert.equal(f.requests.length,2);assert.notEqual(f.requests[0].p_request_id,f.requests[1].p_request_id);assert.equal(f.data.stars,12);assert.equal(f.signals,0);tests.push('new progress while earlier save is in flight');
 }
 for(const choice of ['cloud','device']){
  const f=await fixture();f.api.queueSave({schema:1,stars:11});f.mode='lose-response';await f.api.flush();f.setLocal({schema:1,stars:15});await f.api.choose(choice);
  if(choice==='device'){assert.equal(f.requests.length,2);assert.notEqual(f.requests[0].p_request_id,f.requests[1].p_request_id);assert.equal(f.data.stars,15);}else assert.equal(f.requests.length,1);
  assert.equal(f.signals,0);tests.push('explicit '+choice+' save choice after ambiguous response');
 }
 {
  const f=await fixture();f.api.queueSave({schema:1,stars:11});f.switchActor();const r=await f.api.flush();assert.equal(r.ok,false);assert.equal(r.code,'LITTLES_ACCOUNT_CHANGED');assert.equal(f.requests.length,0);assert.equal(f.signals,0);tests.push('account switch prevents stale actor submission');
 }
 console.log(JSON.stringify({pass:tests.length,fail:0,actualClientSource:true,phoneIO:0,networkIO:0,tests}));
})().catch(e=>{console.error(e);process.exitCode=1});
