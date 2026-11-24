// Executes the pinned deployed PL/pgSQL in ephemeral PostgreSQL/WASM memory.
// No Supabase client, credentials, network, real account, Docker or file DB.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'../../..');
const evidence=JSON.parse(fs.readFileSync(path.join(root,'docs/releases/bug-smash-weekly96-live-source.json')));
const contract=JSON.parse(fs.readFileSync(path.join(root,'docs/releases/bug-smash-weekly96-contract.json')));
const migration=fs.readFileSync(path.join(root,contract.migration),'utf8');
const original=evidence.functions.find(f=>f.schema==='meadow_littles_private'),wrapper=evidence.functions.find(f=>f.schema==='public');
const uuid=()=>crypto.randomUUID(),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
let checks=0;
async function run(){
 const db=await PGlite.create();
 const q=async(sql,args=[])=>db.query(sql,args);
 const scalar=async(sql,args=[]) =>(await q(sql,args)).rows[0];
 const reject=async(fn,code)=>{await assert.rejects(fn,e=>e.message.includes(code));checks++};
 try{
  await db.exec(`CREATE SCHEMA auth;CREATE SCHEMA meadow_littles_private;
   CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
   REVOKE ALL ON SCHEMA meadow_littles_private FROM PUBLIC;
   GRANT USAGE ON SCHEMA meadow_littles_private TO authenticated,service_role;
   GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  const groups=new Map();
  for(const c of evidence.columns){const table=c.schema+'.'+c.relname;if(!groups.has(table))groups.set(table,[]);groups.get(table).push(c);}
  const keys={'auth.users':'id','public.meadow_littles_profiles':'user_id','meadow_littles_private.weekly_config':'singleton','meadow_littles_private.weekly_fair':'user_id,week','meadow_littles_private.weekly_rounds':'ticket'};
  for(const [table,cols] of groups)await db.exec('CREATE TABLE '+table+'('+cols.map(c=>c.attname+' '+c.type+(c.not_null?' NOT NULL':'')+(c.default_expression?' DEFAULT '+c.default_expression:'')).join(',')+',PRIMARY KEY('+keys[table]+'));');
  // Explicit boundary stubs: this is a weekly-contract fixture, not auth/RLS acceptance.
  await db.exec(`CREATE FUNCTION meadow_littles_private.require_actor() RETURNS uuid LANGUAGE plpgsql AS $$
   BEGIN IF nullif(current_setting('fixture.actor',true),'') IS NULL THEN RAISE EXCEPTION 'FIXTURE_AUTH';END IF;
   RETURN current_setting('fixture.actor')::uuid;END $$;
   CREATE FUNCTION meadow_littles_private.guard_read(uuid) RETURNS void LANGUAGE plpgsql AS $$
   BEGIN IF current_setting('fixture.blocked',true)='yes' THEN RAISE EXCEPTION 'FIXTURE_GUARD';END IF;END $$;
   CREATE FUNCTION meadow_littles_private.fairplay_status(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{"banned":false}'::jsonb$$;
   CREATE FUNCTION meadow_littles_private.quality_status() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"quality_build":96,"quality_fixture":true}'::jsonb$$;
   INSERT INTO meadow_littles_private.weekly_config(singleton,enabled) VALUES(true,true);`);
  await db.exec(original.definition+';'+wrapper.definition+';');
  await db.exec(`REVOKE ALL ON FUNCTION meadow_littles_private.weekly(text,jsonb) FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION meadow_littles_private.weekly(text,jsonb) TO authenticated;
   REVOKE ALL ON FUNCTION public.meadow_littles_weekly(text,jsonb) FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.meadow_littles_weekly(text,jsonb) TO authenticated,service_role;`);
  const definitions=async()=> (await q(`SELECT n.nspname AS schema,pg_get_functiondef(p.oid) AS definition,p.prosrc AS body,p.proacl::text AS acl,p.prosecdef AS definer,p.proconfig AS settings,p.proowner::regrole::text AS owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid IN ('meadow_littles_private.weekly(text,jsonb)'::regprocedure,'public.meadow_littles_weekly(text,jsonb)'::regprocedure) ORDER BY n.nspname`)).rows;
  const before=await definitions();
  for(const f of evidence.functions){const x=before.find(x=>x.schema===f.schema);assert.equal(sha(x.definition),f.definition_sha256);assert.equal(sha(x.body),f.body_sha256);assert.equal(x.acl,f.acl);assert.equal(x.owner,f.owner);assert.deepEqual(x.settings,f.settings);assert.equal(x.definer,f.security_definer);checks++;}
  const actor=async(id)=>q("SELECT set_config('fixture.actor',$1,false)",[id]);
  const seed=async()=>{const id=uuid();await q('INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())',[id]);await q('INSERT INTO public.meadow_littles_profiles(user_id) VALUES($1)',[id]);return id;};
  const call=async(action,data={})=>(await scalar('SELECT public.meadow_littles_weekly($1,$2::jsonb) AS value',[action,JSON.stringify(data)])).value;
  const begin=async(game='bug_smash',id=uuid())=>call('begin',{game,request_id:id});
  const age=async(id,interval='3 seconds')=>q('UPDATE meadow_littles_private.weekly_rounds SET started_at=clock_timestamp()-$2::interval WHERE ticket=$1',[id,interval]);
  const finish=async(ticket,bonus=false)=>call('finish',{ticket,use_bonus:bonus});
  const play=async(game='bug_smash',bonus=false)=>{const b=await begin(game);await age(b.ticket);return finish(b.ticket,bonus);};
  const a=await seed(),b=await seed();await actor(a);
  await reject(()=>begin(),'LITTLES_WEEKLY_GAME');
  await db.exec(migration);
  const after=await definitions(),newPrivate=after.find(f=>f.schema==='meadow_littles_private');
  assert.equal(sha(newPrivate.body),contract.after.bodySha256);assert.equal(sha(newPrivate.definition),contract.after.definitionSha256);
  assert.equal(newPrivate.definition.replace(contract.replacement,contract.anchor),original.definition);
  for(const f of before){const x=after.find(x=>x.schema===f.schema);assert.equal(x.acl,f.acl);assert.equal(x.owner,f.owner);assert.equal(x.definer,f.definer);assert.deepEqual(x.settings,f.settings);if(f.schema==='public')assert.deepEqual(x,f);checks++;}
  // Every previous allowlisted game remains valid; avoid incidental rate-limit crossover.
  const oldIds=[...original.definition.match(/game_id=any\(array\[([\s\S]*?)\]\)/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
  for(const game of oldIds){const old=await begin(game);await age(old.ticket,'3 minutes');checks++;}
  await reject(()=>begin('not_a_game'),'LITTLES_WEEKLY_GAME');
  await reject(()=>begin('BUG_SMASH'),'LITTLES_WEEKLY_GAME');
  await reject(()=>call('begin',{game:'bug_smash'}),'LITTLES_WEEKLY_INVALID');
  const first=await begin(),duplicate=await begin('bug_smash',first.ticket);
  assert.equal(duplicate.ticket,first.ticket);assert.equal((await scalar('SELECT count(*)::int AS n FROM meadow_littles_private.weekly_rounds WHERE ticket=$1',[first.ticket])).n,1);checks++;
  await reject(()=>begin('memory',first.ticket),'LITTLES_WEEKLY_CONFLICT');
  await actor(b);await reject(()=>begin('bug_smash',first.ticket),'LITTLES_WEEKLY_CONFLICT');await reject(()=>finish(first.ticket),'LITTLES_WEEKLY_TICKET');await actor(a);
  await reject(()=>finish(first.ticket),'LITTLES_WEEKLY_EXPIRED');await age(first.ticket);
  let status=await finish(first.ticket);assert.equal(status.completed,1);assert.equal(status.points,10);assert.equal(status.quality_build,96);checks++;
  assert.deepEqual(await finish(first.ticket,true),status);checks++;
  for(let i=1;i<5;i++)status=await play();
  assert.equal(status.completed,5);assert.equal(status.rounds,5);assert.equal(status.points,50);assert.equal(status.bonus_per_game,2);checks++;
  status=await play('bug_smash',true);status=await play('bug_smash',true);
  assert.equal(status.completed,7);assert.equal(status.points,50);assert.equal(status.bonus_spent.bug_smash,2);checks++;
  const noBonus=await begin();await age(noBonus.ticket);await reject(()=>finish(noBonus.ticket,true),'LITTLES_WEEKLY_NO_BONUS');
  assert.equal((await call('status')).completed,7);checks++;
  status=await play('memory');assert.equal(status.completed,8);assert.equal(status.points,60);assert.equal(status.bonus_per_game,5);assert.equal(status.bonus_spent.bug_smash,2);checks++;
  status=await finish(noBonus.ticket,true);assert.equal(status.completed,9);assert.equal(status.points,60);assert.equal(status.bonus_spent.bug_smash,3);checks++;
  const late=await begin();await age(late.ticket,'3 hours');await reject(()=>finish(late.ticket),'LITTLES_WEEKLY_EXPIRED');
  const oldWeek=await begin();await age(oldWeek.ticket);await q("UPDATE meadow_littles_private.weekly_rounds SET week=week-7 WHERE ticket=$1",[oldWeek.ticket]);await reject(()=>finish(oldWeek.ticket),'LITTLES_WEEKLY_EXPIRED');await reject(()=>begin('bug_smash',oldWeek.ticket),'LITTLES_WEEKLY_CONFLICT');
  const missing=uuid();await actor(missing);await reject(()=>begin(),'LITTLES_OPEN_REQUIRED');
  await actor(a);await q("SELECT set_config('fixture.blocked','yes',false)");await reject(()=>begin(),'FIXTURE_GUARD');await q("SELECT set_config('fixture.blocked','no',false)");
  await q('UPDATE meadow_littles_private.weekly_config SET enabled=false');assert.equal((await call('status')).enabled,false);await reject(()=>begin(),'LITTLES_WEEKLY_NOT_RELEASED');await q('UPDATE meadow_littles_private.weekly_config SET preview_users=ARRAY[$1::uuid]',[a]);assert.ok((await begin()).ticket);await q('UPDATE meadow_littles_private.weekly_config SET enabled=true');checks++;
  await actor(b);for(let i=0;i<30;i++)await begin();await reject(()=>begin(),'LITTLES_WEEKLY_RATE_LIMIT');
  // Drift protection must reject applying this one-time delta a second time.
  await reject(()=>db.exec(migration),'BUG96_WEEKLY_SOURCE_DRIFT');await db.exec('ROLLBACK');
  console.log(JSON.stringify({result:'PASS',checks,previousIds:oldIds.length,engine:'PGlite0.6.0 / real PL/pgSQL in memory',migration:contract.migration,scope:'Real weekly begin/finish/idempotency/bonus/rate/invalid-ID guards; exact delta + unchanged wrapper/access. Explicit auth/fairplay/quality stubs; no real RLS, concurrency, phone or live database acceptance.'},null,2));
 }finally{await db.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
