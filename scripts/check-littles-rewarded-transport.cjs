'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),test=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../meadow-market-littles/littles-cloud.js'),'utf8'),contract='littles-ad-round-v1';
const parent=id=>({id,is_anonymous:false,email_confirmed_at:'2026-11-13T00:00:00Z'}),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function fixture(initial=parent('parent-a')){
 let identity=initial,listener,userGate=null,sessionGate=null,signInGate=null,onFetch=null,reply=null;const posts=[],invokes=[],memory=new Map();
 const account=()=>({profile:{user_id:identity.id,display_name:'Isolated parent'},save:{cloud_version:1,revision:0,data:{schema:1,stars:17}}});
 const client={auth:{onAuthStateChange:fn=>listener=fn,getUser:async()=>{const answer={data:{user:identity}};if(userGate)await userGate.promise;return answer;},getSession:async()=>{const answer={data:{session:{user:identity,access_token:'fixture-bearer-'+identity.id}}};if(sessionGate)await sessionGate.promise;return answer;},signInWithPassword:async()=>{if(signInGate)await signInGate.promise;identity=parent('parent-b');listener('SIGNED_IN');return{data:{user:identity}};}},functions:{invoke:async(name,data)=>{invokes.push({name,data});return{data:{ok:true,moderation:{banned:false},runtime:{notices:[]},account:account()}};}}};
 const env={crypto,AbortSignal,URL,location:{origin:'https://example.test',pathname:'/meadow-market-littles/'},setTimeout:()=>0,clearTimeout(){},addEventListener(){},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},fetch:async(url,options)=>{const atStart=identity.id;posts.push({url,options});await onFetch?.();return{ok:true,json:async()=>reply||{contract,user_id:atStart}};}};env.globalThis=env;vm.runInNewContext(source,env);await env.meadowLittlesCloud.init({client,getState:()=>({schema:1,stars:17})});invokes.length=0;
 return{api:env.meadowLittlesCloud,posts,invokes,memory,holdUser(){return userGate=deferred();},holdSession(){return sessionGate=deferred();},holdSignIn(){return signInGate=deferred();},switchTo(user,event='SIGNED_IN'){identity=user;listener(event);},onFetch(fn){onFetch=fn;},reply(data){reply=data;}};
}
for(const action of ['status','prepare','claim']){
 test(action+': actual cloud module uses the validated bearer and exact Edge contract',async()=>{
  const f=await fixture(),data={client:crypto.randomUUID(),game:'memory',requestId:crypto.randomUUID(),challenge:crypto.randomUUID()};await f.api.rewarded(action,data);
  assert.equal(f.posts.length,1);assert.equal(f.invokes.length,0,'SDK invoke may not reselect the session');assert.equal(f.posts[0].url,'https://ejavqlyozqhzqogflqzr.supabase.co/functions/v1/littles-ad-rounds');assert.equal(f.posts[0].options.headers.Authorization,'Bearer fixture-bearer-parent-a');assert.equal(f.posts[0].options.credentials,'omit');assert.equal(f.posts[0].options.cache,'no-store');assert.deepEqual(JSON.parse(f.posts[0].options.body),{action,data});
 });
 for(const hold of ['holdUser','holdSession'])for(const next of ['parent-b','parent-a'])test(action+': '+hold+' rejects '+next+' new login before POST',async()=>{
  const f=await fixture(),gate=f[hold](),pending=f.api.rewarded(action,{game:'memory'});await new Promise(r=>setImmediate(r));f.switchTo(parent(next));gate.resolve();await assert.rejects(pending);assert.equal(f.posts.length,0);assert.equal(f.invokes.length,0);
 });
 test(action+': an in-flight request keeps the initiating bearer and rejects the replacement session result',async()=>{
  const f=await fixture();f.onFetch(async()=>f.switchTo(parent('parent-b')));await assert.rejects(f.api.rewarded(action,{game:'memory'}));assert.equal(f.posts.length,1);assert.equal(f.posts[0].options.headers.Authorization,'Bearer fixture-bearer-parent-a');
 });
 test(action+': same-session token refresh during session lookup remains usable',async()=>{
  const f=await fixture(),gate=f.holdSession(),pending=f.api.rewarded(action);await new Promise(r=>setImmediate(r));f.switchTo(parent('parent-a'),'TOKEN_REFRESHED');gate.resolve();await pending;assert.equal(f.posts.length,1);assert.equal(f.posts[0].options.headers.Authorization,'Bearer fixture-bearer-parent-a');
 });
}
test('Actual transport rejects guests, unverified parents, auth busy, wrong response owner and invalid actions without replacement posts',async()=>{
 for(const user of [{id:'guest',is_anonymous:true},{id:'unverified',is_anonymous:false}]){const f=await fixture(user);await assert.rejects(f.api.rewarded('prepare'));assert.equal(f.posts.length,0);}
 const f=await fixture(),gate=f.holdSignIn(),pending=f.api.signIn('fixture@example.test','not-stored');await new Promise(r=>setImmediate(r));await assert.rejects(f.api.rewarded('prepare'));assert.equal(f.posts.length,0);gate.resolve();await pending;
 const bad=await fixture();bad.reply({contract,user_id:'parent-b'});await assert.rejects(bad.api.rewarded('claim'));assert.equal(bad.posts.length,1);await assert.rejects(bad.api.rewarded('grant'));assert.equal(bad.posts.length,1);
});
