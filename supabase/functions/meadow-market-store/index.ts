import {googlePurchase,settle,sha} from './google.ts';
import {validatePurchase} from './rules.ts';
const base=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins=new Set(['https://sponsorsorter.com','https://localhost']);
const consumables=new Set(['mm_pocket_gems','mm_gem_chest','mm_starter_pack','mm_builders_pack','mm_reward_tickets','mm_pantry_pack']);
async function db(path:string,body?:unknown,bearer=secret){
 const r=await fetch(base+path,{method:body===undefined?'GET':'POST',signal:AbortSignal.timeout(12000),headers:{apikey:secret,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok)throw Error('STORE_DELIVERY_UNAVAILABLE');return r.json();
}
export async function verify(user:string,product:string,purchaseToken:string){
 if(!consumables.has(product)&&product!=='mm_premium')throw Error('UNKNOWN_PRODUCT');
 if(purchaseToken.length<10||purchaseToken.length>4096)throw Error('INVALID_PURCHASE');
 const purchase=await googlePurchase(product,purchaseToken);
 const checked=validatePurchase(purchase,await sha('meadow-markets:'+user));
 const hash=await sha(purchaseToken);
 const delivered=await db('/rest/v1/rpc/meadow_market_deliver_store_purchase',{p_user:user,p_product:product,p_token_hash:hash,p_order:purchase.orderId||null,p_test:checked.test});
 // Credit first, then acknowledge. A retry uses the same global token hash.
 if(!delivered.settled){
  if(consumables.has(product)?purchase.consumptionState!==1:purchase.acknowledgementState!==1)await settle(product,purchaseToken,consumables.has(product));
  await db('/rest/v1/rpc/meadow_market_settle_store_purchase',{p_token_hash:hash});
 }
 return {verified:true,receipt_id:delivered.receipt_id,duplicate:delivered.duplicate};
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://sponsorsorter.com','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{error:'Unsupported game address'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Use POST'});
 try{
  const bearer=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');if(!bearer)return reply(401,{error:'Sign in first'});
  const identity=await db('/auth/v1/user',undefined,bearer);if(!identity?.id)return reply(401,{error:'Sign in first'});
  const raw=await req.text();if(raw.length>8192)return reply(413,{error:'Request too large'});
  const body=JSON.parse(raw);
  return reply(200,await verify(identity.id,String(body.product||''),String(body.token||'')));
 }catch(error){
  // No tokens, credentials, Google bodies or user data enter response/logs.
  const code=error instanceof Error?error.message:'';
  return reply(code==='PURCHASE_PENDING'?409:503,{error:['PURCHASE_PENDING','PURCHASE_ACCOUNT_MISMATCH','PURCHASE_NOT_COMPLETED','UNKNOWN_PRODUCT'].includes(code)?code:'Your purchase has not been confirmed. Restore purchases to retry; no duplicate reward will be added.'});
 }
});
