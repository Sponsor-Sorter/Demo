import test from 'node:test';
import assert from 'node:assert/strict';
import { billingBody, stripeBillingUrl, subscriptionBilling, checkoutRequestId, subscriptionStatusText } from '../js/subscriptionBilling.mjs';

const id = '00000000-0000-4000-8000-000000000001';
test('checkout payload excludes client price, customer and owner', () => {
  assert.deepEqual(billingBody('checkout', { request_id:id, frontendBaseUrl:'https://sponsorsorter.com/', customer_id:'other', price_id:'cheap', user_id:'other' }), { action:'checkout', request_id:id, frontendBaseUrl:'https://sponsorsorter.com' });
});
test('read and portal actions never send customer IDs', () => {
  for (const action of ['status','portal']) assert.deepEqual(billingBody(action,{customer_id:'other'}),{action});
});
test('complete only sends checkout reference', () => {
  assert.deepEqual(billingBody('complete',{session_id:'cs_test_123',user_id:'other'}),{action:'complete',session_id:'cs_test_123'});
  assert.throws(()=>billingBody('complete',{session_id:'invalid'}));
});
test('bad checkout references and insecure frontend addresses are rejected', () => {
  assert.throws(()=>billingBody('checkout',{request_id:'x',frontendBaseUrl:'https://sponsorsorter.com'}));
  for (const frontendBaseUrl of ['http://sponsorsorter.com','https://user:pass@sponsorsorter.com','https://sponsorsorter.com/?x=1']) assert.throws(()=>billingBody('checkout',{request_id:id,frontendBaseUrl}));
});
test('redirects permit only exact HTTPS Checkout and Portal hosts', () => {
  assert.equal(stripeBillingUrl('https://checkout.stripe.com/c/pay/test','checkout'),'https://checkout.stripe.com/c/pay/test');
  assert.equal(stripeBillingUrl('https://billing.stripe.com/p/session/test','portal'),'https://billing.stripe.com/p/session/test');
  for (const value of ['https://checkout.stripe.com.evil.test/','javascript:alert(1)','http://checkout.stripe.com/','https://x@checkout.stripe.com/','https://dashboard.stripe.com/test/customers/x']) assert.throws(()=>stripeBillingUrl(value,'checkout'));
});
test('missing session sends no billing request', async () => {
  let calls=0;
  await assert.rejects(subscriptionBilling({auth:{getSession:async()=>({data:{session:null}})},functions:{invoke:async()=>{calls++;}}},'status'));
  assert.equal(calls,0);
});
test('uncertain transport failure sends exactly one POST', async () => {
  let calls=0;
  const client={auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},functions:{invoke:async()=>{calls++;return {error:new Error('network')};}}};
  await assert.rejects(subscriptionBilling(client,'checkout',{request_id:id,frontendBaseUrl:'https://sponsorsorter.com'}));
  assert.equal(calls,1);
});
test('checkout request survives uncertainty and is scoped by owner', () => {
  const values=new Map(); const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  assert.equal(checkoutRequestId(storage,id,()=>id),id);
  assert.equal(checkoutRequestId(storage,id,()=>{throw Error('must reuse');}),id);
  const other='00000000-0000-4000-8000-000000000002';
  assert.equal(checkoutRequestId(storage,other,()=>other),other);
});
test('local development accepts only documented HTTP localhost port', () => {
  assert.equal(billingBody('checkout',{request_id:id,frontendBaseUrl:'http://localhost:5500'}).frontendBaseUrl,'http://localhost:5500');
  assert.throws(()=>billingBody('checkout',{request_id:id,frontendBaseUrl:'http://localhost:8080'}));
});
test('provider review errors retain safe actionable code without exposing raw details', async () => {
  const client={auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},functions:{invoke:async()=>({error:{context:{json:async()=>({ok:false,code:'CUSTOMER_REVIEW_REQUIRED',message:'sensitive provider detail'})}}})}};
  await assert.rejects(subscriptionBilling(client,'status'),error=>error.code==='CUSTOMER_REVIEW_REQUIRED' && !error.message.includes('sensitive'));
});
test('malformed or non-success response is never accepted', async () => {
  const client={auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},functions:{invoke:async()=>({data:{subscription:{}}})}};
  await assert.rejects(subscriptionBilling(client,'status'));
});
test('status is explicit and never treats every subscription object as active', () => {
  assert.match(subscriptionStatusText({ok:true,plan:'free',customer_linked:false,subscription:null}),/No Stripe subscription linked/);
  assert.match(subscriptionStatusText({ok:true,plan:'free',customer_linked:true,subscription:{status:'past_due'}}),/Payment overdue/);
  assert.throws(()=>subscriptionStatusText({ok:true,plan:'pro'}));
});
