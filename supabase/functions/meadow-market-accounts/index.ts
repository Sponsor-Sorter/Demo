// Username/password adapter. Privileged credentials stay inside the Edge runtime.
const base = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const origins = new Set(['https://sponsorsorter.com','http://localhost:8767','http://localhost:8766','http://localhost:8771','https://localhost','http://localhost']);
const namePattern = /^[a-z0-9_]{3,20}$/;
async function request(path:string, method='GET', body?:unknown, bearer=secret) {
  const response = await fetch(base+path,{method,headers:{apikey:secret,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  let data;try{data=await response.json()}catch{data=null}
  return {ok:response.ok,status:response.status,data};
}
const digest = async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
  const origin=req.headers.get('origin')||'';
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://sponsorsorter.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!origins.has(origin))return reply(403,{error:'This game address is not supported.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'Use POST.'});
  try{
    const raw=await req.text();if(raw.length>4096)return reply(413,{error:'Request too large.'});
    const body=JSON.parse(raw),action=body.action,username=String(body.username||'').trim().toLowerCase(),password=typeof body.password==='string'?body.password:'';
    if(!['register','login','recovery_setup','recover'].includes(action)||(action!=='recovery_setup'&&!namePattern.test(username))||password.length<(['login','recovery_setup'].includes(action)?6:8)||new TextEncoder().encode(password).length>72)return reply(400,{error:'Use a username of 3–20 letters, numbers or underscores and a password of 8–72 bytes.'});
    // Only hashes are retained, for 15 minutes. Auth also applies its own sign-in limits.
    const ip=(req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||'unknown').split(',')[0].trim();
    const bucket=await digest(secret+':'+ip),attempt=await request('/rest/v1/rpc/meadow_market_auth_attempt','POST',{p_bucket:bucket,p_max:30});
    if(!attempt.ok||attempt.data!==true)return reply(429,{error:'Too many attempts. Please try again in 15 minutes.'});
    if(action==='recovery_setup'){
      const bearer=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
      const identity=await request('/auth/v1/user','GET',undefined,bearer);
      if(!identity.ok||!identity.data?.id||identity.data.is_anonymous)return reply(401,{error:'Sign in to your Meadow Markets account first.'});
      const owner=await request('/rest/v1/meadow_market_accounts?user_id=eq.'+identity.data.id+'&ready=eq.true&select=username');
      if(!owner.ok||!owner.data?.length)return reply(403,{error:'Protect this farm with a username first.'});
      const check=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({email:identity.data.email,password})});
      if(!check.ok)return reply(401,{error:'Your current password is incorrect.'});
      const key=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
      const saved=await request('/rest/v1/meadow_market_accounts?user_id=eq.'+identity.data.id,'PATCH',{recovery_hash:await digest(key),recovery_set_at:new Date().toISOString()});
      if(!saved.ok)return reply(503,{error:'Could not save recovery. Try again.'});
      return reply(200,{username:owner.data[0].username,recovery_key:key.match(/.{1,8}/g)!.join('-')});
    }
    if(action==='recover'){
      const key=String(body.recovery_key||'').replace(/[-\s]/g,'').toLowerCase();
      if(!/^[a-f0-9]{64}$/.test(key))return reply(401,{error:'The username or recovery key is incorrect.'});
      const gate=await request('/rest/v1/rpc/meadow_market_auth_attempt','POST',{p_bucket:await digest(secret+':recovery:'+username),p_max:8});
      if(!gate.ok||gate.data!==true)return reply(429,{error:'Too many recovery attempts. Please try again in 15 minutes.'});
      const hash=await digest(key),claim=await request('/rest/v1/rpc/meadow_market_claim_recovery','POST',{p_username:username,p_hash:hash});
      const id=claim.ok&&typeof claim.data==='string'?claim.data:null;
      if(!id)return reply(401,{error:'The username or recovery key is incorrect.'});
      const updated=await request('/auth/v1/admin/users/'+id,'PUT',{password});
      if(!updated.ok){await request('/rest/v1/meadow_market_accounts?user_id=eq.'+id+'&recovery_hash=is.null','PATCH',{recovery_hash:hash,recovery_set_at:new Date().toISOString()});return reply(503,{error:'Could not change the password. Your recovery key can be tried again.'});}
      const user=await request('/auth/v1/admin/users/'+id);
      const signed=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({email:user.data.email,password})});
      if(signed.ok){const token=await signed.json();await request('/auth/v1/logout?scope=global','POST',undefined,token.access_token);}
      return reply(200,{recovered:true,message:'Password changed. Sign in, then save a new recovery key. This key has been used.'});
    }
    if(action==='register'){
      const bearer=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
      const identity=await request('/auth/v1/user','GET',undefined,bearer);
      if(!identity.ok||!identity.data?.id||!identity.data.is_anonymous)return reply(401,{error:'Continue as a guest before protecting this farm.'});
      const id=identity.data.id;
      const farm=await request('/rest/v1/meadow_market_profiles?user_id=eq.'+id+'&select=user_id');
      if(!farm.ok||farm.data?.[0]?.user_id!==id)return reply(403,{error:'Open your Meadow Markets farm before creating its account.'});
      const prior=await request('/rest/v1/meadow_market_accounts?user_id=eq.'+id+'&select=username,ready');
      if(!prior.ok)return reply(503,{error:'Accounts are temporarily unavailable.'});
      if(prior.data?.length&&(prior.data[0].ready||prior.data[0].username!==username))return reply(409,{error:'This farm already has an account name.'});
      if(!prior.data?.length){const claim=await request('/rest/v1/meadow_market_accounts','POST',{username,user_id:id});if(!claim.ok)return reply(409,{error:'That username is unavailable. Please choose another.'})}
      // The alias belongs to this game, not an unverified real-world mailbox.
      // No real email is marked verified and project-wide email confirmation stays enabled.
      const alias='player-'+id+'@players.sponsorsorter.com';
      const updated=await request('/auth/v1/admin/users/'+id,'PUT',{email:alias,email_confirm:true,password,user_metadata:{meadow_app:'meadow-markets'}});
      if(!updated.ok)return reply(400,{error:'Could not protect this farm. Check your password and try the same username again.'});
      const ready=await request('/rest/v1/meadow_market_accounts?user_id=eq.'+id,'PATCH',{ready:true});
      if(!ready.ok)return reply(503,{error:'Account created but its name is still connecting. Keep this device signed in and contact support.'});
    }
    const account=await request('/rest/v1/meadow_market_accounts?username=eq.'+encodeURIComponent(username)+'&select=user_id');
    const userId=account.ok?account.data?.[0]?.user_id:null;
    const user=userId?await request('/auth/v1/admin/users/'+userId):null;
    // Use a random non-account alias for unknown names to keep the response generic.
    const email=user?.data?.email||'missing-'+crypto.randomUUID()+'@players.sponsorsorter.com';
    const response=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const session=await response.json();
    if(!response.ok||!userId||!session.access_token)return reply(401,{error:'The username or password is incorrect.'});
    // A successful password check can finish a claim interrupted after Auth saved it.
    await request('/rest/v1/meadow_market_accounts?user_id=eq.'+userId,'PATCH',{ready:true});
    return reply(200,{access_token:session.access_token,refresh_token:session.refresh_token,username,user_id:userId});
  }catch{return reply(503,{error:'Could not connect to accounts. Please try again.'})}
});
