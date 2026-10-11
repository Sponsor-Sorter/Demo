const {PGlite}=require('../.validation/node_modules/@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create schema sponsorship_private;
 grant usage on schema auth,sponsorship_private to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table private_offers(id uuid primary key,sponsor_id uuid,sponsee_id uuid,live_urls text[],live_url text);
 create function sponsorship_private.offer_access(key text,kind text default 'view') returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.private_offers where id::text=key and auth.uid() in(sponsor_id,sponsee_id))$$;
 create table stats_snapshot(id uuid primary key default gen_random_uuid(),offer_id uuid,updated_by uuid,last_stats jsonb);
 create table offer_engagement_analytics(id uuid primary key default gen_random_uuid(),offer_id uuid);
 alter table stats_snapshot enable row level security;alter table offer_engagement_analytics enable row level security;
 create policy old_everybody on stats_snapshot using(true) with check(true);
 grant select,insert,update on stats_snapshot to authenticated;grant select on offer_engagement_analytics to authenticated;
 `);await db.exec(fs.readFileSync('supabase/migrations/20261011090944_private_campaign_metric_history.sql','utf8'));
 const sponsor='11111111-1111-4111-8111-111111111111',creator='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',offer='44444444-4444-4444-8444-444444444444';
 for(const id of[sponsor,creator,other])await db.query('insert into auth.users values($1)',[id]);await db.query("insert into private_offers values($1,$2,$3,array['https://youtube.com/watch?v=fixture'],null)",[offer,sponsor,creator]);
 async function actor(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
 const record=(metrics={views:123,likes:null},url='https://youtube.com/watch?v=fixture')=>db.query('select record_campaign_observation($1,$2,$3,$4::jsonb)',[offer,url,'youtube',JSON.stringify(metrics)]);
 await actor(sponsor);await record();await record();const first=(await db.query('select * from campaign_metric_history')).rows;assert.equal(first.length,1);assert.equal(first[0].metrics.likes,null);
 await assert.rejects(record({views:-1}),/Invalid metric/);await assert.rejects(record({access_token:'secret'}),/Invalid metric/);await assert.rejects(record({views:1},'https://evil.invalid'),/Published campaign link/);
 await db.query("insert into stats_snapshot(offer_id,updated_by,last_stats) values($1,$2,'{}')",[offer,sponsor]);
 await actor(other);assert.equal((await db.query('select * from stats_snapshot')).rows.length,0);assert.equal((await db.query('select * from campaign_metric_history')).rows.length,0);await assert.rejects(record(),/Campaign access/);
 await assert.rejects(db.query("insert into stats_snapshot(offer_id,updated_by) values($1,$2)",[offer,other]),/row-level security/);
 await actor(creator);assert.equal((await db.query('select * from campaign_metric_history')).rows.length,1);
 await db.exec('reset role');await db.exec("update campaign_metric_history set recorded_at=now()-interval '1 day'");await actor(sponsor);await record({views:150});assert.equal((await db.query('select * from campaign_metric_history')).rows.length,2);
 await assert.rejects(db.query('delete from campaign_metric_history'),/permission denied/);
 await db.close();console.log('Campaign history checks passed: private access, immutable history, cadence, valid links and unknown metrics.');
})().catch(error=>{console.error(error);process.exitCode=1;});
