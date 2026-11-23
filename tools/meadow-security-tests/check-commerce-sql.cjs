'use strict';
// Execute actual game SQL in memory only; never connects to a hosted DB.
const {PGlite}=require(process.env.MEADOW_PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
const migration=read('supabase/migrations/20261123023556_meadow_commerce_integrity_denials_v1.sql');
function extract(source,startMarker,endMarker){const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);assert(start>=0&&end>start);return source.slice(start,end+endMarker.length);}
const store=extract(read('supabase/migrations/20261112120613_meadow_pack_benefits240.sql'),'CREATE OR REPLACE FUNCTION meadow_private.deliver_store_purchase239(','end $function$\n;');
const reward=extract(read('supabase/migrations/20261107082228_meadow_ad_reward_day226.sql'),'create or replace function public.meadow_market_finish_ad_reward(','end $$;');
const A='10000000-0000-4000-8000-000000000001',B='20000000-0000-4000-8000-000000000002',N='30000000-0000-4000-8000-000000000003',R='40000000-0000-4000-8000-000000000004',TOKEN='a'.repeat(64);
test('Actual commerce migrations: typed owner/product/nonce conflict, refund/replay exclusion, no double reward, stable ACL and atomic drift rejection',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema meadow_private;
   create function auth.jwt() returns jsonb language sql as $$select '{"role":"service_role"}'::jsonb$$;
   set request.jwt.claims='{"role":"service_role"}';
   create table meadow_private.store_products(sku text,product_id text);
   create table meadow_private.commerce_config(id boolean,payments_enabled boolean,production_ready boolean);
   create table public.meadow_market_wallets(user_id uuid primary key,gems bigint default 0,reward_turns bigint default 0,updated_at timestamptz);
   create table meadow_private.store_purchases(token_hash text primary key,user_id uuid,product_id text,receipt_id uuid,settled boolean,revoked_at timestamptz);
   create table meadow_private.ad_rewards(nonce uuid primary key,user_id uuid,created_at timestamptz,expires_at timestamptz,transaction_id text unique,receipt_id uuid);
   create table meadow_private.account_deletions(user_id uuid primary key);
   create table public.meadow_market_economy_receipts(id uuid primary key default gen_random_uuid(),user_id uuid,request_id uuid,kind text,claim_key text,delivery jsonb,unique(user_id,kind,claim_key));
   insert into public.meadow_market_wallets(user_id) values('${A}'),('${B}');
   insert into meadow_private.store_purchases values('${TOKEN}','${A}','mm_pocket_gems','${R}',true,null);
   insert into meadow_private.ad_rewards values('${N}','${A}',now(),now()+interval '1 hour','transaction-original','${R}');`);
  await db.exec(store);await db.exec(reward);
  await db.exec(`revoke all on function meadow_private.deliver_store_purchase239(uuid,text,text,text,boolean),public.meadow_market_finish_ad_reward(uuid,text,text,timestamptz) from public,anon,authenticated;
   grant usage on schema meadow_private to service_role;
   grant execute on function meadow_private.deliver_store_purchase239(uuid,text,text,text,boolean),public.meadow_market_finish_ad_reward(uuid,text,text,timestamptz) to service_role;`);
  const metadata=async()=> (await db.query("select proname,pg_get_functiondef(oid) as body,proowner,prosecdef,proconfig,proacl::text from pg_proc where oid in ('meadow_private.deliver_store_purchase239(uuid,text,text,text,boolean)'::regprocedure,'public.meadow_market_finish_ad_reward(uuid,text,text,timestamptz)'::regprocedure) order by proname")).rows;
  const before=await metadata();await db.exec(migration);const after=await metadata();assert.deepEqual(after.map(({body,...row})=>row),before.map(({body,...row})=>row));
  await db.exec(migration);assert.deepEqual(await metadata(),after);
  const purchase=(user=A,product='mm_pocket_gems')=>db.query('select meadow_private.deliver_store_purchase239($1,$2,$3,null,true) as value',[user,product,TOKEN]);
  assert.equal((await purchase()).rows[0].value.duplicate,true);
  await assert.rejects(()=>purchase(B),e=>e.code==='22023'&&e.detail==='MEADOW_STORE_RECEIPT_OWNER_CONFLICT_V1');
  await assert.rejects(()=>purchase(A,'mm_gem_chest'),e=>e.code==='22023'&&e.detail==='MEADOW_STORE_RECEIPT_PRODUCT_CONFLICT_V1');
  await db.exec('update meadow_private.store_purchases set revoked_at=now()');
  for(const [user,product]of [[A,'mm_pocket_gems'],[B,'mm_gem_chest']])await assert.rejects(()=>purchase(user,product),e=>e.code==='P0001'&&!e.detail);
  const account=(await db.query("select encode(sha256(convert_to('meadow-markets:'||$1,'UTF8')),'hex') as value",[A])).rows[0].value;
  const finish=(nonce=N,transaction='transaction-original',who=account)=>db.query('select public.meadow_market_finish_ad_reward($1,$2,$3,now()) as value',[nonce,who,transaction]);
  assert.equal((await finish()).rows[0].value,true);
  await db.exec('begin');await assert.rejects(()=>finish(N,'transaction-changed'),e=>e.code==='22023'&&JSON.parse(e.detail).actor===A&&JSON.parse(e.detail).code==='MEADOW_AD_NONCE_TRANSACTION_CONFLICT_V1');await db.exec('rollback');
  await assert.rejects(()=>finish(N,'transaction-changed','unverified-other-account'),e=>e.code==='P0001'&&e.message==='Ad account mismatch'&&!e.detail);
  assert.equal((await finish()).rows[0].value,true);assert.equal((await db.query('select gems from public.meadow_market_wallets where user_id=$1',[A])).rows[0].gems,0);
  const fresh='50000000-0000-4000-8000-000000000005';await db.query("insert into meadow_private.ad_rewards values($1,$2,now(),now()+interval '1 hour',null,null)",[fresh,A]);
  assert.equal((await finish(fresh,'transaction-fresh')).rows[0].value,true);assert.equal((await finish(fresh,'transaction-fresh')).rows[0].value,true);
  assert.deepEqual((await db.query('select gems,reward_turns from public.meadow_market_wallets where user_id=$1',[A])).rows[0],{gems:5,reward_turns:1});
  assert.equal((await db.query('select count(*)::int as n from public.meadow_market_economy_receipts')).rows[0].n,1);
  const third='70000000-0000-4000-8000-000000000007',capped='80000000-0000-4000-8000-000000000008',expired='90000000-0000-4000-8000-000000000009';
  for(const nonce of [third,capped])await db.query("insert into meadow_private.ad_rewards values($1,$2,now(),now()+interval '1 hour',null,null)",[nonce,A]);
  assert.equal((await finish(third,'transaction-third')).rows[0].value,true);
  await assert.rejects(()=>finish(capped,'transaction-capped'),e=>e.code==='P0001'&&e.message==='Daily ad reward limit'&&!e.detail);
  await db.query("insert into meadow_private.ad_rewards values($1,$2,now()-interval '2 hours',now()-interval '1 hour',null,null)",[expired,A]);
  await assert.rejects(()=>finish(expired,'transaction-expired'),e=>e.code==='P0001'&&e.message==='Ad reward expired'&&!e.detail);
  assert.deepEqual((await db.query('select gems,reward_turns from public.meadow_market_wallets where user_id=$1',[A])).rows[0],{gems:10,reward_turns:2});
  assert.equal((await db.query('select count(*)::int as n from public.meadow_market_economy_receipts')).rows[0].n,2);
  await assert.rejects(()=>finish('60000000-0000-4000-8000-000000000006'),e=>e.code==='P0001'&&!e.detail);
  await db.exec('set role authenticated');await assert.rejects(()=>purchase(),e=>e.code==='42501');await assert.rejects(()=>finish(),e=>e.code==='42501');await db.exec('reset role');
  // Failure of the second seam must roll the first seam back as well.
  await db.exec(store);await db.exec(reward.replace('Ad nonce reused','Changed future reward rejection'));const driftBefore=await metadata();
  await assert.rejects(()=>db.exec(migration),/Review reward nonce denial seam/);await db.exec('rollback');assert.deepEqual(await metadata(),driftBefore);
 }finally{await db.close();}
});
