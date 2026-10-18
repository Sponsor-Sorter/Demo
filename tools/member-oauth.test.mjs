import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exchangeMemberOAuth, memberOAuthBody, validateMemberOAuth, memberOAuthMessage } from '../js/memberOAuth.mjs';
const actor='11111111-1111-4111-8111-111111111111';
const input={code:'fixture-code',redirect_uri:'https://sponsorsorter.com/oauth2callback.html'};
const data=(provider='youtube')=>({ok:true,success:true,connected:true,provider,provider_user_id:provider==='youtube'?'UC'+'a'.repeat(22):'123456',handle:provider==='youtube'?'@fixture':'fixture'});
function client(reply,calls=[]){return {auth:{getSession:async()=>({data:{session:{user:{id:actor},access_token:'fixture'}}})},functions:{invoke:async(name,options)=>{calls.push({name,options});return reply;}}};}
test('YouTube and Twitch invoke only their endpoint with real session and exact body',async()=>{
 for(const provider of ['youtube','twitch']){
  const calls=[];const result=await exchangeMemberOAuth(client({data:data(provider)},calls),provider,input);
  assert.equal(result.ok,true);assert.equal(calls.length,1);assert.equal(calls[0].name,`${provider}-oauth`);
  assert.deepEqual(calls[0].options.body,input);assert.equal(calls[0].options.headers.Authorization,'Bearer fixture');assert.ok(calls[0].options.signal);
 }
});
test('HTTP200 application failures and malformed identities never become connected',async()=>{
 for(const value of [{ok:false,error:'private detail'},{...data(),success:false},{...data(),connected:false},{...data(),provider:'twitch'},{...data(),provider_user_id:'bad'},null]) await assert.rejects(exchangeMemberOAuth(client({data:value}),'youtube',input));
 assert.throws(()=>validateMemberOAuth({...data('twitch'),handle:'<script>'},'twitch'));
});
test('returned metadata is sanitized before success handling',()=>{
 const result=validateMemberOAuth({...data(),access_token:'must-not-propagate'},'youtube');assert.equal(Object.hasOwn(result,'access_token'),false);
});
test('callback allowlist preserves root and Demo paths and rejects query, hash, credentials and wrong hosts',()=>{
 for(const uri of ['https://sponsorsorter.com/oauth2callback.html','https://www.sponsorsorter.com/Demo/oauth2callback.html']) assert.equal(memberOAuthBody('youtube',{...input,redirect_uri:uri}).redirect_uri,uri);
 for(const uri of ['http://sponsorsorter.com/oauth2callback.html','https://other.invalid/oauth2callback.html','https://sponsorsorter.com/oauth2callback.html?code=x','https://sponsorsorter.com/oauth2callback.html#x','https://u:p@sponsorsorter.com/oauth2callback.html','https://sponsorsorter.com/other.html']) assert.throws(()=>memberOAuthBody('youtube',{...input,redirect_uri:uri}));
});
test('code bounds, unknown provider and extra input fields fail before auth',async()=>{
 for(const [provider,body] of [['facebook',input],['youtube',{...input,code:''}],['youtube',{...input,code:'two words'}],['youtube',{...input,code:'a'.repeat(8193)}],['youtube',{...input,access_token:'extra'}]]) await assert.rejects(exchangeMemberOAuth({},provider,body));
});
test('missing or anonymous session cannot exchange code',async()=>{
 const calls=[];const c=client({data:data()},calls);c.auth.getSession=async()=>({data:{}});
 await assert.rejects(exchangeMemberOAuth(c,'youtube',input),error=>error.code==='OWNER_SESSION_REQUIRED');
 c.auth.getSession=async()=>({data:{session:{user:{id:actor,is_anonymous:true},access_token:'fixture'}}});
 await assert.rejects(exchangeMemberOAuth(c,'youtube',input));assert.equal(calls.length,0);
});
test('late session resolution after deadline sends no exchange',async()=>{
 const calls=[];const c=client({data:data()},calls);c.auth.getSession=()=>new Promise(r=>setTimeout(()=>r({data:{session:{user:{id:actor},access_token:'fixture'}}}),25));
 await assert.rejects(exchangeMemberOAuth(c,'youtube',input,{timeoutMs:3}));await new Promise(r=>setTimeout(r,35));assert.equal(calls.length,0);
});
test('whole deadline covers stalled invoke and aborts without retry',async()=>{
 const calls=[];const c=client({},calls);c.functions.invoke=async(name,options)=>{calls.push({name,options});return new Promise(()=>{});};
 await assert.rejects(exchangeMemberOAuth(c,'youtube',input,{timeoutMs:3}));assert.equal(calls.length,1);assert.equal(calls[0].options.signal.aborted,true);
});
test('whole deadline covers stalled non2xx error JSON',async()=>{
 const calls=[];await assert.rejects(exchangeMemberOAuth(client({error:{context:{json:()=>new Promise(()=>{})}}},calls),'youtube',input,{timeoutMs:3}));assert.equal(calls.length,1);
});
test('late response cannot report connected after timeout',async()=>{
 const c=client({});c.functions.invoke=()=>new Promise(r=>setTimeout(()=>r({data:data()}),20));
 await assert.rejects(exchangeMemberOAuth(c,'youtube',input,{timeoutMs:3}));
});
test('unknown backend and thrown errors never expose raw payload',async()=>{
 await assert.rejects(exchangeMemberOAuth(client({error:{context:{json:async()=>({code:'UNKNOWN',error:'secret code detail'})}}}),'youtube',input),error=>!error.message.includes('secret'));
 const c=client({});c.auth.getSession=async()=>{throw Error('secret token detail');};await assert.rejects(exchangeMemberOAuth(c,'youtube',input),error=>!error.message.includes('secret'));
});
const handler=readFileSync(new URL('../js/oauth-handler.js',import.meta.url),'utf8');
function callbackGate(state,expected=state,extra='code=fixture-code'){
 const calls=[];const values=new Map([['oauth_state_youtube',expected]]);
 const start=handler.indexOf('  const qs =');const end=handler.indexOf('  setStatus(`<span style="color:#4886f4;',start);
 const run=new Function('document','location','history','localStorage','applyPlatformUI','PLATFORM_UI','EDGE_FN','fail','setStatus','escapeHtml',handler.slice(start,end)+'\nreturn {provider,code};');
 const result=run({title:'OAuth'},{search:'?'+extra+'&state='+encodeURIComponent(state),pathname:'/oauth2callback.html'},{replaceState:(...args)=>calls.push(['strip',...args])},{getItem:k=>values.get(k),removeItem:k=>{calls.push(['consume',k]);values.delete(k);}},()=>{}, {youtube:{name:'YouTube'}},{youtube:'youtube-oauth',twitch:'twitch-oauth'},message=>({failure:message}),message=>({status:message}),s=>s);
 return {result,calls,values};
}
test('callback strips code/error URL before one-use state check and consumes matching state',()=>{
 const state='youtube:'+'a'.repeat(64);const run=callbackGate(state);
 assert.deepEqual(run.result,{provider:'youtube',code:'fixture-code'});assert.equal(run.calls[0][0],'strip');assert.equal(run.calls[0][3],'/oauth2callback.html');assert.equal(run.values.size,0);
});
test('invalid, mismatched and consumed state never reaches exchange gate',()=>{
 assert.match(callbackGate('youtube:short').result.failure,/invalid/);
 const state='youtube:'+'a'.repeat(64);assert.match(callbackGate(state,'youtube:'+'b'.repeat(64)).result.failure,/failed/);
 assert.match(callbackGate(state,null).result.failure,/failed/);
 assert.match(callbackGate(state,state,'error=access_denied').result.failure,/OAuth error/);
});
test('strict helper runs before success branch; legacy Meta/TikTok branch remains separate',()=>{
 assert.match(handler,/provider === 'youtube' \|\| provider === 'twitch'[\s\S]*?exchangeMemberOAuth\(supabase, provider, \{ code, redirect_uri \}\)/);
 assert.ok(handler.indexOf('await exchangeMemberOAuth')<handler.indexOf('return success(provider)'));
 assert.match(handler,/result = await callEdgeFunction\(fn, jwt, \{ code, redirect_uri \}\)/);
 assert.match(readFileSync(new URL('../oauth2callback.html',import.meta.url),'utf8'),/oauth-handler\.js\?v=20261018-oauth1/);
});
test('actual callback exchange branch reports success only after strict server confirmation',async()=>{
 const start=handler.indexOf('  // ---------- OAuth exchange ----------');const end=handler.indexOf('  // ---------- helpers ----------',start);
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const run=new AsyncFunction('supabase','provider','pretty','code','location','exchangeMemberOAuth','memberOAuthMessage','setStatus','success','fail','escapeHtml',handler.slice(start,end));
 for(const [provider,payload,expected] of [['youtube',data(),true],['twitch',data('twitch'),true],['youtube',{ok:false,error:'hidden private error'},false]]){
  const status=[];const successes=[];const failures=[];
  await run(client({data:payload}),provider,provider,input.code,{origin:'https://sponsorsorter.com',pathname:'/oauth2callback.html'},exchangeMemberOAuth,memberOAuthMessage,s=>status.push(s),s=>successes.push(s),s=>failures.push(s),s=>s);
  assert.equal(successes.length,expected?1:0);assert.equal(failures.length,expected?0:1);assert.ok(!failures.join('').includes('hidden private error'));
 }
});
