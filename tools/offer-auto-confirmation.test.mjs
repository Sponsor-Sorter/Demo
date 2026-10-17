import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { needsConfirmationNotice, confirmationNoticeModel, readAutoConfirmation, pauseAutoConfirmation } from '../js/offerAutoConfirmation.mjs';

test('only stage4 unconfirmed offers need a status check',()=>{
  assert.equal(needsConfirmationNotice({stage:4}),true);
  assert.equal(needsConfirmationNotice({stage:3}),false);
  assert.equal(needsConfirmationNotice({stage:4,sponsor_live_confirmed:true}),false);
  assert.equal(needsConfirmationNotice({stage:4,sponsor_live_confirm:true}),false);
});
test('server due time supplies notice; sponsor can request review',()=>{
  const model=confirmationNoticeModel({ok:true,waiting:true,due_at:'2026-10-20T22:16:17Z'},'sponsor');
  assert.equal(model.canRequest,true); assert.match(model.text,/scheduled/);
});
test('creator sees status without sponsor review action',()=>{
  assert.equal(confirmationNoticeModel({ok:true,waiting:true,due_at:'2026-10-20T22:16:17Z'},'creator').canRequest,false);
});
test('paused state has no review action or running deadline',()=>{
  const model=confirmationNoticeModel({ok:true,paused:true,waiting:true},'sponsor');
  assert.equal(model.canRequest,false); assert.match(model.text,/paused/);
});
test('invalid or absent server deadline never derives a client deadline',()=>{
  for(const due_at of [null,'bad']) assert.throws(()=>confirmationNoticeModel({ok:true,waiting:true,due_at,live_date:'2025-01-01'},'sponsor'),/unavailable/);
});
test('completed/nonwaiting states do not offer a review pause',()=>{
  assert.equal(confirmationNoticeModel({ok:true,waiting:false},'sponsor'),null);
  assert.equal(confirmationNoticeModel({ok:true,auto_confirmed:true},'sponsor').canRequest,false);
});
test('status RPC is participant scoped and response offer must match',async()=>{
  const client={rpc:async(name,body)=>{assert.equal(name,'get_offer_auto_confirmation');assert.equal(body.p_offer_id,'owned-offer');return {data:{ok:true,offer_id:'owned-offer',waiting:false}};}};
  assert.equal((await readAutoConfirmation(client,'owned-offer')).ok,true);
  await assert.rejects(readAutoConfirmation({rpc:async()=>({data:{ok:true,offer_id:'other'}})},'owned-offer'),/mismatch/);
});
test('review pause sends request UUID without any payment or offer update',async()=>{
  const calls=[];
  const client={rpc:async(name,body)=>{calls.push({name,body});return {data:{ok:true,state:'paused'}};}};
  await pauseAutoConfirmation(client,'owned-offer','same-request');
  await pauseAutoConfirmation(client,'owned-offer','same-request');
  assert.equal(calls[0].name,'pause_offer_auto_confirmation');
  assert.deepEqual(calls[0].body,calls[1].body);
});
test('errors fail closed and are not automatically retried',async()=>{
  let calls=0;
  await assert.rejects(readAutoConfirmation({rpc:async()=>{calls++;return {error:{message:'denied'}};}},'owned-offer'));
  assert.equal(calls,1);
});
test('notice never derives clock from publication dates or promises payout',async()=>{
  const source=await readFile(new URL('../js/offerAutoConfirmation.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/live_date|url_dates|\.update\(|wallet|Stripe/);
  assert.match(source,/Payment release is handled separately/);
  assert.match(source,/result.state === 'superseded'/);
  assert.match(source,/requestId \|\|= crypto.randomUUID/);
});
