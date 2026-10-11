const { PGlite }=require('../.validation/node_modules/@electric-sql/pglite');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create table users_extended_data(user_id uuid primary key,banned boolean default false);
 create table public_user_directory(user_id uuid primary key);
 grant select on users_extended_data,public_user_directory to authenticated;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261011085626_durable_partner_preferences.sql','utf8'));
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 for(const id of [a,b]){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into users_extended_data(user_id) values($1)',[id]);await db.query('insert into public_user_directory values($1)',[id]);}
 async function actor(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
 await actor(a);
 await db.query("insert into partner_preferences(user_id,contenttype,platforms) values($1,'gaming',array['youtube'])",[a]);
 await db.query("insert into partner_feedback values($1,$2,'dismissed')",[a,b]);
 await assert.rejects(db.query("insert into partner_preferences(user_id) values($1)",[b]),/row-level security/);
 await assert.rejects(db.query("update partner_preferences set platforms=array['malicious'] where user_id=$1",[a]),/check constraint/);
 await assert.rejects(db.query("insert into partner_feedback values($1,$1,'saved')",[a]),/check constraint/);
 await actor(b);assert.equal((await db.query('select * from partner_preferences')).rows.length,0);assert.equal((await db.query('select * from partner_feedback')).rows.length,0);
 assert.equal((await db.query("delete from partner_feedback where user_id=$1 returning *",[a])).rows.length,0);
 await actor(a);assert.equal((await db.query('select contenttype from partner_preferences')).rows[0].contenttype,'gaming');
 await db.query("delete from partner_feedback where user_id=$1 and status='dismissed'",[a]);assert.equal((await db.query('select * from partner_feedback')).rows.length,0);
 await db.exec('reset role');await db.exec('set role anon');await assert.rejects(db.query('select * from partner_feedback'),/permission denied/);
 await db.close();console.log('Partner preference RLS, validation, cross-session persistence and dismissal undo checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
