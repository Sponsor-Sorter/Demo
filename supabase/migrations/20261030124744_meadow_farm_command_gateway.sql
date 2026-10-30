-- Staged farm-command protocol. No existing player is enrolled by this migration.
-- Enrollment stays private until EVERY client mutation (including workers,
-- missions, travel and friend help) has a command equivalent.
create table meadow_private.farm_command_accounts (
 user_id uuid primary key references public.meadow_market_profiles(user_id) on delete cascade,
 enrolled_at timestamptz not null default clock_timestamp()
);
create table meadow_private.farm_command_receipts (
 user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 request_id uuid not null, body_hash text not null, revision bigint not null,
 summary jsonb not null, created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,request_id)
);
alter table meadow_private.farm_command_accounts enable row level security;
alter table meadow_private.farm_command_receipts enable row level security;
revoke all on meadow_private.farm_command_accounts,meadow_private.farm_command_receipts from public,anon,authenticated,service_role;
comment on table meadow_private.farm_command_accounts is 'Meadow Markets command-only canary cohort. Empty until all client mutation paths have migrated; not player-editable.';
comment on table meadow_private.farm_command_receipts is 'Exactly-once Meadow Markets command acknowledgments. Snapshot bodies are not retained per action. Owner erasure cascades.';

alter table meadow_private.farm_economy_journal drop constraint farm_economy_journal_lane_check;
alter table meadow_private.farm_economy_journal add constraint farm_economy_journal_lane_check
 check(lane in ('legacy_baseline','legacy_snapshot','server_receipt','verified_action'));

create or replace function meadow_private.guard_farm_economy_protocol() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  raise exception 'Update Meadow Markets before syncing this farm' using errcode='40001';
 end if;
 if exists(select 1 from meadow_private.farm_command_accounts where user_id=new.user_id) then
  -- Both the authenticated backend role AND a transaction-local owner marker
  -- are required. A marker supplied through an ordinary RPC is insufficient.
  if coalesce(auth.jwt()->>'role','')<>'service_role'
   or current_setting('meadow.command_owner',true) is distinct from new.user_id::text then
   raise exception 'This farm accepts verified actions only' using errcode='40001';
  end if;
  new.save_protocol:=4;
 end if;
 return new;
end $$;
revoke all on function meadow_private.guard_farm_economy_protocol() from public,anon,authenticated,service_role;

create function meadow_private.read_farm_command(p_user uuid,p_request_id uuid,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.meadow_market_saves; ack meadow_private.farm_command_receipts; digest text;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 if p_user is null or p_request_id is null or jsonb_typeof(p_body) is distinct from 'object'
  or octet_length(p_body::text)>65536 or jsonb_typeof(p_body->'commands') is distinct from 'array'
  or jsonb_array_length(p_body->'commands') not between 1 and 32
  or jsonb_typeof(p_body->'expected_revision') is distinct from 'number'
  or (p_body->>'expected_revision')::numeric<>trunc((p_body->>'expected_revision')::numeric)
  or (p_body->>'expected_revision')::numeric not between 0 and 9007199254740991
  or (select count(*) from jsonb_object_keys(p_body))<>2
 then raise exception 'Invalid farm command' using errcode='22023';end if;
 if not exists(select 1 from meadow_private.farm_command_accounts where user_id=p_user) then
  return jsonb_build_object('ok',false,'enabled',false);
 end if;
 select * into saved from public.meadow_market_saves where user_id=p_user;
 if not found then raise exception 'Saved farm required' using errcode='22023';end if;
 digest:=encode(sha256(convert_to(p_body::text,'UTF8')),'hex');
 select * into ack from meadow_private.farm_command_receipts where user_id=p_user and request_id=p_request_id;
 if found then
  if ack.body_hash<>digest then raise exception 'Command receipt reused for different actions' using errcode='22023';end if;
  return jsonb_build_object('ok',true,'replayed',true,'request_id',p_request_id,'accepted_revision',ack.revision,'revision',saved.revision,'save_data',saved.save_data,'summary',ack.summary);
 end if;
 if saved.revision<>(p_body->>'expected_revision')::bigint then
  return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,'save_data',saved.save_data);
 end if;
 return jsonb_build_object('ok',true,'enabled',true,'revision',saved.revision,'save_data',saved.save_data,
  'server_time',floor(extract(epoch from clock_timestamp())*1000),
  'owned_collections',coalesce((select jsonb_agg(item_id order by item_id) from public.meadow_market_collectibles where user_id=p_user),'[]'::jsonb));
