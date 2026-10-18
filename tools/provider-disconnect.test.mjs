import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { disconnectProvider, validateDisconnect, disconnectMessage } from '../js/providerDisconnect.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const actor='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const result=(platform='youtube')=>({ok:true,platform,db_updated:true,local_unlinked:true,provider_revoked:true,state:'revoked_and_unlinked'});
function storage(){const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
function client(reply,calls=[]){return {auth:{getSession:async()=>({data:{session:{user:{id:actor},access_token:'fixture'}}})},functions:{invoke:async(name,options)=>{calls.push({name,options});return reply;}}};}
test('confirmed three-provider responses use only platform and operation UUID',async()=>{
 for(const platform of ['youtube','twitch','tiktok']){
  const calls=[];const saved=storage();const r=await disconnectProvider(client({data:result(platform)},calls),platform,actor,{storage:saved});
  assert.equal(r.local_unlinked,true);assert.equal(calls.length,1);assert.equal(calls[0].name,'revoke_platforms');
  assert.deepEqual(Object.keys(calls[0].options.body).sort(),['platform','request_id']);
  assert.equal(calls[0].options.headers.Authorization,'Bearer fixture');assert.ok(calls[0].options.signal);assert.equal(saved.values.size,0);
 }
});
test('incomplete, mismatched and inconsistent success bodies fail closed',()=>{
 for(const bad of [{...result(),ok:1},{...result(),platform:'twitch'},{...result(),db_updated:false},{...result(),local_unlinked:false},{...result(),provider_revoked:false},{...result(),state:'partial'},null]) assert.throws(()=>validateDisconnect(bad,'youtube'),/could not be confirmed/);
});
test('already-unlinked result does not imply provider revocation',()=>{
 assert.equal(validateDisconnect({...result(),state:'already_unlinked',provider_revoked:false},'youtube').provider_revoked,false);
});
test('Meta disconnect is preserved locally without provider invocation',async()=>{
 for(const platform of ['instagram','facebook']) await assert.rejects(disconnectProvider({},platform,actor),error=>error.code==='META_DISCONNECT_REVIEW_REQUIRED');
 assert.match(disconnectMessage('META_DISCONNECT_REVIEW_REQUIRED'),/preserved/);
});
test('missing session and mismatched profile actor never invoke',async()=>{
 const calls=[];const c=client({data:result()},calls);
 await assert.rejects(disconnectProvider(c,'youtube',other,{storage:storage()}),error=>error.code==='OWNER_REQUIRED');
 c.auth.getSession=async()=>({data:{}});
 await assert.rejects(disconnectProvider(c,'youtube',actor,{storage:storage()}),error=>error.code==='SIGN_IN_REQUIRED');assert.equal(calls.length,0);
});
test('storage failure blocks POST rather than losing operation identity',async()=>{
 const calls=[];const saved={getItem(){throw Error('private detail');}};
 await assert.rejects(disconnectProvider(client({data:result()},calls),'youtube',actor,{storage:saved}),error=>error.code==='STORAGE_UNAVAILABLE'&&!error.message.includes('private detail'));assert.equal(calls.length,0);
});
test('failed request retains operation UUID across helper instances and does not retry',async()=>{
 const calls=[];const saved=storage();const c=client({error:{context:{json:async()=>({code:'PROVIDER_REVOKE_UNCONFIRMED'})}}},calls);
 await assert.rejects(disconnectProvider(c,'youtube',actor,{storage:saved}));assert.equal(calls.length,1);
 await assert.rejects(disconnectProvider(c,'youtube',actor,{storage:saved}));assert.equal(calls.length,2);
 assert.equal(calls[0].options.body.request_id,calls[1].options.body.request_id);
});
test('late auth resolution cannot send POST after deadline',async()=>{
 const calls=[];const c=client({data:result()},calls);c.auth.getSession=()=>new Promise(r=>setTimeout(()=>r({data:{session:{user:{id:actor},access_token:'fixture'}}}),25));
 await assert.rejects(disconnectProvider(c,'youtube',actor,{storage:storage(),timeoutMs:3}));
 await new Promise(r=>setTimeout(r,35));assert.equal(calls.length,0);
});
test('whole deadline covers error JSON parsing',async()=>{
 const calls=[];const saved=storage();
 await assert.rejects(disconnectProvider(client({error:{context:{json:()=>new Promise(()=>{})}}},calls),'youtube',actor,{storage:saved,timeoutMs:5}),error=>error.code==='DISCONNECT_UNCONFIRMED');
 assert.equal(calls.length,1);assert.equal(saved.values.size,1);
});
test('late success after timeout cannot clear durable request ID',async()=>{
 const saved=storage();const c=client({});c.functions.invoke=()=>new Promise(r=>setTimeout(()=>r({data:result()}),25));
 await assert.rejects(disconnectProvider(c,'youtube',actor,{storage:saved,timeoutMs:3}));await new Promise(r=>setTimeout(r,35));assert.equal(saved.values.size,1);
});
test('unknown backend text is not exposed',async()=>{
 await assert.rejects(disconnectProvider(client({error:{context:{json:async()=>({code:'UNKNOWN',error:'secret detail'})}}}),'youtube',actor,{storage:storage()}),error=>!error.message.includes('secret detail'));
});
test('Settings disconnect branch has no credential hints or client DB writes',()=>{
 const s=readFileSync(new URL('../js/settings.js',import.meta.url),'utf8');
 assert.doesNotMatch(s,/revokePlatforms|removePlatformFromArray|tokenHints|Continue to local unlink/);
 const block=s.slice(s.indexOf("if (['youtube','twitch','instagram','facebook','tiktok'].includes(plat)"),s.indexOf('// Free-plan gate applies'));
 assert.match(block,/disconnectProvider\(supabase, plat, user\?\.user_id\)/);
 assert.doesNotMatch(block,/\.update\(|access_token|refresh_token|\.delete\(/);
 assert.match(block,/__impersonated/);assert.match(block,/await refreshOauthAccountsUI\(\)/);
 assert.ok(block.indexOf('confirmed = true')<block.indexOf('await refreshOauthAccountsUI'));
});
