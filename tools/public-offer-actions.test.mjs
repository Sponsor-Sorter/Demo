import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { publicOfferAvailability, publicOfferRequest, publicOfferMessage } from '../js/publicOfferActions.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const actor='11111111-1111-4111-8111-111111111111';
const offer='22222222-2222-4222-8222-222222222222';
const application='33333333-3333-4333-8333-333333333333';
function client(result, calls=[]) { return {
 auth:{getSession:async()=>({data:{session:{user:{id:actor},access_token:'fixture'}}})},
 rpc(name,args){calls.push({name,args});return {abortSignal:async()=>result};}
}; }
test('Sydney full-day deadline remains available through midnight boundary',()=>{
 assert.equal(publicOfferAvailability({status:'open',deadline:'2026-10-18'},Date.parse('2026-10-18T12:59:59Z')).available,true);
 assert.equal(publicOfferAvailability({status:'open',deadline:'2026-10-18'},Date.parse('2026-10-18T13:00:00Z')).available,false);
});
test('closed expired malformed and missing dates fail closed',()=>{
 for(const value of [{status:'closed',deadline:'2099-01-01'},{status:'expired',deadline:'2099-01-01'},{status:'open',deadline:'2026-02-30'},{status:'open'}]) assert.equal(publicOfferAvailability(value).available,false);
 assert.match(publicOfferAvailability({status:'expired'}).message,/does not confirm a refund/);
});
test('apply sends only canonical RPC parameters and stable replay UUID',async()=>{
 const calls=[];const c=client({data:{ok:true,application_id:application}},calls);
 await publicOfferRequest(c,'apply',offer,'hello');await publicOfferRequest(c,'apply',offer,'hello');
 assert.equal(calls[0].name,'apply_to_public_offer');
 assert.deepEqual(Object.keys(calls[0].args).sort(),['p_application_text','p_offer_id','p_request_id']);
 assert.equal(calls[0].args.p_request_id,calls[1].args.p_request_id);
});
test('funding review is a known result without success claim',async()=>{
 const calls=[];const result=await publicOfferRequest(client({data:{ok:false,code:'FUNDING_REVIEW_REQUIRED'}},calls),'accept',application);
 assert.equal(result.ok,false);assert.equal(calls[0].name,'accept_public_offer_application');assert.match(publicOfferMessage(result.code),/No application was accepted/);
});
test('missing session never sends RPC',async()=>{
 let sent=false;await assert.rejects(publicOfferRequest({auth:{getSession:async()=>({data:{}})},rpc(){sent=true;}},'apply',offer),/Sign in/);assert.equal(sent,false);
});
test('late session after deadline never sends mutation',async()=>{
 let sent=false;const c={auth:{getSession:()=>new Promise(r=>setTimeout(()=>r({data:{session:{user:{id:actor},access_token:'fixture'}}}),30))},rpc(){sent=true;}};
 await assert.rejects(publicOfferRequest(c,'apply',offer,'',{timeoutMs:5}),/unconfirmed/);
 await new Promise(r=>setTimeout(r,40));assert.equal(sent,false);
});
test('unknown server error text is never shown',async()=>{
 await assert.rejects(publicOfferRequest(client({error:{code:'XX000',message:'sensitive server detail'}}),'apply',offer),error=>!error.message.includes('sensitive'));
});
test('malformed success cannot mark application submitted',async()=>{
 await assert.rejects(publicOfferRequest(client({data:{ok:true}}),'apply',offer),/could not be confirmed/);
});
test('invalid action and oversized Unicode text never invoke RPC',async()=>{
 await assert.rejects(publicOfferRequest({},'delete',offer),/Invalid/);
 await assert.rejects(publicOfferRequest({},'apply',offer,'😀'.repeat(451)),/Invalid/);
});
const source = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('both application consumers use RPC and no direct application INSERT',()=>{
 for(const path of ['finder.html','js/publicOffers.js']){
  const s=source(path);
  assert.match(s,/publicOfferRequest\(supabase, 'apply'/);
  assert.doesNotMatch(s,/from\('public_offer_applications'\)[\s\S]{0,80}\.insert/);
 }
});
test('acceptance has no private INSERT, separate accepted UPDATE or full-listing DELETE',()=>{
 const s=source('js/publicOffers.js');
 const accept=s.slice(s.indexOf('window.acceptApplicant ='),s.indexOf('window.deleteApplicant ='));
 assert.match(accept,/publicOfferRequest\(supabase, 'accept'/);
 assert.doesNotMatch(accept,/\.insert|\.update|\.delete|removePublicOffer/);
});
test('discovery filters server query before pagination and result limits',()=>{
 assert.equal((source('finder.html').match(/\.eq\('status', 'open'\)\.gte\('deadline', sydneyDate\(\)\)/g)||[]).length,2);
 assert.match(source('js/globalSearch.js'),/\.eq\('status', 'open'\)\.gte\('deadline', sydneyDate\(\)\)/);
});
test('history retains parent availability separately and offers Expired filter',()=>{
 assert.match(source('dashboardsponsor.html'),/<option value="expired">Expired<\/option>/);
 assert.match(source('js/publicOffers.js'),/mountPublicAvailability\(div, offer\)/);
 assert.match(source('js/publicOffers.js'),/a.status === 'pending' && parentAvailable/);
});
test('manual listing close preserves listing and application history',()=>{
 const s=source('js/publicOffers.js');
 const close=s.slice(s.indexOf('async function removePublicOffer'),s.indexOf('async function showApplicantsModal'));
 assert.match(close,/update\(\{ status: 'closed' \}\)/);
 assert.doesNotMatch(close,/\.delete\(/);
 assert.match(close,/\.eq\('status', 'open'\)\.gte\('deadline', sydneyDate\(\)\)/);
});
