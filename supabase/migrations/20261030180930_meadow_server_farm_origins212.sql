-- Server-issued new farms and explicit beta opening balances. Rollout stays off.
create table meadow_private.farm_start_config (
 singleton boolean primary key default true check(singleton),new_farms boolean not null default false
);
insert into meadow_private.farm_start_config(singleton,new_farms) values(true,false);
create table meadow_private.farm_origins (
 user_id uuid primary key references public.meadow_market_profiles(user_id) on delete cascade,
 origin text not null check(origin in ('server_initial','reviewed_beta')),
 review_id uuid not null unique,source_revision bigint not null,source_hash text not null check(source_hash ~ '^[0-9a-f]{64}$'),
 rules_hash text not null check(rules_hash ~ '^[0-9a-f]{64}$'),opening_balances jsonb not null,
 note text not null check(length(note) between 8 and 500),created_at timestamptz not null default clock_timestamp()
);
alter table meadow_private.farm_start_config enable row level security;
alter table meadow_private.farm_origins enable row level security;
revoke all on meadow_private.farm_start_config,meadow_private.farm_origins from public,anon,authenticated,service_role;
comment on table meadow_private.farm_origins is 'Meadow Markets provenance. reviewed_beta opening balances preserve reviewed historical data; they do not attest verified earning history.';
alter table meadow_private.farm_economy_journal drop constraint farm_economy_journal_lane_check;
alter table meadow_private.farm_economy_journal add constraint farm_economy_journal_lane_check check(lane in ('legacy_baseline','legacy_snapshot','server_receipt','verified_action','server_initial'));

