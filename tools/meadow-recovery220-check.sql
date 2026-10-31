-- Run after the migration, in a rollback-only transaction.
begin;
do $$
declare u uuid:=gen_random_uuid();a jsonb;b jsonb;r bigint;
begin
 if has_table_privilege('authenticated','meadow_private.farm_recovery_backups','SELECT')
  or has_table_privilege('service_role','meadow_private.farm_recovery_backups','INSERT')
  or has_function_privilege('authenticated','meadow_private.farm_recovery_snapshot(uuid)','EXECUTE')
  or has_function_privilege('service_role','meadow_private.farm_recovery_snapshot(uuid)','EXECUTE') then raise exception 'Recovery data exposed';end if;
 if meadow_private.farm_recovery_snapshot(u) is not null then raise exception 'Missing account returned data';end if;
 insert into auth.users(id,aud,role,is_anonymous) values(u,'authenticated','authenticated',true);
 insert into public.meadow_market_profiles(user_id,friend_code,display_name) values(u,'MM-'||left(u::text,8),'Rollback recovery fixture');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 a:=public.meadow_market_commit_economy_save(0,'{"version":1,"coins":250,"level":1,"xp":0,"active":"willow","farms":{"willow":{"objects":[],"inventory":{}}}}',gen_random_uuid());
 update public.meadow_market_wallets set gems=37,premium=true,reward_turns=4,vip_xp=12 where user_id=u;
 a:=meadow_private.farm_recovery_snapshot(u);r:=(a->'farm'->>'revision')::bigint;
 if a->'wallet'->>'gems'<>'37' or a->'wallet'->>'premium'<>'true' or a->'farm'->'save_data'->>'coins'<>'250' then raise exception 'Snapshot omitted farm or wallet';end if;
 insert into meadow_private.farm_recovery_backups(user_id,revision,bundle,bundle_hash) values(u,r,a,encode(sha256(convert_to(a::text,'UTF8')),'hex'));
 update public.meadow_market_wallets set gems=40 where user_id=u;
 b:=meadow_private.farm_recovery_snapshot(u);
 if b->'wallet'->>'gems'<>'40' or (select bundle->'wallet'->>'gems' from meadow_private.farm_recovery_backups where user_id=u)<>'37' then raise exception 'Archived wallet drifted';end if;
 if exists(select 1 from meadow_private.farm_recovery_backups where user_id=u and bundle_hash<>encode(sha256(convert_to(bundle::text,'UTF8')),'hex')) then raise exception 'Archive hash mismatch';end if;
 insert into meadow_private.account_deletions(user_id) values(u);
 if meadow_private.farm_recovery_snapshot(u) is not null then raise exception 'Pending deletion was archived';end if;
 delete from public.meadow_market_profiles where user_id=u;
 if exists(select 1 from meadow_private.farm_recovery_backups where user_id=u) then raise exception 'Game deletion retained recovery data';end if;
end $$;
select 'Recovery220: private coherent snapshots, immutable archive, checksums and game deletion passed' result;
rollback;
