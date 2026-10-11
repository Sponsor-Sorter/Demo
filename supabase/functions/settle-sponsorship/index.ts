import Stripe from 'npm:stripe@22.6.0';
const origins = new Set(['https://sponsorsorter.com','https://www.sponsorsorter.com','http://127.0.0.1:5500','http://localhost:5500']);
export async function handleSettlement(req: Request): Promise<Response> {
 const origin=req.headers.get('origin');
 const headers={'Access-Control-Allow-Origin':origin && origins.has(origin)?origin:'https://sponsorsorter.com','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
 if(origin && !origins.has(origin))return reply({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try {
  const base=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authorization=req.headers.get('authorization');
  if(!authorization)return reply({error:'Sign in required'},401);
  const auth=await fetch(`${base}/auth/v1/user`,{headers:{Authorization:authorization,apikey:Deno.env.get('SUPABASE_ANON_KEY')!}});
  const user=auth.ok?await auth.json():null;
  if(!user?.id || user.is_anonymous)return reply({error:'Sign in required'},401);
  const {order_id}=await req.json();
  if(typeof order_id!=='string' || !/^[0-9a-f-]{36}$/i.test(order_id))return reply({error:'Invalid order'},400);
  async function rpc(name:string,body:unknown) {
   const result=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!result.ok)throw new Error('Settlement is unavailable: check administrator access, confirmed completion, funding, review holds and recipient setup.');
   return result.status===204?null:await result.json();
  }
  const settlement=await rpc('claim_sponsorship_settlement',{p_order_id:order_id,p_admin_id:user.id});
  if(settlement.status==='transferred')return reply({status:'transferred',transfer_id:settlement.stripe_transfer_id});
  // Deployment is sandbox-only until live transfers receive explicit approval.
  if(settlement.livemode)return reply({error:'Live transfers are not enabled'},403);
  const secret=Deno.env.get('SPONSORSHIP_STRIPE_SECRET_KEY');
  if(!secret)return reply({error:'Payment environment is not configured'},503);
  const stripe=new Stripe(secret,{apiVersion:'2026-08-26.dahlia'});
  const intent=await stripe.paymentIntents.retrieve(settlement.payment_intent_id,{expand:['latest_charge']});
  const charge=intent.latest_charge as Stripe.Charge | null;
  if(intent.livemode!==settlement.livemode || intent.status!=='succeeded' || intent.amount_received!==Number(settlement.total_cents) || intent.currency!==settlement.currency || intent.metadata.order_id!==order_id || !charge || typeof charge==='string' || charge.amount_refunded>0 || charge.disputed) return reply({error:'Payment verification requires review'},409);
  const recipient=await stripe.v2.core.accounts.retrieve(settlement.destination,{include:['configuration.recipient']});
  if(recipient.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status!=='active')return reply({error:'Recipient must complete Stripe onboarding'},409);
  // Search before every retry, including requests beyond Stripe's idempotency retention.
  const group=`sponsorship_${order_id}`;
  const existing=await stripe.transfers.list({transfer_group:group,limit:100});
  if(existing.has_more || existing.data.length>1)return reply({error:'Transfer reconciliation requires review'},409);
  let transfer=existing.data[0];
  if(!transfer) {
   if(Date.now()-Date.parse(settlement.started_at)>23*60*60*1000)return reply({error:'Settlement retry window expired; reconcile before retrying'},409);
   transfer=await stripe.transfers.create({amount:Number(settlement.amount_cents),currency:settlement.currency,destination:settlement.destination,source_transaction:charge.id,transfer_group:group,metadata:{order_id,settlement_id:settlement.id}},{idempotencyKey:`sponsorship-settlement-${settlement.id}`});
  }
  if(transfer.amount!==Number(settlement.amount_cents) || transfer.currency!==settlement.currency || transfer.destination!==settlement.destination || transfer.livemode!==settlement.livemode || transfer.source_transaction!==charge.id || transfer.metadata.settlement_id!==settlement.id)return reply({error:'Transfer reconciliation requires review'},409);
  await rpc('record_sponsorship_transfer',{p_settlement_id:settlement.id,p_transfer_id:transfer.id,p_destination:transfer.destination,p_amount_cents:transfer.amount,p_currency:transfer.currency,p_livemode:transfer.livemode});
  return reply({status:'transferred',transfer_id:transfer.id,message:'Transferred to the creator’s Stripe balance. Bank payout timing is managed by Stripe.'});
 } catch(error) {
  return reply({error:error instanceof Error && error.message.startsWith('Settlement is unavailable')?error.message:'Settlement could not be confirmed. Retry safely or request reconciliation.'},409);
 }
}
if(import.meta.main)Deno.serve(handleSettlement);
