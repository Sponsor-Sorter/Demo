import {createHandler,authorised} from '../supabase/functions/meadow-market-account-cleanup/worker.ts';
const assert=(v:unknown,message='Assertion failed')=>{if(!v)throw Error(message)};
const id='00000000-0000-4000-8000-000000000001',lease='00000000-0000-4000-8000-000000000002',token='cleanup-fixture-token-only-0000000000000000';
function fixture({shared=false,mismatch=false,failDelete=false}={}){
 const calls:{path:string;method:string;body:any}[]=[];
 const send=async(input:RequestInfo|URL,init?:RequestInit)=>{const path=new URL(String(input)).pathname,body=init?.body?JSON.parse(String(init.body)):null;calls.push({path,method:init?.method||'GET',body});
  if(path.endsWith('meadow_market_retire_login'))return Response.json(body.p_action==='claim'?[{user_id:id,lease}]:body.p_action==='confirm'?!shared:body.p_success);
  if(init?.method==='DELETE')return failDelete?new Response('',{status:503}):Response.json({id});
  return Response.json({id,email:mismatch?'another-app@example.test':'player-'+id+'@players.sponsorsorter.com'});
 };
 return {calls,run:createHandler({base:'https://fixture.test',secret:'server-only-fixture',token},send as typeof fetch)};
}
async function req(secret=token,time=Math.floor(Date.now()/1000)){
 const nonce=crypto.randomUUID(),encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('meadow-cleanup-v1\n'+time+'\n'+nonce)));
 return new Request('https://fixture.test/cleanup',{method:'POST',headers:{'x-meadow-cleanup-time':String(time),'x-meadow-cleanup-nonce':nonce,'x-meadow-cleanup-signature':Array.from(signature,x=>x.toString(16).padStart(2,'0')).join('')}});
}
Deno.test('cleanup rejects missing/wrong/unconfigured tokens before backend access',async()=>{
 assert(!await authorised(await req(),''));assert(!await authorised(await req('wrong-secret'),token));assert(await authorised(await req(),token));assert(!await authorised(await req(token,Math.floor(Date.now()/1000)-121),token));
 const f=fixture();assert((await f.run(new Request('https://fixture.test',{method:'POST'}))).status===401);assert(f.calls.length===0);
});
Deno.test('only confirmed exact game alias receives soft deletion and receipt',async()=>{
 const f=fixture(),r=await(await f.run(await req())).json();assert(r.retired===1);const del=f.calls.find(x=>x.method==='DELETE');assert(del?.body.should_soft_delete===true);assert(!JSON.stringify(r).includes(id));
});
Deno.test('shared identity or changed alias never deleted',async()=>{for(const options of [{shared:true},{mismatch:true}]){const f=fixture(options),r=await(await f.run(await req())).json();assert(r.retired===0);assert(!f.calls.some(c=>c.method==='DELETE'));assert(f.calls.at(-1)?.body.p_success===false)}});
Deno.test('provider failure remains retryable without claiming successful retirement',async()=>{const f=fixture({failDelete:true}),r=await(await f.run(await req())).json();assert(r.deferred===1&&r.retired===0);assert(f.calls.at(-1)?.body.p_success===false)});
