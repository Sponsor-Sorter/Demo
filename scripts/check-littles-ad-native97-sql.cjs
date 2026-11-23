'use strict';
// Actual PostgreSQL/WASM, in memory. Local Auth adapters only; never connects to Supabase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const runtime=process.env.PGLITE_MODULE_ROOT||'D:/Chat Gpt/workspaces/frontlines-build/frontlines-gift106-20261116/node_modules/@electric-sql/pglite';
const A='b1000000-0000-4000-8000-000000000001',B='b1000000-0000-4000-8000-000000000002',client='b2000000-0000-4000-8000-000000000001',otherClient='b2000000-0000-4000-8000-000000000002';
const unit='ca-app-pub-6946008351204848/6193791997',results=[];let db;
const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
async function role(name,run){await db.exec('set role '+name);try{return await run();}finally{await db.exec('reset role');}}
async function call(action,data){return role('authenticated',async()=>(await one('select public.meadow_littles_ad_rounds($1,$2::jsonb) as value',[action,JSON.stringify({client,...data})])).value);}
async function denied(run,code='42501'){let error;try{await run();}catch(e){error=e;}assert(error,'Expected rejection');assert.equal(error.code,code);}
async function test(name,run){await run();results.push({name,pass:true});console.log('PASS '+name);}
async function prepared(version=18){return call('prepare',{nativeVersion:version,game:'memory',requestId:crypto.randomUUID()});}
async function record(item,transaction='tx_'+crypto.randomUUID().replaceAll('-','')){await role('service_role',()=>db.query('select public.meadow_littles_record_ad_round($1::uuid,$2,$3,clock_timestamp())',[item.challenge,transaction,unit]));return transaction;}
(async()=>{
 const pkg=JSON.parse(fs.readFileSync(runtime+'/package.json'));assert.equal(pkg.version,'0.5.16');
 const {PGlite}=await import(pathToFileURL(runtime+'/dist/index.js').href);db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create schema fixture;create schema meadow_littles_private;
 create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');
 create table fixture.context(actor uuid,parent_ready boolean,plus boolean,valid boolean);insert into fixture.context values('${A}',true,false,true);
 create function meadow_littles_private.require_actor() returns uuid language plpgsql security definer set search_path='' as $$declare a uuid;begin select actor into a from fixture.context where valid;if a is null or not exists(select 1 from auth.users where id=a) then raise exception using errcode='42501',message='FIXTURE_AUTH_DENIED';end if;return a;end$$;
 create function meadow_littles_private.play_status() returns jsonb language sql as $$select jsonb_build_object('parent_ready',parent_ready,'ads_enabled',true) from fixture.context$$;
 create function public.meadow_littles_plus_projection(uuid) returns jsonb language sql as $$select jsonb_build_object('effective_verified',true,'effective_plus',plus) from fixture.context$$;
 grant usage on schema meadow_littles_private to authenticated,service_role;`);
 const base=fs.readFileSync(path.join(root,'supabase/migrations/20261122130357_littles_rewarded_rounds91.sql'),'utf8');
 const candidate=fs.readFileSync(path.join(root,'supabase/migrations/20261123113000_littles_rewarded_native97.sql'),'utf8');
 await db.exec(base);await db.exec(candidate);
 await test('actual migration remains default-off with no request or credit',async()=>{assert.equal((await call('status',{nativeVersion:18})).enabled,false);assert.equal((await one('select count(*)::int as n from meadow_littles_private.ad_round_requests')).n,0);});
 await db.exec('update meadow_littles_private.ad_round_config set enabled=true,serving_ready=true,format_reviewed=true,max_prepares_per_hour=30');
 await test('public status and prepare deny missing malformed and old client versions',async()=>{
  for(const version of [undefined,null,0,14,15,16,17,'18',18.5,-1,999999999]){
   const data=version===undefined?{}:{nativeVersion:version};const status=await call('status',data);assert.equal(status.enabled,false);assert.equal(status.requiredNativeVersion,18);
   await denied(()=>call('prepare',{...data,game:'memory',requestId:crypto.randomUUID()}));
  }
  assert.equal((await one('select count(*)::int as n from meadow_littles_private.ad_round_requests')).n,0);
  assert.equal((await call('status',{nativeVersion:18})).enabled,true);assert.equal((await call('status',{nativeVersion:19})).enabled,true);
 });
 await test('private diagnostics admit17 only for the bounded private cohort',async()=>{
  await db.query('update meadow_littles_private.ad_round_config set enabled=false,serving_ready=false,private_users=array[$1::uuid],private_until=now()+interval \'10 minutes\'',[A]);
  assert.equal((await call('status',{nativeVersion:17})).enabled,true);assert.equal((await call('status',{nativeVersion:16})).enabled,false);
  await db.query('update fixture.context set actor=$1::uuid',[B]);assert.equal((await call('status',{nativeVersion:17})).enabled,false);
  await db.query('update fixture.context set actor=$1::uuid',[A]);await db.exec("update meadow_littles_private.ad_round_config set private_until=now()-interval '1 second'");assert.equal((await call('status',{nativeVersion:17})).enabled,false);
  await db.exec("update meadow_littles_private.ad_round_config set enabled=true,serving_ready=true,private_users='{}',private_until=null");
 });
 let earned,tx;
 await test('native18 completion needs service-only verification and returns amount1',async()=>{
  earned=await prepared();assert.equal((await call('claim',{game:'memory',challenge:earned.challenge,nativeVersion:18})).status,'pending');
  await denied(()=>role('authenticated',()=>db.query('select public.meadow_littles_record_ad_round($1::uuid,$2,$3,clock_timestamp())',[earned.challenge,'not-signed-user-call',unit])));
  tx=await record(earned);const receipt=await call('claim',{game:'memory',challenge:earned.challenge,nativeVersion:18});assert.equal(receipt.status,'verified');assert.equal(receipt.amount,1);assert.equal(receipt.transaction,tx);
 });
 await test('previously earned signed claims remain redeemable by old clients after gates and Plus change',async()=>{
  await db.exec('update meadow_littles_private.ad_round_config set enabled=false,serving_ready=false;update fixture.context set plus=true');
  assert.equal((await call('status',{nativeVersion:16})).enabled,false);
  for(const data of [{},{nativeVersion:16},{nativeVersion:17}]){const receipt=await call('claim',{...data,game:'memory',challenge:earned.challenge});assert.equal(receipt.amount,1);assert.equal(receipt.transaction,tx);}
  assert.equal((await one('select count(*)::int as n from meadow_littles_private.ad_round_requests where claimed_at is not null')).n,1);
  await db.exec('update meadow_littles_private.ad_round_config set enabled=true,serving_ready=true;update fixture.context set plus=false');
 });
 await test('claim is actor client game and challenge bound',async()=>{
  for(const patch of [{client:otherClient},{game:'sorting'},{challenge:crypto.randomUUID()}])await denied(()=>call('claim',{game:'memory',challenge:earned.challenge,...patch}));
  await db.query('update fixture.context set actor=$1::uuid',[B]);await denied(()=>call('claim',{game:'memory',challenge:earned.challenge}));await db.query('update fixture.context set actor=$1::uuid',[A]);
 });
 await test('missing or expired local Auth adapter cannot read status or prepare',async()=>{
  await db.exec('update fixture.context set valid=false');await denied(()=>call('status',{nativeVersion:18}));await denied(()=>prepared());await db.exec('update fixture.context set valid=true');
  await db.exec('update fixture.context set actor=null');await denied(()=>call('status',{nativeVersion:18}));await db.query('update fixture.context set actor=$1::uuid',[A]);
 });
 await test('no signed completion means no claim after native unearned close and failed local removal across reopen',async()=>{
  const {create,KEY}=require('../meadow-market-littles/rewarded-round-core.js'),files=new Map();let blocked=false;
  const options={storage:{getItem:k=>files.get(k)||null,setItem:(k,v)=>{if(blocked)throw Error('synthetic storage failure');files.set(k,v);}},context:()=>({actor:A,plus:false,parentReady:true,canRequestAds:true,remainingBaseRounds:()=>0}),policy:()=>({enabled:true,contract:'littles-ad-round-v1',formatReviewed:true,requiredCloseMs:5000,eligibilityEvidence:'https://example.invalid/offline-only',unit}),prepare:data=>call('prepare',{...data,nativeVersion:18}),show:async()=>{blocked=true;return{closed:true,earned:false};},settle:data=>call('claim',{...data,nativeVersion:18}),verifyGrant:async receipt=>receipt.verified===true};
  assert.equal((await create(options).watch('memory')).status,'storage_unavailable');blocked=false;
  const reopened=create(options);assert.equal((await reopened.recover('memory')).status,'pending');assert.equal(reopened.remaining('memory'),0);assert.equal(JSON.parse(files.get(KEY)).grants.length,0);
 });
 await test('late genuine service completion survives native outcome loss and stays exact-once across reopen',async()=>{
  const item=await prepared();const transaction=await record(item);const first=await call('claim',{game:'memory',challenge:item.challenge});const again=await call('claim',{game:'memory',challenge:item.challenge});assert.equal(first.amount,1);assert.equal(again.transaction,transaction);assert.equal(first.expiresAt,again.expiresAt);
 });
 await test('expired unsigned challenge never becomes a verified credit',async()=>{
  const item=await prepared();await db.query("update meadow_littles_private.ad_round_requests set expires_at=now()-interval '25 hours' where id=$1::uuid",[item.challenge]);assert.equal((await call('claim',{game:'memory',challenge:item.challenge})).status,'expired');
 });
 await test('authenticated clients cannot bypass the RPC or service-only receipt boundary',async()=>{
  await denied(()=>role('authenticated',()=>db.query('select * from meadow_littles_private.ad_round_requests')));
  await denied(()=>role('anon',()=>db.query('select public.meadow_littles_ad_rounds($1,$2::jsonb)',['status',JSON.stringify({client,nativeVersion:18})])));
 });
 console.log(JSON.stringify({runtime:'PGlite0.5.16 actual PostgreSQL in-memory',tests:results.length,pass:results.length,fail:0,realNetwork:0,phoneIo:0,productionWrites:0,auth:'explicit isolated local adapter',signedWebhook:'service boundary only; ECDSA is tested separately',results}));
 await db.close();
})().catch(async error=>{console.error(error);await db?.close();process.exitCode=1;});