end $$;
revoke all on function meadow_private.read_farm_command(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function meadow_private.read_farm_command(uuid,uuid,jsonb) to service_role;
create function public.meadow_market_read_farm_command(p_user uuid,p_request_id uuid,p_body jsonb) returns jsonb
language sql security invoker set search_path='' as $$select meadow_private.read_farm_command(p_user,p_request_id,p_body)$$;
revoke all on function public.meadow_market_read_farm_command(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.meadow_market_read_farm_command(uuid,uuid,jsonb) to service_role;

create function meadow_private.commit_farm_command(p_user uuid,p_request_id uuid,p_body jsonb,p_save_data jsonb,p_summary jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare context jsonb; answer jsonb; saved public.meadow_market_saves; old_claims text; old_owner text; digest text;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 -- Same wallet -> save lock order as commerce and receipt delivery.
 insert into public.meadow_market_wallets(user_id) select p_user where exists(select 1 from public.meadow_market_profiles where user_id=p_user) on conflict do nothing;
 perform 1 from public.meadow_market_wallets where user_id=p_user for update;
 perform 1 from public.meadow_market_saves where user_id=p_user for update;
 context:=meadow_private.read_farm_command(p_user,p_request_id,p_body);
 if context->>'enabled'='false' or context->>'conflict'='true' or context->>'replayed'='true' then return context;end if;
 if jsonb_typeof(p_summary) is distinct from 'object' or octet_length(p_summary::text)>32768
  or jsonb_typeof(p_save_data) is distinct from 'object' then raise exception 'Invalid command result' using errcode='22023';end if;
 old_claims:=current_setting('request.jwt.claims',true);old_owner:=current_setting('meadow.command_owner',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','service_role')::text,true);
 perform set_config('meadow.command_owner',p_user::text,true);
 -- Reuse the paid-entitlement comparison and immutable server deliveries.
 -- Only the Edge reducer may supply this candidate; players cannot call this RPC.
 answer:=meadow_private.commit_economy_save((p_body->>'expected_revision')::bigint,p_save_data,p_request_id);
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
 perform set_config('meadow.command_owner',coalesce(old_owner,''),true);
 if answer->>'ok'<>'true' then return answer;end if;
 digest:=encode(sha256(convert_to(p_body::text,'UTF8')),'hex');
 select * into saved from public.meadow_market_saves where user_id=p_user;
 update meadow_private.farm_economy_journal set lane='verified_action',source_id=p_request_id::text
  where user_id=p_user and revision=saved.revision and lane='legacy_snapshot';
 insert into meadow_private.farm_command_receipts(user_id,request_id,body_hash,revision,summary)
  values(p_user,p_request_id,digest,saved.revision,p_summary);
 return jsonb_build_object('ok',true,'request_id',p_request_id,'accepted_revision',saved.revision,'revision',saved.revision,'save_data',saved.save_data,'summary',p_summary,'economy',answer->'economy');
exception when others then
 if old_claims is not null then perform set_config('request.jwt.claims',old_claims,true);end if;
 if old_owner is not null then perform set_config('meadow.command_owner',old_owner,true);end if;
 raise;
end $$;
revoke all on function meadow_private.commit_farm_command(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function meadow_private.commit_farm_command(uuid,uuid,jsonb,jsonb,jsonb) to service_role;
create function public.meadow_market_commit_farm_command(p_user uuid,p_request_id uuid,p_body jsonb,p_save_data jsonb,p_summary jsonb) returns jsonb
language sql security invoker set search_path='' as $$select meadow_private.commit_farm_command(p_user,p_request_id,p_body,p_save_data,p_summary)$$;
revoke all on function public.meadow_market_commit_farm_command(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.meadow_market_commit_farm_command(uuid,uuid,jsonb,jsonb,jsonb) to service_role;
