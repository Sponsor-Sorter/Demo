-- Operator recovery snapshots supplement the existing legacy farm-only backups.
-- Immutable receipt ledgers must be restored/reconciled separately, never replayed
-- from a player-exported snapshot. No client or service-role table access.
create table meadow_private.farm_recovery_backups (
 user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 backup_day date not null default current_date,
 revision bigint not null,
 bundle jsonb not null check(jsonb_typeof(bundle)='object' and bundle->>'version'='1'),
 bundle_hash text not null check(bundle_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 primary key(user_id,backup_day)
);
create index meadow_recovery_backup_retention on meadow_private.farm_recovery_backups(created_at);
alter table meadow_private.farm_recovery_backups enable row level security;
revoke all on meadow_private.farm_recovery_backups from public,anon,authenticated,service_role;

create function meadow_private.farm_recovery_snapshot(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'version',1,'captured_at',statement_timestamp(),'user_id',s.user_id,
  'farm',to_jsonb(s),'wallet',(select to_jsonb(w) from public.meadow_market_wallets w where w.user_id=s.user_id),
  'collection_wallet',(select to_jsonb(w) from public.meadow_market_collection_wallets w where w.user_id=s.user_id),
  'collectibles',coalesce((select jsonb_agg(to_jsonb(c) order by c.item_id) from public.meadow_market_collectibles c where c.user_id=s.user_id),'[]'::jsonb),
  'origin',(select to_jsonb(o) from meadow_private.farm_origins o where o.user_id=s.user_id),
  'command_account',(select to_jsonb(a) from meadow_private.farm_command_accounts a where a.user_id=s.user_id),
  'ledger',jsonb_build_object(
   'economy_cursor',coalesce(s.save_data->'_farmEconomy'->'cursor','0'::jsonb),
   'economy_receipts',(select count(*) from public.meadow_market_economy_receipts r where r.user_id=s.user_id),
   'reward_deliveries',(select count(*) from meadow_private.farm_reward_deliveries r where r.user_id=s.user_id),
   'command_receipts',(select count(*) from meadow_private.farm_command_receipts r where r.user_id=s.user_id),
   'store_purchases',(select count(*) from meadow_private.store_purchases r where r.user_id=s.user_id)
  ))
 from public.meadow_market_saves s join public.meadow_market_profiles p using(user_id)
 where s.user_id=p_user and not exists(select 1 from meadow_private.account_deletions d where d.user_id=s.user_id)
$$;
revoke all on function meadow_private.farm_recovery_snapshot(uuid) from public,anon,authenticated,service_role;

create or replace function meadow_private.maintain_game_accounts() returns jsonb
language plpgsql security definer set search_path='' as $$
declare removed integer; backed integer; recovery_backed integer;
begin
 removed:=meadow_private.erase_due_game_accounts();
 insert into meadow_private.farm_backups(user_id,backup_day,revision,save_data)
  select s.user_id,current_date,s.revision,s.save_data from public.meadow_market_saves s join public.meadow_market_profiles p using(user_id)
  where not exists(select 1 from meadow_private.farm_backups b where b.user_id=s.user_id and b.backup_day=current_date)
  order by s.updated_at desc limit 100 on conflict do nothing;
 get diagnostics backed=row_count;
 with candidates as materialized (
  select s.user_id,meadow_private.farm_recovery_snapshot(s.user_id) bundle
  from public.meadow_market_saves s
  where not exists(select 1 from meadow_private.farm_recovery_backups b where b.user_id=s.user_id and b.backup_day=current_date)
   and not exists(select 1 from meadow_private.account_deletions d where d.user_id=s.user_id)
  order by s.updated_at desc limit 100
 )
 insert into meadow_private.farm_recovery_backups(user_id,backup_day,revision,bundle,bundle_hash)
  select user_id,current_date,(bundle->'farm'->>'revision')::bigint,bundle,
   encode(sha256(convert_to(bundle::text,'UTF8')),'hex') from candidates where bundle is not null on conflict do nothing;
 get diagnostics recovery_backed=row_count;
 delete from meadow_private.farm_backups where created_at<now()-interval '30 days';
 delete from meadow_private.farm_recovery_backups where created_at<now()-interval '30 days';
 delete from meadow_private.diagnostics where created_at<now()-interval '30 days';
 return jsonb_build_object('deleted',removed,'backed_up',backed,'recovery_backed_up',recovery_backed);
end $$;
revoke all on function meadow_private.maintain_game_accounts() from public,anon,authenticated;
