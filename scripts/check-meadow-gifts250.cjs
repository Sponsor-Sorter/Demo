const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/gift-codes.js','utf8');
const scope={window:{},AbortController,fetch:()=>{throw Error('Unexpected network')},setTimeout,clearTimeout};
vm.runInNewContext(source,scope);const gifts=scope.window.meadowGifts;
const contract='fairplay-gift-codes-v1',owner1='11111111-1111-4111-8111-111111111111',owner2='22222222-2222-4222-8222-222222222222';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const copy=v=>JSON.parse(JSON.stringify(v));
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return {resolve,reject,promise}};
const tick=()=>new Promise(r=>setImmediate(r));
const receipt=(currency='gems',amount=12)=>({id:id(900),app:'meadow',reward:{kind:'currency',currency,amount},redeemed_at:'2026-11-16T00:00:00Z',expires_at:null,delivery:{currency,amount,receipt_id:id(900),delivery:currency==='gold'?'server_receipt':'credited'}});
const premium=()=>({...receipt(),reward:{kind:'entitlement',entitlement:'premium',duration_seconds:3600},expires_at:'2026-11-16T01:00:00Z',delivery:id(901)});
const success=r=>({ok:true,contract,status:'redeemed',receipt:r||receipt()});
function fixture(){
 let owner=owner1,guest=false,n=0;const calls=[],syncs=[];
 const a={owner:()=>owner,guest:()=>guest,uuid:()=>id(++n),prepare:async()=>{},rpc:async(who,name,params)=>{calls.push({who,name,params:copy(params)});return success()},sync:async(who,r)=>{syncs.push({who,r});return true}};
 const c=gifts.create(a);return {a,c,calls,syncs,owner:v=>owner=v,guest:v=>guest=v};
}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name)}
(async()=>{
 await test('ASCII-only code normalization and length boundaries',()=>{
  assert.equal(gifts.normalize(' abcd-1234 '),'ABCD1234');
  for(const value of ['abcdefg','A'.repeat(41),'A'.repeat(81),'ABCD\t1234','ABCD\n1234','ＡBCD1234','ßabc1234','ABCD_1234',null])assert.equal(gifts.normalize(value),null);
  assert.equal(gifts.normalize('A'.repeat(40)),'A'.repeat(40));assert.equal(gifts.normalize(' '.repeat(40)+'A'.repeat(40)),'A'.repeat(40));
 });
 await test('strict currency and Premium receipt validation',()=>{
  for(const r of [receipt(),receipt('gold',1000000),receipt('reward_turns',10000),premium()])assert(gifts.validReceipt(r));
  for(const mutate of [r=>r.app='littles',r=>r.id='invalid',r=>r.reward.currency='vip_xp',r=>r.reward.amount=0,r=>r.reward.amount=1.5,r=>r.reward.amount=100001,r=>r.delivery.amount=99,r=>r.delivery.receipt_id=id(902),r=>r.delivery.delivery='server_receipt',r=>r.expires_at='2027-01-01']){const r=receipt();mutate(r);assert(!gifts.validReceipt(r));}
  for(const mutate of [r=>r.reward.entitlement='vip',r=>r.reward.duration_seconds=59,r=>r.delivery={grant_id:id(901),entitlement:'premium'},r=>r.delivery='bad',r=>r.expires_at='2026-11-16T02:00:00Z']){const r=premium();mutate(r);assert(!gifts.validReceipt(r));}
 });
 await test('availability uses only the fixed app and honors unavailable/sign-in responses',async()=>{
  const f=fixture();f.a.rpc=async(w,n,p)=>{assert.equal(w,owner1);assert.equal(n,'fairplay_gift_code_status_v1');assert.deepEqual(copy(p),{p_app:'meadow'});return {contract,app:'meadow',supported:true,ready:true}};
  assert.equal((await f.c.availability()).ready,true);
  f.a.rpc=async()=>({contract,app:'meadow',supported:true,ready:false});assert.equal((await f.c.availability()).ready,false);
  f.a.rpc=async()=>({ok:false,contract,error_code:'SIGN_IN_REQUIRED'});assert.equal((await f.c.availability()).error_code,'SIGN_IN_REQUIRED');
  f.a.rpc=async()=>({contract,app:'littles',supported:true,ready:true});assert.equal((await f.c.availability()).error_code,'TEMPORARILY_UNAVAILABLE');
 });
 await test('guest and malformed input never dispatch',async()=>{
  const f=fixture();f.guest(true);assert.equal((await f.c.redeem('ABCD1234')).error_code,'SIGN_IN_REQUIRED');assert.equal((await f.c.availability()).error_code,'SIGN_IN_REQUIRED');f.guest(false);assert.equal((await f.c.redeem('abc')).error_code,'INVALID_CODE');assert.equal(f.calls.length,0);
 });
 await test('one exact app/code/request dispatch, no client reward authority',async()=>{
  const f=fixture(),r=await f.c.redeem('abcd-1234');assert(r.ok&&r.synced);assert.deepEqual(f.calls,[{who:owner1,name:'fairplay_gift_code_redeem_v1',params:{p_app:'meadow',p_code:'ABCD1234',p_request:id(1)}}]);assert.equal(f.syncs.length,1);
 });
 for(const [label,r] of [['gold receipt',receipt('gold',1000)],['reward tickets',receipt('reward_turns',3)],['timed Premium UUID delivery',premium()]])await test('complete consumer flow: '+label,async()=>{
  const f=fixture();f.a.rpc=async()=>success(r);assert((await f.c.redeem('ABCD1234')).synced);assert.equal(f.syncs.length,1);assert.deepEqual(copy(f.syncs[0].r),r);
 });
 await test('duplicate inflight submit coalesces and other code is busy',async()=>{
  const f=fixture(),hold=deferred();f.a.prepare=()=>hold.promise;const one=f.c.redeem('ABCD1234'),two=f.c.redeem('abcd-1234');assert.equal(one,two);assert((await f.c.redeem('EFGH5678')).busy);hold.resolve();await one;assert.equal(f.calls.length,1);
 });
 await test('lost response and temporary failures retain the same UUID',async()=>{
  const f=fixture();let n=0;f.a.rpc=async(w,name,p)=>{f.calls.push(copy(p));if(++n===1)throw Error('Lost response');if(n===2)return {ok:false,contract,error_code:'TEMPORARILY_UNAVAILABLE'};return success()};
  assert.equal((await f.c.redeem('ABCD1234')).error_code,'TEMPORARILY_UNAVAILABLE');assert.equal(f.syncs.length,0);await f.c.redeem('ABCD1234');assert((await f.c.redeem('ABCD1234')).synced);assert.equal(new Set(f.calls.map(p=>p.p_request)).size,1);
 });
 await test('switch before dispatch cancels without a request',async()=>{
  const f=fixture(),hold=deferred();f.a.prepare=()=>hold.promise;const one=f.c.redeem('ABCD1234');f.owner(owner2);hold.resolve();assert((await one).ignored);assert.equal(f.calls.length,0);
 });
 await test('late reply after account switch cannot sync into the new account',async()=>{
  const f=fixture(),hold=deferred();f.a.rpc=()=>hold.promise;const one=f.c.redeem('ABCD1234');await tick();f.owner(owner2);hold.resolve(success());assert((await one).ignored);assert.equal(f.syncs.length,0);f.a.rpc=async(w,n,p)=>{assert.equal(w,owner2);assert.equal(p.p_request,id(2));return success()};assert((await f.c.redeem('ABCD1234')).synced);
 });
 await test('availability ignores late old-account responses',async()=>{
  const f=fixture(),hold=deferred();f.a.rpc=()=>hold.promise;const one=f.c.availability();f.owner(owner2);hold.resolve({contract,app:'meadow',supported:true,ready:true});assert((await one).ignored);
 });
 await test('untrusted/malformed success never reaches reconciliation',async()=>{
  for(const reply of [{...success(),contract:'other'},{...success(),status:'unknown'},success({...receipt(),app:'frontlines'}),{ok:false,contract,error_code:'UNKNOWN'}]){const f=fixture();f.a.rpc=async()=>reply;assert.equal((await f.c.redeem('ABCD1234')).error_code,'TEMPORARILY_UNAVAILABLE');assert.equal(f.syncs.length,0);}
 });
 await test('known non-consuming errors release the completed attempt',async()=>{
  for(const error_code of ['INVALID_CODE','RATE_LIMITED','REQUEST_CONFLICT','ACCOUNT_NOT_READY','GAME_UNAVAILABLE','SIGN_IN_REQUIRED']){const f=fixture();f.a.rpc=async()=>({ok:false,contract,error_code});assert.equal((await f.c.redeem('ABCD1234')).error_code,error_code);f.a.rpc=async(w,n,p)=>{assert.equal(p.p_request,id(2));return success()};assert((await f.c.redeem('ABCD1234')).synced);}
 });
 await test('receipt confirmed but failed sync retries only reconciliation',async()=>{
  const f=fixture();f.a.sync=async()=>false;let r=await f.c.redeem('ABCD1234');assert(r.ok&&!r.synced);assert.equal(f.c.pendingCode(),'ABCD1234');assert(f.c.needsSync('abcd-1234'));f.owner(owner2);assert(!f.c.needsSync('ABCD1234'));f.owner(owner1);f.a.sync=async()=>true;r=await f.c.redeem('ABCD1234');assert(r.synced);assert.equal(f.calls.length,1);assert.equal(f.c.pendingCode(),'');assert(!f.c.needsSync('ABCD1234'));
 });
 await test('already redeemed refreshes the original receipt, not another credit',async()=>{
  const f=fixture();f.a.rpc=async()=>({...success(),status:'already_redeemed'});const r=await f.c.redeem('ABCD1234');assert(r.synced);assert.equal(r.status,'already_redeemed');assert.equal(f.syncs.length,1);
 });
 await test('unresolved attempt memory is bounded',async()=>{
  const f=fixture();f.a.rpc=async()=>{throw Error('Offline')};for(let n=0;n<16;n++)await f.c.redeem('CODE'+String(n).padStart(4,'0'));assert.equal((await f.c.redeem('CODE9999')).error_code,'TEMPORARILY_UNAVAILABLE');
 });
 function transport(){let owner=owner1,ready=true,guest=false;const calls=[],client={auth:{getSession:async()=>({data:{session:{user:{id:owner1,is_anonymous:false},access_token:'normal-captured-token'}}})}};const a={owner:()=>owner,guest:()=>guest,ready:()=>ready,client:()=>client,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({contract,app:'meadow',supported:true,ready:true})}}};return {a,calls,client,owner:v=>owner=v,ready:v=>ready=v,guest:v=>guest=v};}
 await test('transport captures the genuine session token and restricts authority',async()=>{
  const f=transport();await gifts.sessionRPC(f.a,owner1,'fairplay_gift_code_status_v1',{p_app:'meadow'});assert.equal(f.calls[0].options.headers.Authorization,'Bearer normal-captured-token');assert.equal(f.calls[0].options.body,'{"p_app":"meadow"}');
  for(const [name,params] of [['fairplay_gift_code_status_v1',{p_app:'meadow',p_user:owner2}],['fairplay_gift_code_status_v1',{p_app:'frontlines'}],['arbitrary_rpc',{}],['meadow_market_play_service',{p_action:'purchase',p_data:{}}],['fairplay_gift_code_redeem_v1',{p_app:'meadow',p_code:'abcd1234',p_request:id(1)}]])await assert.rejects(()=>gifts.sessionRPC(f.a,owner1,name,params));assert.equal(f.calls.length,1);
 });
 await test('transport rejects account/session changes before dispatch',async()=>{
  const f=transport(),hold=deferred();f.client.auth.getSession=()=>hold.promise;const one=gifts.sessionRPC(f.a,owner1,'fairplay_gift_code_status_v1',{p_app:'meadow'});f.owner(owner2);hold.resolve({data:{session:{user:{id:owner1},access_token:'normal'}}});await assert.rejects(one);assert.equal(f.calls.length,0);
  f.owner(owner1);f.client.auth.getSession=async()=>({data:{session:{user:{id:owner2},access_token:'normal'}}});await assert.rejects(()=>gifts.sessionRPC(f.a,owner1,'fairplay_gift_code_status_v1',{p_app:'meadow'}));assert.equal(f.calls.length,0);
 });
 await test('transport ignores reply if active account changes during read',async()=>{
  const f=transport(),hold=deferred();f.a.fetch=()=>hold.promise;const one=gifts.sessionRPC(f.a,owner1,'fairplay_gift_code_status_v1',{p_app:'meadow'});await tick();f.owner(owner2);hold.resolve({ok:true,status:200,json:async()=>({contract,app:'meadow'})});await assert.rejects(one);
 });
 await test('HTTP failure is uncertain; expired auth gives sign-in guidance',async()=>{
  const f=transport();f.a.fetch=async()=>({ok:false,status:503});await assert.rejects(()=>gifts.sessionRPC(f.a,owner1,'fairplay_gift_code_status_v1',{p_app:'meadow'}));f.a.fetch=async()=>({ok:false,status:401});assert.equal((await gifts.sessionRPC(f.a,owner1,'fairplay_gift_code_status_v1',{p_app:'meadow'})).error_code,'SIGN_IN_REQUIRED');
 });
 function farm(){const f=transport(),order=[],state={owner:owner1,pending:false,busy:false,running:false,conflict:false,stopped:false},wallet={gems:12,reward_turns:2,premium:false},proof={wallet:copy(wallet),premium_verified:true,receipt_summary:{version:237,pending:false}},command={status:()=>state,flush:async()=>order.push('flush'),refreshReceipts:async()=>order.push('farm-receipts')},club={refresh:async()=>order.push('club'),refreshPremium:async()=>order.push('premium'),wallet:()=>wallet};f.a.command=()=>command;f.a.club=()=>club;f.a.fetch=async()=>{order.push('proof');return {ok:true,status:200,json:async()=>proof}};return {...f,order,state,wallet,proof,command,club,adapter:gifts.farmAdapter(f.a)};}
 await test('farm reconciliation precedes trusted own-account success',async()=>{
  const f=farm();await f.adapter.prepare(owner1);assert(await f.adapter.sync(owner1,receipt('gold')));assert.deepEqual(f.order,['flush','farm-receipts','club','premium','proof']);
 });
 await test('swallowed refresh failure cannot masquerade as reward delivery',async()=>{
  for(const mutate of [f=>f.proof.wallet.gems++,f=>f.proof.wallet.reward_turns++,f=>f.proof.wallet.premium=true,f=>f.proof.premium_verified=false,f=>f.proof.receipt_summary.pending=true,f=>f.proof.receipt_summary.version=1]){const f=farm();mutate(f);assert.equal(await f.adapter.sync(owner1),false);}
 });
 await test('farm conflicts/pending actions and switched owners prevent redemption',async()=>{
  for(const mutate of [f=>f.state.conflict=true,f=>f.state.pending=true,f=>f.state.running=true,f=>f.state.owner=owner2,f=>f.state.stopped=true,f=>f.ready(false)]){const f=farm();mutate(f);await assert.rejects(()=>f.adapter.prepare(owner1));}
  const f=farm();f.command.refreshReceipts=async()=>f.owner(owner2);await assert.rejects(()=>f.adapter.sync(owner1));assert.equal(f.order.length,0);
 });
 await test('switch while refreshing the club cannot dispatch final proof or report success',async()=>{
  const f=farm();f.club.refresh=async()=>f.owner(owner2);await assert.rejects(()=>f.adapter.sync(owner1));assert.deepEqual(f.order,['farm-receipts']);
 });
 await test('private helper shape, ACL, caps and immutable receipt source guards',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261116005822_meadow_gift_code_adapter250.sql','utf8');
  assert.match(sql,/returns boolean language sql stable security invoker set search_path=''/);assert.match(sql,/returns jsonb language plpgsql volatile security invoker set search_path=''/);
  for(const signature of ['meadow_eligible_v1(uuid,text)','meadow_currency_v1(uuid,text,bigint,uuid)']){assert(sql.includes('alter function fairplay_gifts_private.'+signature+' owner to postgres'));assert(sql.includes('revoke all on function fairplay_gifts_private.'+signature+' from public,anon,authenticated,service_role'));}
  assert.match(sql,/and not exists\(select 1 from public.fairplay_admin_runtime/);assert.match(sql,/and r\.maintenance and not exists/);assert.match(sql,/a\.admitted_at<r\.updated_at/);
  assert.match(sql,/when 'gems' then 100000 when 'gold' then 1000000 when 'reward_turns' then 10000/);assert.match(sql,/for update/);assert.match(sql,/2147483647-p_amount/);assert.match(sql,/coalesce\(gold,0\)\+pending_gold\+p_amount>1000000000000/);assert.match(sql,/prior\.delivery is distinct from payload/);
  assert(!/set_config|set role|http\.|net\.|update public\.meadow_market_saves|set vip_xp|set premium|insert into .*support_grants/i.test(sql));
  assert(sql.includes("values(p_redemption,p_user,p_redemption,'gift_code','gift-code-v1:'"));
  // This is a source/contract guard, not a hosted SQL atomicity claim.
 });
 await test('runtime integration, ephemeral privacy and unchanged gameplay bundle',()=>{
  const game=fs.readFileSync('meadow-and-market/game.js','utf8'),html=fs.readFileSync('meadow-and-market/index.html','utf8');assert(game.includes('id="gift-code-settings"'));assert(game.includes("$('#gift-code-settings').onclick=()=>window.meadowGifts.open()"));assert(game.includes('window.meadowGifts?.attach(window.meadowGifts.farmAdapter('));assert(html.includes('gift-codes.css?v=250'));assert(html.indexOf('gift-codes.js?v=250')<html.indexOf(html.match(/game\.js\?v=\d+/)[0]));
  assert(!/localStorage|sessionStorage|console\.|location\.|URLSearchParams|sendBeacon/.test(source),'Raw code has no storage, URL or diagnostic path');assert(!/\b(?:coins|gems|vip_xp)\s*\+?=(?!=)/.test(source),'Consumer cannot mint resources');
 });
 console.log(`Meadow gifts250: ${passed}/${passed} source/VM checks passed. No live code, reward or hosted DDL executed.`);
})().catch(e=>{console.error(e);process.exitCode=1});
