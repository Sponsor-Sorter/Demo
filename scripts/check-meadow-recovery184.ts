// Isolated Edge tests. fetch is mocked; this process has no network permission.
Deno.env.set('SUPABASE_URL','https://meadow.test');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','fake-test-service');
Deno.env.set('SUPABASE_ANON_KEY','fake-test-public');
let handler: (req:Request)=>Promise<Response>;
const trace:string[]=[];
let failAuth=false,failFinish=false,busy=false,failLogout=false;
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
Deno.serve=((fn:typeof handler)=>{handler=fn;return {}}) as typeof Deno.serve;
globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
 const path=new URL(String(input)).pathname;trace.push(path+':'+(init?.method||'GET'));
 const data=init?.body?JSON.parse(String(init.body)):{};
 if(path.endsWith('meadow_market_auth_attempt'))return json(true);
 if(path.endsWith('meadow_market_reserve_recovery'))return json(busy?null:'test-user');
 if(path.endsWith('meadow_market_finish_recovery')){trace.push('finalize:'+data.p_success);return json(!failFinish)}
 if(path.endsWith('meadow_market_set_recovery'))return json(!busy);
 if(path==='/auth/v1/user')return json({id:'test-user',is_anonymous:false,email:'test@example.invalid'});
 if(path==='/rest/v1/meadow_market_accounts')return json([{username:'test_player'}]);
 if(path==='/auth/v1/admin/users/test-user')return init?.method==='PUT'?json({},failAuth?503:200):json({email:'test@example.invalid'});
 if(path==='/auth/v1/token')return json({access_token:'fake-token'});
 if(path==='/auth/v1/logout')return json({},failLogout?503:200);
 throw Error('Unexpected mocked request: '+path);
}) as typeof fetch;
await import('../supabase/functions/meadow-market-accounts/index.ts');
const assert=(condition:unknown,message:string)=>{if(!condition)throw Error(message)};
const request=async(action='recover',origin='https://sponsorsorter.com')=>{trace.length=0;return await handler(new Request('https://meadow.test/functions/v1/meadow-market-accounts',{method:'POST',headers:{origin,'Content-Type':'application/json',Authorization:'Bearer fake-user'},body:JSON.stringify({action,username:'test_player',password:'isolated-test-only',recovery_key:'a'.repeat(64)})}))};
Deno.test('recovery reserves, changes Auth, consumes once and revokes sessions',async()=>{
 const r=await request();const body=await r.json();assert(r.status===200&&body.recovered&&body.sessions_revoked,'successful recovery');
 assert(trace.indexOf('/rest/v1/rpc/meadow_market_reserve_recovery:POST')<trace.indexOf('/auth/v1/admin/users/test-user:PUT'),'reservation first');
 assert(trace.indexOf('/auth/v1/admin/users/test-user:PUT')<trace.indexOf('finalize:true'),'consume only after password accepted');
});
Deno.test('failed Auth releases the key without burning it',async()=>{failAuth=true;const r=await request();assert(r.status===503,'retryable failure');assert(trace.includes('finalize:false'),'release lease');assert(!trace.includes('finalize:true'),'no consume');failAuth=false});
Deno.test('concurrent recovery blocks Auth and key replacement',async()=>{busy=true;let r=await request();assert(r.status===401,'busy reset rejected');assert(!trace.includes('/auth/v1/admin/users/test-user:PUT'),'no competing password write');r=await request('recovery_setup');assert(r.status===503,'replacement waits');busy=false});
Deno.test('uncertain finalization explains new-password sign in',async()=>{failFinish=true;const r=await request();assert(r.status===503,'uncertain finish');assert((await r.json()).error.includes('new password'),'honest guidance');failFinish=false});
Deno.test('revocation failure does not report a failed password reset',async()=>{failLogout=true;const r=await request();const body=await r.json();assert(body.recovered&&body.sessions_revoked===false,'truthful partial outcome');failLogout=false});
Deno.test('unsupported origins rejected before Auth',async()=>{const r=await request('recover','https://untrusted.invalid');assert(r.status===403&&trace.length===0,'origin gate')});
