'use strict';
// Disposable in-memory PostgreSQL only. No connection strings or hosted calls.
const {PGlite}=require(process.env.MEADOW_PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261123015856_meadow_security_request_denial_v1.sql'),'utf8');
const source=fs.readFileSync(path.join(root,'supabase/migrations/20261112120613_meadow_pack_benefits240.sql'),'utf8').replace(/\r\n/g,'\n');
const start=source.indexOf('CREATE OR REPLACE FUNCTION meadow_private.read_farm_command('),end=source.indexOf('end $function$\n;',start);
assert(start>=0&&end>start,'Latest game-owned function must be present');
const original=source.slice(start,end+'end $function$\n;'.length);
const A='10000000-0000-4000-8000-000000000001',ID='10000000-0000-4000-8000-000000000003';
const body={expected_revision:5,commands:[{type:'workers.tick'}]};
test('Actual latest receipt function and migration: typed conflict, unchanged replay/revision/ACL, rollback and drift guard',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema auth;create schema meadow_private;
   create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('fixture.claims',true),'')::jsonb,'{"role":"service_role"}'::jsonb)$$;
   create table public.meadow_market_profiles(user_id uuid primary key,friend_code text,display_name text);
   create table public.meadow_market_saves(user_id uuid primary key,revision bigint,save_data jsonb,save_protocol integer);
   create table meadow_private.farm_command_accounts(user_id uuid primary key);
   create table meadow_private.account_deletions(user_id uuid primary key);
   create table meadow_private.farm_command_receipts(user_id uuid,request_id uuid,body_hash text,revision bigint,summary jsonb,primary key(user_id,request_id));
   insert into public.meadow_market_profiles values('${A}','FIXTURE','Private fixture');
   insert into public.meadow_market_saves values('${A}',6,'{"coins":250}',4);
   insert into meadow_private.farm_command_accounts values('${A}');`);
  await db.exec(original);
  await db.exec(`revoke all on function meadow_private.read_farm_command(uuid,uuid,jsonb) from public,anon,authenticated;
   grant usage on schema meadow_private to service_role;
   grant execute on function meadow_private.read_farm_command(uuid,uuid,jsonb) to service_role;`);
  const definition=async()=> (await db.query("select pg_get_functiondef('meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure) as body,prosecdef,proconfig,proacl::text,proowner from pg_proc where oid='meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure")).rows[0];
  const before=await definition();await db.exec(migration);const after=await definition();
  assert.deepEqual({...after,body:before.body},{...before});
  assert.equal(after.body,before.body.replace("using errcode='22023';end if;\n  return jsonb_build_object('ok',true,'replayed'","using errcode='22023', detail='MEADOW_COMMAND_RECEIPT_CONFLICT_V1';end if;\n  return jsonb_build_object('ok',true,'replayed'"));
  await db.exec(migration);assert.deepEqual(await definition(),after,'Reapplication must be inert');
  await db.query('insert into meadow_private.farm_command_receipts values($1,$2,encode(sha256(convert_to($3::jsonb::text,\'UTF8\')),\'hex\'),6,\'{}\')',[A,ID,JSON.stringify(body)]);
  const call=async(id=ID,value=body)=>(await db.query('select meadow_private.read_farm_command($1,$2,$3::jsonb) as result',[A,id,JSON.stringify(value)])).rows[0].result;
  assert.equal((await call()).replayed,true);
  const stale=await call('20000000-0000-4000-8000-000000000003');assert.equal(stale.conflict,true);assert.equal(stale.revision,6);
  await db.exec('begin');
  await assert.rejects(()=>call(ID,{...body,commands:[{type:'wallet.credit',data:{gold:999999}}]}),e=>e.code==='22023'&&e.detail==='MEADOW_COMMAND_RECEIPT_CONFLICT_V1');
  await db.exec('rollback');
  assert.equal((await call()).replayed,true,'Rejected transaction leaves the original receipt intact');
  assert.deepEqual((await db.query('select revision,save_data from public.meadow_market_saves')).rows,[{revision:6,save_data:{coins:250}}]);
  assert.equal((await db.query('select count(*)::int as n from meadow_private.farm_command_receipts')).rows[0].n,1);
  await assert.rejects(()=>call(ID,{...body,commands:[]}),e=>e.code==='22023'&&!e.detail);
  await db.exec("set fixture.claims='{"+'"role":"authenticated"'+"}'");
  await assert.rejects(()=>call(),e=>e.code==='42501'&&!e.detail);
  await db.exec("set fixture.claims='{"+'"role":"service_role"'+"}'");
  await db.exec('set role authenticated');await assert.rejects(()=>call(),e=>e.code==='42501');await db.exec('reset role');
  // Unknown future function must fail closed, not patch a different error branch.
  await db.exec(original.replace('Command receipt reused for different actions','Changed future receipt rejection'));
  await assert.rejects(()=>db.exec(migration),/denial seam changed/);await db.exec('rollback');
 }finally{await db.close();}
});
