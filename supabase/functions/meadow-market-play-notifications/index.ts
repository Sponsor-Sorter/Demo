import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.1.0';
import {googlePurchase,sha} from '../meadow-market-store/google.ts';
import {InvalidNotification,processNotification} from './process.ts';
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
  let payload;
  try{({payload}=await jwtVerify(token,keys,{audience,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256']}));}
  catch{return new Response('Unauthorized',{status:401});}
  if(payload.email!==email||payload.email_verified!==true)return new Response('Unauthorized',{status:403});
  await processNotification(await req.text(),{
   hash:sha,owner:hash=>rpc('meadow_market_store_purchase_owner',{p_token_hash:hash}),
   purchase:googlePurchase,revoke:hash=>rpc('meadow_market_revoke_store_purchase',{p_token_hash:hash})
  });
  return new Response('OK');
 }catch(error){return new Response('Notification not processed',{status:error instanceof InvalidNotification?400:503});}
});
