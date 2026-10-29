import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.1.0';
import {googlePurchase,sha} from '../meadow-market-store/google.ts';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const base=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function rpc(name:string,body:unknown){
 const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',signal:AbortSignal.timeout(12000),headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw Error('Database unavailable');return r.json();
}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Use POST',{status:405});
 try{
  const audience=Deno.env.get('GOOGLE_PLAY_RTDN_AUDIENCE'),email=Deno.env.get('GOOGLE_PLAY_PUBSUB_EMAIL');
  if(!audience||!email)return new Response('Not configured',{status:503});
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
  const {payload}=await jwtVerify(token,keys,{audience,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256']});
  if(payload.email!==email||payload.email_verified!==true)return new Response('Unauthorized',{status:403});
  const raw=await req.text();if(raw.length>65536)return new Response('Too large',{status:413});
  const message=JSON.parse(raw);if(typeof message.message?.data!=='string')return new Response('Invalid message',{status:400});
  const event=JSON.parse(atob(message.message.data));if(event.packageName!=='com.meadowandmarket.game')return new Response('Wrong game',{status:403});
  if(event.testNotification)return new Response('OK');
  const note=event.oneTimeProductNotification;if(!note)return new Response('Unsupported notification',{status:400});
  const purchaseToken=String(note.purchaseToken||'');if(purchaseToken.length<10||purchaseToken.length>4096)return new Response('Invalid token',{status:400});
  const hash=await sha(purchaseToken),owner=await rpc('meadow_market_store_purchase_owner',{p_token_hash:hash});
  // Unclaimed purchases are restored by the authenticated client; a notification
  // never assigns a payment to an account based on its untrusted message body.
  if(!owner)return new Response('OK');
  const purchase=await googlePurchase(owner.product_id,purchaseToken);
  if(purchase.purchaseState===1)await rpc('meadow_market_revoke_store_purchase',{p_token_hash:hash});
  return new Response('OK');
 }catch{return new Response('Notification not processed',{status:503});}
});
