// Actual migration/function execution in an isolated Postgres engine. No accounts,
// cloud credentials or network; only auth/control boundaries and the clock stubbed.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('Christmas gem bundles are scoped, exact, atomic, durable and idempotent',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema meadow_private;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
   create function meadow_private.control_guard(text,uuid) returns void language plpgsql as $$begin if $2 is null then raise exception 'no actor';end if;end$$;
   create table public.meadow_market_profiles(user_id uuid primary key);
   create table public.meadow_market_wallets(user_id uuid primary key,gems int not null default 0,premium boolean default false,reward_turns int default 0,ads_enabled boolean default false,updated_at timestamptz default now(),vip_xp bigint not null default 0);
   create table public.meadow_market_collection_catalog(id text primary key,definition jsonb not null);
   create table public.meadow_market_collectibles(user_id uuid,item_id text references public.meadow_market_collection_catalog,source text,primary key(user_id,item_id));
   create table public.meadow_market_economy_receipts(id uuid default gen_random_uuid(),user_id uuid,request_id uuid,kind text,claim_key text,delivery jsonb,created_at timestamptz default now(),unique(user_id,request_id),unique(user_id,claim_key));
   insert into public.meadow_market_profiles values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
   insert into public.meadow_market_wallets(user_id,gems)select user_id,100 from public.meadow_market_profiles;
   select set_config('test.actor','00000000-0000-4000-8000-000000000001',false),set_config('test.now','2026-11-30T23:59:59Z',false);`);
  const migration=fs.readFileSync(require('node:path').resolve(__dirname,'../../supabase/migrations/20261128124632_meadow_christmas267.sql'),'utf8');
  assert.equal((migration.match(/clock_timestamp\(\)/g)||[]).length,1);
  await db.exec(migration.replace('clock_timestamp()',"current_setting('test.now')::timestamptz"));
  const buy=(id='collection_xmas_globe',request='10000000-0000-4000-8000-000000000001')=>db.query('select public.meadow_market_christmas_purchase267($1,$2) as result',[id,request]);
  await assert.rejects(buy(),/available 1–31 December/);await db.exec("select set_config('test.now','2026-12-01T00:00:00Z',false)");
  await assert.rejects(buy('collection_xmas_tree'),/Choose/);await assert.rejects(buy('__proto__'),/Choose/);
  const first=(await buy()).rows[0].result;assert.equal(first.spent,35);
  const wallet=()=>db.query('select gems,vip_xp from public.meadow_market_wallets where user_id=auth.uid()');
  assert.deepEqual((await wallet()).rows[0],{gems:65,vip_xp:35});
  assert.equal((await buy()).rows[0].result.replayed,true);assert.deepEqual((await wallet()).rows[0],{gems:65,vip_xp:35});
  await assert.rejects(buy('collection_xmas_pavilion'),/belongs to another/);
  await assert.rejects(buy('collection_xmas_globe','10000000-0000-4000-8000-000000000002'),/already own/);
  const r=(await db.query('select delivery from public.meadow_market_economy_receipts')).rows[0].delivery;
  assert.deepEqual(r,{gold:400,items:{wheat:8,apple:4},collectible:'collection_xmas_globe',gems_spent:35});
  await buy('collection_xmas_pavilion','10000000-0000-4000-8000-000000000003');assert.deepEqual((await wallet()).rows[0],{gems:0,vip_xp:100});
  await db.exec("select set_config('test.now','2027-01-01T00:00:00Z',false)");
  assert.equal((await buy()).rows[0].result.replayed,true,'An accepted purchase can be safely retried after closing');
  await db.exec("select set_config('test.actor','00000000-0000-4000-8000-000000000002',false)");await assert.rejects(buy(),/available/);
  await db.exec("select set_config('test.now','2026-12-31T23:59:59Z',false);update public.meadow_market_wallets set gems=34 where user_id=auth.uid()");await assert.rejects(buy(),/NOT_ENOUGH_GEMS/);
  assert.equal((await db.query('select count(*)::int n from public.meadow_market_collectibles where user_id=auth.uid()')).rows[0].n,0);assert.equal((await wallet()).rows[0].gems,34);
  await db.exec("select set_config('test.actor','',false)");await assert.rejects(buy(),/Connect/);
  const security=(await db.query("select n.nspname,p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like '%christmas%267' order by n.nspname")).rows;
  assert.deepEqual(security.map(r=>[r.nspname,r.prosecdef]),[['meadow_private',true],['public',false]]);
  assert.equal((await db.query("select count(*)::int n from public.meadow_market_collection_catalog where coalesce((definition->>'purchaseOnly')::boolean,false)=false")).rows[0].n,0,'Seasonal offers cannot leak into random/daily collection pools');
 }finally{await db.close();}
});
