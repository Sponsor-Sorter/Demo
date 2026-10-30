-- A client snapshot cannot mint, clone or downgrade a permanent gem upgrade.
-- Verified receipts are applied only AFTER this comparison against the locked
-- canonical save. Existing canonical purchases are preserved when an item moves.
create function meadow_private.assert_farm_entitlements(p_before jsonb,p_after jsonb) returns void
language plpgsql immutable security invoker set search_path='' as $$
declare f record; o jsonb; previous jsonb; matches int; copies int; k text; expected jsonb; proposed jsonb;
begin
 for f in select key,value from jsonb_each(coalesce(p_after->'farms','{}')) loop
  for o in select value from jsonb_array_elements(coalesce(f.value->'objects','[]')) loop
   if not(o ?| array['autoWater','wellGemTier','queueSlots']) and o->>'type' not in ('well','kitchen','workshop') then continue;end if;
   select count(*) into matches from jsonb_each(coalesce(p_before->'farms','{}')) farm cross join lateral jsonb_array_elements(coalesce(farm.value->'objects','[]')) obj where obj.value->>'id'=o->>'id' and obj.value->>'type'=o->>'type';
   select count(*) into copies from jsonb_each(p_after->'farms') farm cross join lateral jsonb_array_elements(coalesce(farm.value->'objects','[]')) obj where obj.value->>'id'=o->>'id' and obj.value->>'type'=o->>'type';
   if copies>greatest(1,matches) then raise exception 'A farm upgrade cannot be copied to a second item' using errcode='22023';end if;
   select value into previous from jsonb_array_elements(coalesce(p_before->'farms'->f.key->'objects','[]')) where value->>'id'=o->>'id' and value->>'type'=o->>'type' limit 1;
   if not found then
    select count(*),jsonb_agg(obj.value)->0 into matches,previous from jsonb_each(coalesce(p_before->'farms','{}')) farm cross join lateral jsonb_array_elements(coalesce(farm.value->'objects','[]')) obj where obj.value->>'id'=o->>'id' and obj.value->>'type'=o->>'type';
    select count(*) into copies from jsonb_each(p_after->'farms') farm cross join lateral jsonb_array_elements(coalesce(farm.value->'objects','[]')) obj where obj.value->>'id'=o->>'id' and obj.value->>'type'=o->>'type';
    if matches<>1 or copies<>1 then previous:='{}';end if;
   end if;
   foreach k in array array['autoWater','wellGemTier','queueSlots'] loop
    expected:=coalesce(previous->k,case when k='autoWater' then 'false'::jsonb else '0'::jsonb end);
    proposed:=coalesce(o->k,case when k='autoWater' then 'false'::jsonb else '0'::jsonb end);
    if proposed is distinct from expected then raise exception 'This farm upgrade needs a verified gem receipt. Reload the saved farm before continuing.' using errcode='22023';end if;
   end loop;
  end loop;
 end loop;
