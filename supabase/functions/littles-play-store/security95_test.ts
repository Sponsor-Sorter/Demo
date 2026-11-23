import { reconcile, noteStoreRuntime } from './service.ts';
const assert=(v:unknown,m='Assertion failed')=>{if(!v)throw Error(m);};
Deno.test('actual Play reconciliation never accuses ordinary wrong-account restores',async t=>{
 const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GOOGLE_PLAY_SERVICE_ACCOUNT'],prior=names.map(n=>Deno.env.get(n)),before=globalThis.fetch;
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const key=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8',keys.privateKey))));
 const owner='11111111-1111-4111-8111-111111111111',requester='22222222-2222-4222-8222-222222222222';let mode='wrong';const calls:string[]=[];
 Deno.env.set(names[0],'https://fixture.invalid');Deno.env.set(names[1],'fixture-service');Deno.env.set(names[2],JSON.stringify({client_email:'fixture@example.invalid',private_key:'-----BEGIN PRIVATE KEY-----\n'+key+'\n-----END PRIVATE KEY-----'}));
 globalThis.fetch=(async(input:string|URL|Request)=>{
  const url=input instanceof Request?input.url:String(input);calls.push(url);
  if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'fixture',expires_in:3600});
  if(url.includes('/purchases/subscriptionsv2/tokens/')){
   if(mode==='provider-error')return Response.json({error:'fixture unavailable'},{status:503});
   return Response.json({subscriptionState:mode==='pending'?'SUBSCRIPTION_STATE_PENDING':'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',externalAccountIdentifiers:{obfuscatedExternalAccountId:'a'.repeat(64)},testPurchase:{},lineItems:[{productId:'ml_plus',offerDetails:{basePlanId:'monthly'},expiryTime:new Date(Date.now()+(mode==='expired'?-300000:300000)).toISOString()}]});
  }
  if(url.endsWith('/meadow_littles_play_owner'))return Response.json(mode==='unlinked'?{}:{user_id:owner,test_allowed:mode!=='license-disabled'});
  if(url.endsWith('/meadow_littles_play_record'))return new Response(null,{status:204});
  if(url.endsWith('/fairplay_game_detector_heartbeat_v1'))return Response.json({accepted:true});
  if(url.endsWith('/fairplay_game_security_signal_v1'))throw Error('A normal restore must never emit a player signal');
  throw Error('Unexpected isolated request');
 }) as typeof fetch;
 try{
  for(const name of ['wrong','expired','pending','license-disabled','unlinked','provider-error','own-restore'])await t.step(name,async()=>{
   mode=name;calls.length=0;let code='';try{await reconcile('fixture-token-123456',name==='own-restore'?owner:requester);}catch(e){code=(e as Error).message;}
   if(name==='own-restore')assert(code==='');else if(name!=='provider-error')assert(code==='PURCHASE_ACCOUNT_MISMATCH','Wrong restore response changed');else assert(code.length>0);
   assert(!calls.some(c=>c.endsWith('/fairplay_game_security_signal_v1')));
   if(name!=='own-restore')assert(!calls.some(c=>c.endsWith('/meadow_littles_play_record')||c.endsWith(':acknowledge')));
  });
  await t.step('real runtime heartbeat has no actor or purchase signal',async()=>{calls.length=0;await noteStoreRuntime();assert(calls.some(c=>c.endsWith('/fairplay_game_detector_heartbeat_v1')));assert(!calls.some(c=>c.endsWith('/fairplay_game_security_signal_v1')));});
 }finally{globalThis.fetch=before;names.forEach((n,i)=>prior[i]===undefined?Deno.env.delete(n):Deno.env.set(n,prior[i]!));}
});
