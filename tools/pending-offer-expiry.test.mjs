import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sydneyDate, pendingOfferAvailability, readPendingAcceptance } from '../js/pendingOfferExpiry.mjs';
import { attentionItems } from '../js/campaignToday.js';

const id='00000000-0000-4000-8000-000000000001';
const offer={id,stage:1,status:'pending',active:true,archived:false,expired_at:null,deadline:'2026-10-18'};
const before=Date.parse('2026-10-18T12:59:59.999Z'),after=Date.parse('2026-10-18T13:00:00.000Z');
test('Sydney full summer deadline day remains valid through last millisecond',()=>{
  assert.equal(sydneyDate(before),'2026-10-18');assert.equal(pendingOfferAvailability(offer,before).canAccept,true);
  assert.equal(sydneyDate(after),'2026-10-19');assert.equal(pendingOfferAvailability(offer,after).reason,'deadline_passed');
});
test('Sydney winter deadline uses UTC+10 instead of a fixed summer offset',()=>{
  const winter={...offer,deadline:'2026-06-30'};
  assert.equal(pendingOfferAvailability(winter,Date.parse('2026-06-30T13:59:59.999Z')).canAccept,true);
  assert.equal(pendingOfferAvailability(winter,Date.parse('2026-06-30T14:00:00.000Z')).canAccept,false);
});
test('Sydney date across DST change is independent of execution timezone',()=>{
  assert.equal(sydneyDate('2026-10-03T13:59:59Z'),'2026-10-03');
  assert.equal(sydneyDate('2026-10-03T14:00:00Z'),'2026-10-04');
  assert.equal(sydneyDate('2026-10-04T13:00:00Z'),'2026-10-05');
});
test('missing or impossible deadline blocks acceptance without claiming expiry',()=>{
  for(const deadline of [null,undefined,'','2026-02-30','2026-13-01','2026-10-18T12:00:00Z','<script>']) {
    const state=pendingOfferAvailability({...offer,deadline},before);
    assert.equal(state.canAccept,false);assert.equal(state.reason,'invalid_deadline');assert.doesNotMatch(state.message,/has expired/);
  }
});
test('inactive archived and unknown flags are unavailable',()=>{
  for(const patch of [{active:false},{active:null},{active:undefined},{archived:true},{archived:null},{archived:undefined}]) assert.equal(pendingOfferAvailability({...offer,...patch},before).canAccept,false);
});
test('server-recorded expired status has no refund-success claim',()=>{
  const state=pendingOfferAvailability({...offer,status:'Offer Cancelled',active:false,expired_at:'2026-10-19T00:00:00Z'},before);
  assert.equal(state.reason,'expired');assert.match(state.message,/No refund is confirmed/);
});
test('accepted work remains outside pending expiry policy',()=>{
  for(const stage of [2,3,4,5]) {const state=pendingOfferAvailability({...offer,stage,status:'accepted'},after);assert.equal(state.message,null);assert.equal(state.reason,'not_pending');}
});
test('invalid current date blocks rather than guessing eligibility',()=>{
  assert.equal(pendingOfferAvailability(offer,NaN).reason,'date_unavailable');assert.throws(()=>sydneyDate(NaN));
});
function readClient(data,error=null) {
  return {from:table=>{
    assert.equal(table,'private_offers');
    return {select:fields=>{
      assert.equal(fields,'id,stage,status,active,archived,expired_at,deadline');
      return {eq:(key,value)=>{
        assert.equal(key,'id');assert.equal(value,id);
        return {single:async()=>({data,error})};
      }};
    }};
  }};
}
test('fresh eligibility read validates returned identity and blocks unknown state',async()=>{
  assert.equal((await readPendingAcceptance(readClient(offer),id,before)).canAccept,true);
  await assert.rejects(readPendingAcceptance(readClient({...offer,id:'other'}),id,before));
  await assert.rejects(readPendingAcceptance(readClient(null,Error('query failed')),id,before));
});
test('fresh read evaluates time after the async query completes',async()=>{
  const previous=Date.now;
  const client={from:()=>({select:()=>({eq:()=>({single:async()=>{Date.now=()=>after;return {data:offer};}})})})};
  try {Date.now=()=>before;assert.equal((await readPendingAcceptance(client,id)).reason,'deadline_passed');} finally {Date.now=previous;}
});

