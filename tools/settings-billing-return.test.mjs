import test from 'node:test';
import assert from 'node:assert/strict';
import { setSupabaseForTest } from '../js/supabaseClient.js';

globalThis.document = { addEventListener() {} };
const { handleBillingReturn } = await import('../js/settingsBillingReturn.js');
const owner = '00000000-0000-4000-8000-000000000001';

async function run({ query='?billing=success&session_id=cs_test_123', session={access_token:'test',user:{id:owner}}, result={ok:true,plan:'pro',subscription:{id:'sub_test',status:'active'}}, error=null }={}) {
  const banners=[], requests=[], removed=[], events=[], replacements=[];
  globalThis.document = {
    createElement:()=>({setAttribute(){},style:{},textContent:''}),
    querySelector:()=>({prepend:el=>banners.push(el)}),
  };
  globalThis.location = {search:query,href:`https://sponsorsorter.com/settings.html${query}`};
  globalThis.history = {replaceState:(_state,_title,url)=>replacements.push(url)};
  globalThis.sessionStorage = {removeItem:key=>removed.push(key)};
  globalThis.window = {dispatchEvent:event=>events.push(event.type)};
  setSupabaseForTest({auth:{getSession:async()=>({data:{session}})},functions:{invoke:async(name,args)=>{requests.push({name,...args});return {data:result,error};}}});
  await handleBillingReturn();
  return {banners,requests,removed,events,replacements};
}

test('cancel return never sends completion or claims payment success',async()=>{
  const r=await run({query:'?billing=cancelled'});
  assert.equal(r.requests.length,0); assert.match(r.banners[0].textContent,/No subscription change is confirmed/);
});
test('unrelated settings visit does nothing',async()=>{
  const r=await run({query:'?plan=pro'}); assert.equal(r.requests.length,0); assert.equal(r.banners.length,0);
});
test('success URL with invalid session is not proof of payment',async()=>{
  const r=await run({query:'?billing=success&session_id=invalid'}); assert.equal(r.requests.length,0); assert.equal(r.removed.length,0); assert.doesNotMatch(r.banners[0].textContent,/Your Pro subscription is confirmed/);
});
test('signed-out return preserves reference and explains resume',async()=>{
  const r=await run({session:null}); assert.equal(r.requests.length,0); assert.equal(r.replacements.length,0); assert.match(r.banners[0].textContent,/Sign in.*reopen/);
});
test('provider pending preserves request and return reference for safe retry',async()=>{
  const r=await run({result:{ok:false,code:'CHECKOUT_PENDING'}}); assert.equal(r.requests.length,1); assert.equal(r.removed.length,0); assert.equal(r.replacements.length,0); assert.match(r.banners[0].textContent,/still pending/);
});
test('verified completion clears only owner request and removes return params',async()=>{
  const r=await run();
  assert.deepEqual(r.requests,[{name:'subscription-billing',body:{action:'complete',session_id:'cs_test_123'}}]);
  assert.deepEqual(r.removed,[`subscription-checkout:${owner}`]);
  assert.deepEqual(r.events,['subscription-billing-updated']);
  assert.deepEqual(r.replacements,['https://sponsorsorter.com/settings.html']);
  assert.match(r.banners[0].textContent,/Pro subscription is confirmed/);
});
test('unverified entitlement never displays completion success',async()=>{
  const r=await run({result:{ok:true,plan:'pro',subscription:{id:'sub_test',status:'unpaid'}}}); assert.equal(r.removed.length,0); assert.equal(r.events.length,0); assert.doesNotMatch(r.banners[0].textContent,/Pro subscription is confirmed/);
});
