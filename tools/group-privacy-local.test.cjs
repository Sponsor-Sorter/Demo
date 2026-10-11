const {PGlite}=require('../.validation/node_modules/@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema sponsorship_private;
 grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table friend_groups(id uuid primary key,owner_id uuid,visibility text);
 create table friend_group_members(group_id uuid,user_id uuid,role text,primary key(group_id,user_id));
 create table user_friendships(user_id uuid,friend_id uuid,status text);
 alter table friend_group_members enable row level security;
 grant select,insert,update,delete on friend_group_members to authenticated;
 create policy "friend_group_members.select_all_auth" on friend_group_members for select to authenticated using(true);
 create policy test_write on friend_group_members for all to authenticated using(true) with check(true);`);
 // Production has separate write policies; keep the test SELECT policy restrictive.
 await db.exec('drop policy test_write on friend_group_members;create policy test_insert on friend_group_members for insert to authenticated with check(true);create policy test_update on friend_group_members for update to authenticated using(true) with check(true);create policy test_delete on friend_group_members for delete to authenticated using(true)');
 await db.exec(fs.readFileSync('supabase/migrations/20261011145122_group_membership_privacy.sql','utf8'));
 const owner='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333',g='44444444-4444-4444-8444-444444444444';
 await db.query("insert into friend_groups values($1,$2,'private')",[g,owner]);
 await db.query("insert into friend_group_members values($1,$2,'owner'),($1,$3,'member')",[g,owner,member]);
 async function actor(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
 await actor(outsider);assert.equal((await db.query('select * from friend_group_members')).rows.length,0);
 await actor(member);assert.equal((await db.query('select * from friend_group_members')).rows.length,2);
 await actor(owner);await assert.rejects(db.query('delete from friend_group_members where user_id=$1',[owner]),/owner membership/);
 await assert.rejects(db.query("update friend_group_members set role='owner' where user_id=$1",[member]),/Only the group owner/);
 await assert.rejects(db.query('update friend_group_members set user_id=$1 where user_id=$2',[outsider,member]),/identity cannot change/);
 await db.exec('reset role');await db.query("update friend_groups set visibility='public' where id=$1",[g]);
 await actor(outsider);assert.equal((await db.query('select * from friend_group_members')).rows.length,2);
 await db.close();console.log('Group privacy, owner preservation and membership identity checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
