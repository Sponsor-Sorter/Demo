'use strict';
require('../tools/littles-local/qa-network.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),local=root+'/tools/littles-rewarded-tests/node_modules/@electric-sql/pglite',runtime=process.env.PGLITE_MODULE_ROOT||(fs.existsSync(local)?local:'D:/Chat Gpt/workspaces/frontlines-build/frontlines-gift106-20261116/node_modules/@electric-sql/pglite');
let db;
(async()=>{
 const {PGlite}=await import(pathToFileURL(runtime+'/dist/index.js').href);db=new PGlite();
 await db.exec(`create role authenticated;create role anon;create schema meadow_littles_private;create schema fixture;
 create table fixture.actor(id uuid);insert into fixture.actor values('00000000-0000-4000-8000-000000000001');
 create function meadow_littles_private.require_actor() returns uuid language plpgsql as $$declare actor uuid;begin select id into actor from fixture.actor;if actor is null then raise exception 'AUTH_REQUIRED';end if;return actor;end$$;
 create function meadow_littles_private.guard_read(uuid) returns void language plpgsql as $$begin if $1 is null then raise exception 'AUTH_REQUIRED';end if;end$$;
 create table meadow_littles_private.weekly_config(singleton boolean,quality_build integer,quality_preview_build integer,quality_preview_users uuid[]);
 insert into meadow_littles_private.weekly_config values(true,99,101,array['00000000-0000-4000-8000-000000000001']::uuid[]);
 create function meadow_littles_private.weekly(text,jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
 create function public.meadow_littles_weekly(text,jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
 CREATE OR REPLACE FUNCTION meadow_littles_private.quality_status()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
 AS $function$ declare actor uuid:=meadow_littles_private.require_actor(); answer jsonb; begin perform meadow_littles_private.guard_read(actor); select jsonb_build_object('public_quality_build',c.quality_build,'quality_build',greatest(c.quality_build,case when actor=any(c.quality_preview_users) then c.quality_preview_build else c.quality_build end)) into answer from meadow_littles_private.weekly_config c where singleton; return coalesce(answer,jsonb_build_object('public_quality_build',62,'quality_build',62)); end $function$;
 revoke all on function meadow_littles_private.quality_status() from public;grant usage on schema meadow_littles_private to authenticated;grant execute on function meadow_littles_private.quality_status() to authenticated;`);
 const files=fs.readdirSync(root+'/supabase/migrations').filter(f=>f.endsWith('_littles_writing_canvas102_rollout.sql'));assert.equal(files.length,1);
 await db.exec(fs.readFileSync(root+'/supabase/migrations/'+files[0],'utf8'));
 const status=async()=>(await db.query('select meadow_littles_private.quality_status() as value')).rows[0].value;
 assert.deepEqual(await status(),{public_quality_build:99,quality_build:99,public_quality_build_v2:99,quality_build_v2:101});
 await db.exec("update fixture.actor set id='00000000-0000-4000-8000-000000000002'");assert.equal((await status()).quality_build_v2,99);
 await db.exec("update meadow_littles_private.weekly_config set quality_build=101,quality_preview_users='{}'");assert.deepEqual(await status(),{public_quality_build:99,quality_build:99,public_quality_build_v2:101,quality_build_v2:101});
 await db.exec('update fixture.actor set id=null');await assert.rejects(status,/AUTH_REQUIRED/);
 await db.exec('set role anon');await assert.rejects(status,/permission denied/);await db.exec('reset role');
 await db.exec('delete from meadow_littles_private.weekly_config');await db.exec("update fixture.actor set id='00000000-0000-4000-8000-000000000002'");assert.equal((await status()).quality_build_v2,62);
 console.log('Writing actual PostgreSQL migration: guarded source/ACL, private and ordinary accounts, publication, unauthenticated/anon denial and empty configuration passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await db?.close();});