end $$;
revoke all on function meadow_private.assert_farm_entitlements(jsonb,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION meadow_private.commit_economy_save(p_expected_revision bigint, p_save_data jsonb, p_write_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); saved public.meadow_market_saves; ack meadow_private.farm_save_receipts;
 r public.meadow_market_economy_receipts; canonical jsonb; original jsonb; patch jsonb; rows jsonb:='[]';
 digest text; at_cursor bigint; to_cursor bigint; new_revision bigint; b jsonb; a jsonb; delta jsonb; legacy_delta jsonb; display_delivery jsonb;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Connect your Meadow Markets farm first' using errcode='28000';end if;
 if p_expected_revision is null or p_expected_revision<0 or p_write_id is null or p_save_data is null
  or jsonb_typeof(p_save_data) is distinct from 'object' or octet_length(p_save_data::text)>4194304
  or p_save_data->>'version' is distinct from '1' or jsonb_typeof(p_save_data->'farms') is distinct from 'object'
  or jsonb_typeof(p_save_data->'coins') is distinct from 'number'
 then raise exception 'Invalid farm save' using errcode='22023';end if;
 p_save_data:=jsonb_set(p_save_data,'{_cloudRevision}',to_jsonb(p_expected_revision));
 digest:=encode(sha256(convert_to(p_save_data::text,'UTF8')),'hex');
 -- The wallet then save lock order matches existing round/shop services.
 insert into public.meadow_market_wallets(user_id) values(u) on conflict do nothing;
 perform 1 from public.meadow_market_wallets where user_id=u for update;
 select * into saved from public.meadow_market_saves where user_id=u for update;
 select * into ack from meadow_private.farm_save_receipts where user_id=u and write_id=p_write_id;
 if found then
  if ack.body_hash<>digest then raise exception 'Save receipt reused for different data' using errcode='22023';end if;
  if saved.revision<>ack.revision then return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,'save_data',saved.save_data);end if;
  return jsonb_build_object('ok',true,'revision',ack.revision,'write_id',p_write_id,'replayed',true,'economy',ack.patch);
 end if;
 if coalesce(saved.revision,0)<>p_expected_revision then
  return jsonb_build_object('ok',false,'conflict',true,'revision',coalesce(saved.revision,0),'save_data',saved.save_data);
 end if;
 at_cursor:=coalesce((saved.save_data->'_farmEconomy'->>'cursor')::bigint,0);
 if coalesce((p_save_data->'_farmEconomy'->>'cursor')::bigint,0)<>at_cursor then
  return jsonb_build_object('ok',false,'conflict',true,'revision',coalesce(saved.revision,0),'save_data',saved.save_data);
 end if;
 -- Only the existing SERVER save can grandfather old deliveries. Incoming
 -- client "applied" arrays never authorize, suppress or repeat a server award.
 if saved.save_protocol is null or saved.save_protocol<3 then
  insert into meadow_private.farm_reward_deliveries(receipt_id,user_id,revision,imported)
   select e.id,u,coalesce(saved.revision,0),true from public.meadow_market_economy_receipts e
   where e.user_id=u and coalesce(saved.save_data->'club'->'applied','[]') ? e.id::text
   on conflict(receipt_id) do nothing;
 end if;
 perform meadow_private.assert_farm_entitlements(saved.save_data,p_save_data);
 canonical:=p_save_data;new_revision:=coalesce(saved.revision,0)+1;to_cursor:=at_cursor;
 if saved.user_id is null then
  b:=meadow_private.farm_balances(p_save_data);legacy_delta:='{}';
  insert into meadow_private.farm_economy_journal(user_id,revision,lane,changes,balance_hash)
   values(u,0,'legacy_baseline',b,encode(sha256(convert_to(b::text,'UTF8')),'hex'));
 else legacy_delta:=meadow_private.farm_balance_delta(meadow_private.farm_balances(saved.save_data),meadow_private.farm_balances(p_save_data));end if;
 -- Receipts are immutable player-read-only data; bounded batches avoid a
 -- longstanding account creating an unbounded request. Client drains more.
 for r in select e.* from public.meadow_market_economy_receipts e
  where e.user_id=u and not exists(select 1 from meadow_private.farm_reward_deliveries d where d.receipt_id=e.id)
  order by e.created_at,e.id limit 100 loop
  if to_cursor=at_cursor then to_cursor:=at_cursor+1;end if;
  b:=meadow_private.farm_balances(canonical);
  display_delivery:=meadow_private.bind_farm_speed(canonical,r.delivery);
  canonical:=meadow_private.apply_farm_receipt(canonical,r);
  a:=meadow_private.farm_balances(canonical);delta:=meadow_private.farm_balance_delta(b,a);
  insert into meadow_private.farm_reward_deliveries(receipt_id,user_id,revision) values(r.id,u,new_revision);
  insert into meadow_private.farm_economy_journal(user_id,revision,lane,source_id,changes,balance_hash)
   values(u,new_revision,'server_receipt',r.id::text,delta,encode(sha256(convert_to(a::text,'UTF8')),'hex'));
  rows:=rows||jsonb_build_array(jsonb_build_object('id',r.id,'kind',r.kind,'created_at',r.created_at,'delivery',display_delivery));
 end loop;
 canonical:=canonical||jsonb_build_object('_farmEconomy',jsonb_build_object('version',1,'cursor',to_cursor));
 patch:=jsonb_build_object('version',1,'from',at_cursor,'to',to_cursor,'receipts',rows);
 -- The AFTER trigger also journals old clients. Replace its total delta below
 -- with this request's pre-reward delta, keeping the two trust lanes separate.
 if saved.user_id is null then
  insert into public.meadow_market_saves(user_id,save_data,save_protocol,save_write_id,save_write_hash)
   values(u,canonical,3,p_write_id,digest) returning * into saved;
 else
  update public.meadow_market_saves set save_data=canonical,save_protocol=3,save_write_id=p_write_id,save_write_hash=digest where user_id=u returning * into saved;
 end if;
 delete from meadow_private.farm_economy_journal j where j.user_id=u and j.revision=saved.revision and j.lane='legacy_snapshot';
 if legacy_delta<>'{}' then
  a:=meadow_private.farm_balances(p_save_data);
  insert into meadow_private.farm_economy_journal(user_id,revision,lane,changes,balance_hash)
   values(u,saved.revision,'legacy_snapshot',legacy_delta,encode(sha256(convert_to(a::text,'UTF8')),'hex'));
 end if;
 insert into meadow_private.farm_save_receipts(user_id,write_id,body_hash,revision,patch) values(u,p_write_id,digest,saved.revision,patch);
 return jsonb_build_object('ok',true,'revision',saved.revision,'write_id',p_write_id,'economy',patch);
end $function$;
