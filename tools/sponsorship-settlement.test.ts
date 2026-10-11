import { handleSettlement } from '../supabase/functions/settle-sponsorship/index.ts';
const order='11111111-1111-4111-8111-111111111111';
Deno.env.set('SUPABASE_URL','https://database.invalid');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','fixture');Deno.env.set('SUPABASE_ANON_KEY','fixture');Deno.env.set('SPONSORSHIP_STRIPE_SECRET_KEY','sk_test_fixture');
function check(value:unknown,expected:unknown){if(value!==expected)throw Error(`Expected ${expected}: ${value}`);}
Deno.test('settlement verifies funding and recipient, reuses transfers, and survives reconciliation failures',async()=>{
 const original=globalThis.fetch;let created=0,recorded=0,existing=false,recordFailure=false,authorized=true,capable=true,refunded=false;
 const settlement={id:'22222222-2222-4222-8222-222222222222',status:'processing',livemode:false,payment_intent_id:'pi_fixture',total_cents:11000,amount_cents:10000,currency:'usd',destination:'acct_fixture',started_at:new Date().toISOString()};
 const transfer={id:'tr_fixture',amount:10000,currency:'usd',destination:'acct_fixture',livemode:false,source_transaction:'ch_fixture',metadata:{settlement_id:settlement.id}};
 globalThis.fetch=async(input,init)=>{
  const url=String(input instanceof Request?input.url:input);
  if(url.includes('/auth/v1/user'))return Response.json({id:'admin_fixture'});
  if(url.includes('claim_sponsorship_settlement'))return authorized?Response.json(settlement):Response.json({message:'denied'},{status:403});
  if(url.includes('record_sponsorship_transfer')){recorded++;return recordFailure?new Response('failed',{status:500}):Response.json(null);}
  if(url.includes('/payment_intents/'))return Response.json({id:'pi_fixture',livemode:false,status:'succeeded',amount_received:11000,currency:'usd',metadata:{order_id:order},latest_charge:{id:'ch_fixture',amount_refunded:refunded?100:0,disputed:false}});
  if(url.includes('/v2/core/accounts/'))return Response.json({id:'acct_fixture',configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:capable?'active':'restricted'}}}}}});
  if(url.includes('/v1/transfers') && init?.method==='POST'){created++;existing=true;return Response.json(transfer);}
  if(url.includes('/v1/transfers'))return Response.json({object:'list',has_more:false,data:existing?[transfer]:[]});
  throw Error(`Unexpected fixture request: ${url}`);
 };
 const request=()=>new Request('https://function.invalid',{method:'POST',headers:{authorization:'Bearer fixture','content-type':'application/json'},body:JSON.stringify({order_id:order})});
 try{
  check((await handleSettlement(request())).status,200);check(created,1);check(recorded,1);
  check((await handleSettlement(request())).status,200);check(created,1);check(recorded,2);
  recordFailure=true;check((await handleSettlement(request())).status,409);check(created,1);
  recordFailure=false;check((await handleSettlement(request())).status,200);check(created,1);
  capable=false;check((await handleSettlement(request())).status,409);check(created,1);capable=true;
  refunded=true;check((await handleSettlement(request())).status,409);check(created,1);refunded=false;
  authorized=false;check((await handleSettlement(request())).status,409);check(created,1);
 }finally{globalThis.fetch=original;}
});
