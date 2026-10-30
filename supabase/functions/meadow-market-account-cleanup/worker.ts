type Job={user_id:string;lease:string};
type Config={base:string;secret:string;token:string};
export async function authorised(req:Request,secret:string,now=Date.now()){
 const timestamp=req.headers.get('x-meadow-cleanup-time')||'',nonce=req.headers.get('x-meadow-cleanup-nonce')||'',received=req.headers.get('x-meadow-cleanup-signature')||'';
 if(secret.length<32||!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>120||!/^[0-9a-f-]{36}$/.test(nonce)||!/^[0-9a-f]{64}$/.test(received))return false;
 const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('meadow-cleanup-v1\n'+timestamp+'\n'+nonce))),actual=Uint8Array.from(received.match(/../g)!,v=>parseInt(v,16));
 let difference=0;for(let i=0;i<expected.length;i++)difference|=expected[i]^actual[i];return difference===0;
}
export function createHandler(config:Config,send:typeof fetch=fetch){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
 async function call(path:string,method:string,body?:unknown){
  const response=await send(config.base+path,{method,signal:AbortSignal.timeout(12000),headers:{apikey:config.secret,Authorization:'Bearer '+config.secret,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok)throw Error('CLEANUP_BACKEND_UNAVAILABLE');return response.json();
 }
 const rpc=(action:string,job?:Job,success=false)=>call('/rest/v1/rpc/meadow_market_retire_login','POST',{p_action:action,p_user:job?.user_id||null,p_lease:job?.lease||null,p_success:success});
 return async(req:Request)=>{
  const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
  if(req.method!=='POST')return reply(405,{error:'Use POST'});
  if(!await authorised(req,config.token))return reply(401,{error:'Not authorised'});
  try{
   const jobs=await rpc('claim');if(!Array.isArray(jobs)||jobs.length>3)throw Error('INVALID_CLEANUP_BATCH');
   let retired=0,deferred=0;
   for(const job of jobs as Job[]){
    if(!/^[0-9a-f-]{36}$/.test(job.user_id)||!/^[0-9a-f-]{36}$/.test(job.lease))throw Error('INVALID_CLEANUP_JOB');
    try{
     const user=await call('/auth/v1/admin/users/'+job.user_id,'GET');
     // A current Auth read AND a fresh database ownership check must both agree.
     if(user.id!==job.user_id||user.email!=='player-'+job.user_id+'@players.sponsorsorter.com'||user.phone||!await rpc('confirm',job)){await rpc('finish',job,false);deferred++;continue}
     await call('/auth/v1/admin/users/'+job.user_id,'DELETE',{should_soft_delete:true});
     if(await rpc('finish',job,true))retired++;else deferred++;
    }catch{try{await rpc('finish',job,false)}catch{/* Lease expiration permits a bounded retry. */}deferred++}
   }
   return reply(200,{processed:jobs.length,retired,deferred});
  }catch{return reply(503,{error:'Cleanup deferred; queued accounts will retry'});}
 };
}