const source=readFileSync(new URL('../js/sponseeOffers.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const start=source.indexOf("    if (e.target.classList.contains('confirm-offer')) {");
const end=source.indexOf("    if (e.target.classList.contains('reject-offer')) {",start);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function acceptanceRun({local=offer,fresh=offer,readError=null,writeError=null,confirmed=true,now=before}={}) {
  const record={reads:0,writes:0,reloads:0,alerts:[]};
  const client={from:()=>({select:()=>({eq:()=>({single:async()=>{record.reads++;return {data:fresh,error:readError};}})}),update:payload=>{record.writes++;assert.deepEqual(payload,{status:'accepted',stage:2});return {eq:async()=>({error:writeError})};}})};
  const run=new AsyncFunction('e','allSponseeOffers','offerId','pendingOfferAvailability','readPendingAcceptance','loadSponseeOffers','window','alert','supabase','getCurrentSponseeActiveOfferCount',source.slice(start,end));
  await run({target:{classList:{contains:name=>name==='confirm-offer'}}},[local],id,p=>pendingOfferAvailability(p,now),(c,offerId)=>readPendingAcceptance(c,offerId,now),async()=>{record.reloads++;},{SS_PLAN_TYPE:'pro',confirm:()=>confirmed},message=>record.alerts.push(message),client,async()=>0);
  return record;
}
test('already overdue card cannot reach confirmation write',async()=>{
  const result=await acceptanceRun({now:after});assert.equal(result.reads,0);assert.equal(result.writes,0);assert.match(result.alerts[0],/deadline has passed/);
});
test('stale valid card rechecks current state before mutation',async()=>{
  const result=await acceptanceRun({fresh:{...offer,status:'Offer Cancelled',expired_at:'2026-10-18T00:00:00Z'}});assert.equal(result.reads,1);assert.equal(result.writes,0);assert.match(result.alerts[0],/expired/);
});
test('unconfirmed fresh read blocks business write',async()=>{
  const result=await acceptanceRun({readError:Error('unavailable')});assert.equal(result.writes,0);assert.match(result.alerts[0],/could not be confirmed/);
});
test('valid pending acceptance keeps existing business mutation',async()=>{
  const result=await acceptanceRun();assert.equal(result.reads,1);assert.equal(result.writes,1);assert.equal(result.reloads,1);
});
test('server race error remains visible instead of claiming acceptance',async()=>{
  const result=await acceptanceRun({writeError:{message:'Offer deadline passed'}});assert.equal(result.writes,1);assert.match(result.alerts[0],/Error accepting offer: Offer deadline passed/);assert.equal(result.reloads,0);
});
test('cancelled confirmation does not read or mutate offer',async()=>{
  const result=await acceptanceRun({confirmed:false});assert.equal(result.reads,0);assert.equal(result.writes,0);
});
test('rendered acceptance uses shared policy and both dashboards mount notice',()=>{
  assert.match(source,/pendingOfferAvailability\(offer\).canAccept \? '<button class="confirm-offer">Accept Offer/);
  for(const file of ['sponsorOffers.js','sponseeOffers.js']) assert.match(readFileSync(new URL(`../js/${file}`,import.meta.url),'utf8'),/mountPendingExpiryNotice\(/);
});
test('overdue pending priority uses Sydney policy instead of asking for acceptance',()=>{
  const item=attentionItems([offer],'sponsor',after)[0];
  assert.equal(item.overdue,true);assert.match(item.action,/deadline has passed/);assert.doesNotMatch(item.action,/Awaiting creator response/);
});
test('accepted work priorities retain schedule-review behavior after deadline',()=>{
  const item=attentionItems([{...offer,stage:2,status:'accepted'}],'sponsor',after)[0];
  assert.equal(item.action,'Check the agreed production schedule');
});
