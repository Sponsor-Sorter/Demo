import Stripe from 'npm:stripe@22.6.0';
import { handleWebhook } from '../supabase/functions/sponsorship-payment-webhook/index.ts';

// Real SDK cryptography; the database is isolated and no Stripe API is called.
const stripe = new Stripe('sk_test_validation_only');
const secret = 'whsec_validation_only';
Deno.env.set('STRIPE_SECRET_KEY', 'sk_test_validation_only');
Deno.env.set('SPONSORSHIP_STRIPE_SECRET_KEY', 'sk_test_validation_only');
Deno.env.set('SPONSORSHIP_STRIPE_WEBHOOK_SECRET', secret);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'validation_only');
Deno.env.set('SUPABASE_URL', 'https://database.invalid');
const payload = JSON.stringify({ id:'evt_validation',type:'checkout.session.completed',data:{object:{
 id:'cs_test_validation',mode:'payment',status:'complete',payment_status:'paid',
 metadata:{offerType:'private',order_id:'44444444-4444-4444-8444-444444444444'},
 payment_intent:'pi_validation',amount_total:11000,currency:'usd'
}}});
function check(actual:unknown, expected:unknown) { if(actual!==expected) throw new Error(`Expected ${expected}, received ${actual}`); }
Deno.test('real signed webhook: valid, tampered, stale and retryable delivery', async()=>{
 const originalFetch = globalThis.fetch;
 let writes=0;
 globalThis.fetch = async()=>{ writes++;return Response.json('offer_validation'); };
 try {
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({payload,secret});
  const request=(body=payload,header=signature)=>new Request('https://function.invalid',{method:'POST',body,headers:{'stripe-signature':header}});
  check((await handleWebhook(request())).status,200);check(writes,1);
  check((await handleWebhook(request(payload.replace('11000','100')))).status,400);check(writes,1);
  const stale = await stripe.webhooks.generateTestHeaderStringAsync({payload,secret,timestamp:Math.floor(Date.now()/1000)-600});
  check((await handleWebhook(request(payload,stale))).status,400);check(writes,1);
  globalThis.fetch=async()=>{throw new Error('Temporary network outage');};
  check((await handleWebhook(request())).status,500);
 } finally {globalThis.fetch=originalFetch;}
});
