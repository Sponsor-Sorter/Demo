// Offline operator rehearsal only. No network connection or production writes.
// Run Node with --experimental-transform-types. Private exports contain no passwords.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const [schemaFile,dataFile,moduleDir,targetDir,reportFile]=process.argv.slice(2);
if(!reportFile)throw Error('Pass private schema/data exports, PGlite module directory, a NEW database directory, and a report path.');
if(fs.existsSync(targetDir))throw Error('The rehearsal database directory must be new; existing data is never replaced.');
const schema=JSON.parse(fs.readFileSync(schemaFile,'utf8')),source=JSON.parse(fs.readFileSync(dataFile,'utf8'));
const {PGlite}=require(moduleDir),{pgcrypto}=require(path.join(moduleDir,'dist/contrib/pgcrypto.cjs')),{uuid_ossp}=require(path.join(moduleDir,'dist/contrib/uuid_ossp.cjs'));
const db=new PGlite({dataDir:targetDir,extensions:{pgcrypto,uuid_ossp}});let stage='initialize';
const count=async table=>Number((await db.query('select count(*) n from '+table)).rows[0].n);
const read=async()=>{const a=await db.query('select save_protocol,revision,save_data from public.meadow_market_saves where user_id=$1',[source.user_id]);return a.rows[0]};
const role=async(name,claims)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);await db.exec('set role '+name)};
const operatorCount=async table=>{await db.exec('reset role');const n=await count(table);await role('service_role',{role:'service_role'});return n};
async function main(){
 await db.exec("create schema auth;create schema meadow_private;create schema extensions;create extension pgcrypto with schema extensions;create extension \"uuid-ossp\" with schema extensions;set check_function_bodies=off;create table auth.users(id uuid primary key,aud text,role text,is_anonymous boolean);");
 for(const r of schema.roles)if(r.name!=='postgres')await db.exec('create role '+JSON.stringify(r.name)+' nologin '+(r.bypassrls?'bypassrls':''));
 const extraRoles=new Set();for(const key of ['schema_acl','table_acl','function_acl'])for(const ddl of schema[key]||[]){const m=ddl.match(/ to ([a-z_][a-z_0-9]*)(?: with grant option)?;$/i);if(m&&m[1]!=='public'&&!schema.roles.some(r=>r.name===m[1]))extraRoles.add(m[1]);}
 for(const name of extraRoles)if(!(await db.query('select 1 from pg_roles where rolname=$1',[name])).rows.length)await db.exec('create role '+JSON.stringify(name)+' nologin');
 for(const ddl of schema.tables)await db.exec(ddl.ddl);
 for(const ddl of schema.functions)await db.exec(ddl);
 stage='restore archived state and immutable ledgers';
 const archive=source.tables['meadow_private.farm_recovery_backups'].at(-1),bundle=archive.bundle;
 assert.equal(bundle.farm.revision,source.tables['public.meadow_market_saves'][0].revision,'A newer live farm requires explicit reconciliation, never a silent rollback');
 for(const [key,table]of Object.entries({economy_receipts:'public.meadow_market_economy_receipts',reward_deliveries:'meadow_private.farm_reward_deliveries',command_receipts:'meadow_private.farm_command_receipts',store_purchases:'meadow_private.store_purchases'}))assert.equal(source.tables[table].length,bundle.ledger[key],'Receipt watermark mismatch: '+key);
 const tables=structuredClone(source.tables);
 for(const [table,value]of Object.entries({'public.meadow_market_saves':bundle.farm,'public.meadow_market_wallets':bundle.wallet,'public.meadow_market_collection_wallets':bundle.collection_wallet,'meadow_private.farm_origins':bundle.origin,'meadow_private.farm_command_accounts':bundle.command_account}))tables[table]=value?[value]:[];
 tables['public.meadow_market_collectibles']=bundle.collectibles;
 await db.query('insert into auth.users select * from jsonb_populate_record(null::auth.users,$1::jsonb)',[JSON.stringify(source.identity)]);
 for(const [table,rows]of Object.entries(tables)){if(!/^(public\.meadow_market_[a-z_]+|meadow_private\.[a-z_]+)$/.test(table))throw Error('Unexpected table');if(rows.length)await db.query('insert into '+table+' select * from jsonb_populate_recordset(null::'+table+',$1::jsonb)',[JSON.stringify(rows)]);}
 for(const ddl of schema.constraints)await db.exec(ddl);
 for(const ddl of schema.indexes||[])await db.exec(ddl);
 for(const ddl of schema.triggers||[])await db.exec(ddl);
 for(const ddl of schema.policies||[])await db.exec(ddl);
 for(const ddl of schema.rls_policies||[])await db.exec(ddl);
 await db.exec('revoke all on all tables in schema public,meadow_private from public,anon,authenticated,service_role;revoke all on all functions in schema public,meadow_private,auth from public,anon,authenticated,service_role;');
 for(const key of ['schema_acl','table_acl','function_acl'])for(const ddl of schema[key]||[])await db.exec(ddl);
 const serials=(await db.query("select n.nspname,c.relname,a.attname,pg_get_serial_sequence(format('%I.%I',n.nspname,c.relname),a.attname) seq from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 where a.attidentity<>'' and n.nspname in('public','meadow_private')")).rows;
 for(const s of serials){const m=(await db.query('select max('+JSON.stringify(s.attname)+') value from '+JSON.stringify(s.nspname)+'.'+JSON.stringify(s.relname))).rows[0].value;if(m!==null)await db.query('select setval($1::regclass,$2,true)',[s.seq,m]);}
 const checks=[];for(const [table,rows]of Object.entries(tables)){assert.equal(await count(table),rows.length,table);checks.push({table,rows:rows.length});}
 const checksum=(await db.query("select encode(sha256(convert_to(bundle::text,'UTF8')),'hex') hash from meadow_private.farm_recovery_backups")).rows[0].hash;assert.equal(checksum,archive.bundle_hash);
 const initial=await read();assert.equal(initial.save_protocol,4);assert.deepEqual(initial.save_data,bundle.farm.save_data);
 const wallet=(await db.query('select to_jsonb(w) row from public.meadow_market_wallets w')).rows[0].row;assert.deepEqual(wallet,bundle.wallet);
 stage='restored ownership and protected write checks';
 await role('authenticated',{sub:source.user_id,role:'authenticated'});assert.equal(await count('public.meadow_market_wallets'),1);
 await role('authenticated',{sub:'00000000-0000-4000-8000-000000000220',role:'authenticated'});assert.equal(await count('public.meadow_market_wallets'),0);
 await role('authenticated',{sub:source.user_id,role:'authenticated'});
 let rejected=false;try{await db.query('select public.meadow_market_commit_economy_save($1,$2::jsonb,$3::uuid)',[initial.revision,JSON.stringify({...initial.save_data,coins:999999999}),'00000000-0000-4000-8000-000000000221']);}catch(e){assert.equal(e.code,'40001');rejected=true}assert(rejected);
 await role('service_role',{role:'service_role'});
 stage='actual handler replay and new action';
 const {farmHandler}=await import(pathToFileURL(path.resolve('supabase/functions/meadow-market-farm-actions/handler.ts')).href);
 const services={identity:async()=>({id:source.user_id}),rpc:async(name,args)=>{
  const keys=name==='meadow_market_read_farm_command'?['p_user','p_request_id','p_body']:name==='meadow_market_commit_farm_command'?['p_user','p_request_id','p_body','p_save_data','p_summary']:null;if(!keys)throw Error('Unexpected RPC');
  return(await db.query('select public.'+name+'('+keys.map((k,i)=>'$'+(i+1)+(k==='p_user'||k==='p_request_id'?'::uuid':'::jsonb')).join(',')+') result',keys.map(k=>typeof args[k]==='object'?JSON.stringify(args[k]):args[k]))).rows[0].result;
 }};
 const handler=farmHandler(services),invoke=async body=>{const reply=await handler(new Request('https://local.invalid/farm-actions',{method:'POST',headers:{authorization:'Bearer offline-rehearsal',origin:'https://sponsorsorter.com','content-type':'application/json'},body:JSON.stringify(body)}));const data=await reply.json();assert.equal(reply.status,200,JSON.stringify(data));return data};
 let old=null;
 for(const r of source.tables['meadow_private.farm_command_receipts'].toSorted((a,b)=>b.revision-a.revision)){
  const commands=r.summary.results?.map(v=>({type:v.type,...(v.map?{map:v.map}:{})}));if(!commands?.length||commands.some(v=>!['workers.tick','workers.return','shop.check'].includes(v.type)))continue;
  const body={expected_revision:r.revision-1,commands};const hash=(await db.query("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') hash",[JSON.stringify(body)])).rows[0].hash;if(hash===r.body_hash){old={request_id:r.request_id,...body};break;}
 }assert(old,'An original accepted request is required for the replay check');
 const replay=await invoke(old);assert.equal(replay.replayed,true);assert.equal(replay.revision,initial.revision);assert.deepEqual((await read()).save_data,initial.save_data);
 const active=initial.save_data.active,well=initial.save_data.farms[active].objects.find(o=>o.type==='well');assert(well);
 const body={request_id:'00000000-0000-4000-8000-000000000222',expected_revision:initial.revision,commands:[{type:'well.settings',map:active,target:well.id,data:{helpers:{jade:true,rhys:true,jay:true},crop:well.helperCrop||'carrot',mode:'previous',cap:0}}]};
 const before=await operatorCount('meadow_private.farm_command_receipts'),deliveries=await operatorCount('meadow_private.farm_reward_deliveries');const accepted=await invoke(body);assert.equal(accepted.revision,initial.revision+1);const again=await invoke(body);assert.equal(again.replayed,true);assert.equal(await operatorCount('meadow_private.farm_command_receipts'),before+1);assert.equal(await operatorCount('meadow_private.farm_reward_deliveries'),deliveries);
 assert.deepEqual((await db.query('select to_jsonb(w) row from public.meadow_market_wallets w')).rows[0].row,wallet);assert.equal((await read()).save_data.coins,initial.save_data.coins);
 const report={kind:'Isolated logical farm restore; not a Supabase platform/Auth restore',sourceDatabase:source.database_version,restoredDatabase:(await db.query('select version() version')).rows[0].version,sourceRevision:initial.revision,protocol:initial.save_protocol,tables:checks,archiveHashVerified:true,rowsRestored:checks.reduce((n,t)=>n+t.rows,0),maps:Object.keys(initial.save_data.farms).length,objects:Object.values(initial.save_data.farms).reduce((n,f)=>n+f.objects.length,0),walletPreserved:true,outsiderDenied:true,rawSnapshotDenied:true,originalCommandReplayed:true,newCommandAcceptedOnce:true,oldRewardsNotRedelivered:true,productionWrites:0,completedAt:new Date().toISOString()};
 fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,tables:report.tables.length}));
}
main().catch(e=>{console.error('Recovery rehearsal failed at '+stage+': '+e.message);process.exitCode=1}).finally(()=>db.close());