do $migration$
declare body text;marker text;
begin
 body:=pg_get_functiondef('meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure);
 marker:=' if not exists(select 1 from meadow_private.farm_command_accounts where user_id=p_user) then';
 if position(marker in body)=0 then raise exception 'Review command read before farm initialization';end if;
 body:=replace(body,marker,$start$
 if p_body->'commands'='[{"type":"farm.initialize"}]'::jsonb and (p_body->>'expected_revision')::bigint=0 then
  select * into saved from public.meadow_market_saves where user_id=p_user;
  if not found then
   if not exists(select 1 from meadow_private.farm_start_config where singleton and new_farms)
    and not exists(select 1 from meadow_private.farm_command_accounts where user_id=p_user) then return jsonb_build_object('ok',false,'enabled',false);end if;
   return jsonb_build_object('ok',true,'enabled',true,'initializing',true,'revision',0,
    'server_time',floor(extract(epoch from clock_timestamp())*1000),
    'profile',(select jsonb_build_object('friend_code',friend_code,'display_name',display_name) from public.meadow_market_profiles where user_id=p_user));
  elsif not exists(select 1 from meadow_private.farm_command_receipts where user_id=p_user and request_id=p_request_id) then
   return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,'save_data',saved.save_data,'save_protocol',saved.save_protocol);
  end if;
 end if;
$start$||marker);execute body;
 body:=pg_get_functiondef('meadow_private.commit_farm_command(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure);
 marker:=' old_claims:=current_setting(''request.jwt.claims'',true);old_owner:=current_setting(''meadow.command_owner'',true);';
 if position(marker in body)=0 then raise exception 'Review committer before farm initialization';end if;
 body:=replace(body,marker,$start$
 if context->>'initializing'='true' then
  if p_save_data->>'coins'<>'250' or p_save_data->>'level'<>'1' or p_save_data->>'xp'<>'0'
   or p_save_data->>'active'<>'willow' or (select count(*) from jsonb_object_keys(p_save_data->'farms'))<>1
   or jsonb_array_length(p_save_data#>'{farms,willow,objects}')<>9 or p_summary->>'rules' !~ '^[0-9a-f]{64}$'
  then raise exception 'Invalid server starter farm' using errcode='22023';end if;
  insert into meadow_private.farm_command_accounts(user_id) values(p_user) on conflict do nothing;
 end if;
$start$||marker);
 marker:=' update meadow_private.farm_economy_journal set lane=''verified_action'',source_id=p_request_id::text';
 if position(marker in body)=0 then raise exception 'Review command provenance write';end if;
 body:=replace(body,marker,$origin$
 if context->>'initializing'='true' then
  insert into meadow_private.farm_origins(user_id,origin,review_id,source_revision,source_hash,rules_hash,opening_balances,note)
   values(p_user,'server_initial',p_request_id,0,encode(sha256(convert_to(p_save_data::text,'UTF8')),'hex'),p_summary->>'rules',meadow_private.farm_balances(p_save_data),'Fixed starter farm issued by reviewed game rules');
  update meadow_private.farm_economy_journal set lane='server_initial',source_id=p_request_id::text where user_id=p_user and revision=0 and lane='legacy_baseline';
 end if;
$origin$||marker);execute body;
 body:=pg_get_functiondef('meadow_private.guard_farm_economy_protocol()'::regprocedure);
 marker:=' if current_user in (''authenticated'',''anon'') then';
 if position(marker in body)=0 then raise exception 'Review legacy start guard';end if;
 body:=replace(body,marker,$guard$
 if tg_op='INSERT' and exists(select 1 from meadow_private.farm_start_config where singleton and new_farms)
  and coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Start this farm with the updated online game' using errcode='40001';end if;
$guard$||marker);execute body;
end $migration$;

-- Administrative, service-only conversion. Takes no incoming snapshot and
-- requires an exact hash/revision of the farm the operator actually reviewed.
create function meadow_private.convert_reviewed_farm(p_user uuid,p_review_id uuid,p_revision bigint,p_hash text,p_rules text,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.meadow_market_saves;origin meadow_private.farm_origins;digest text;previous_owner text;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 if p_review_id is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_rules is null or p_rules !~ '^[0-9a-f]{64}$' or p_note is null or length(trim(p_note)) not between 8 and 500 then raise exception 'A documented farm review is required' using errcode='22023';end if;
 if not exists(select 1 from public.meadow_market_profiles where user_id=p_user) or exists(select 1 from meadow_private.account_deletions where user_id=p_user) then raise exception 'Account unavailable' using errcode='42501';end if;
 insert into public.meadow_market_wallets(user_id) values(p_user) on conflict do nothing;
 perform 1 from public.meadow_market_wallets where user_id=p_user for update;
 select * into saved from public.meadow_market_saves where user_id=p_user for update;
 if not found then raise exception 'An existing farm is required' using errcode='22023';end if;
 select * into origin from meadow_private.farm_origins where user_id=p_user;
 if found then
  if origin.origin='reviewed_beta' and origin.review_id=p_review_id and origin.source_hash=p_hash and origin.rules_hash=p_rules then return jsonb_build_object('ok',true,'replayed',true,'revision',saved.revision,'save_data',saved.save_data,'save_protocol',saved.save_protocol);end if;
  raise exception 'Farm already has recorded provenance' using errcode='22023';
 end if;
 digest:=encode(sha256(convert_to(saved.save_data::text,'UTF8')),'hex');
 if p_revision is null or saved.revision<>p_revision or digest<>p_hash then return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision);end if;
 if exists(select 1 from meadow_private.farm_command_accounts where user_id=p_user) or saved.save_protocol>=4 then raise exception 'Farm is already protected' using errcode='22023';end if;
 insert into meadow_private.farm_origins(user_id,origin,review_id,source_revision,source_hash,rules_hash,opening_balances,note)
 values(p_user,'reviewed_beta',p_review_id,saved.revision,digest,p_rules,meadow_private.farm_balances(saved.save_data),trim(p_note));
 insert into meadow_private.farm_command_accounts(user_id) values(p_user);
 previous_owner:=current_setting('meadow.command_owner',true);perform set_config('meadow.command_owner',p_user::text,true);
 update public.meadow_market_saves set save_protocol=4,save_data=save_data-'_serverWorkers'-'_serverReturns'-'_lessonReservations' where user_id=p_user returning * into saved;
 perform set_config('meadow.command_owner',coalesce(previous_owner,''),true);
 return jsonb_build_object('ok',true,'revision',saved.revision,'save_data',saved.save_data,'save_protocol',saved.save_protocol);
exception when others then perform set_config('meadow.command_owner',coalesce(previous_owner,''),true);raise;
end $$;
revoke all on function meadow_private.convert_reviewed_farm(uuid,uuid,bigint,text,text,text) from public,anon,authenticated;
grant execute on function meadow_private.convert_reviewed_farm(uuid,uuid,bigint,text,text,text) to service_role;
create function public.meadow_market_convert_reviewed_farm(p_user uuid,p_review_id uuid,p_revision bigint,p_hash text,p_rules text,p_note text) returns jsonb
language sql security invoker set search_path='' as $$select meadow_private.convert_reviewed_farm(p_user,p_review_id,p_revision,p_hash,p_rules,p_note)$$;
revoke all on function public.meadow_market_convert_reviewed_farm(uuid,uuid,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.meadow_market_convert_reviewed_farm(uuid,uuid,bigint,text,text,text) to service_role;
