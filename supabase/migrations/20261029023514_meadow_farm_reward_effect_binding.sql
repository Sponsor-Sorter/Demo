-- Bind client speed projections to the jobs/crop cycle that existed at commit.
-- New work started while a response travels must not get a free speed boost.
create function meadow_private.bind_farm_speed(s jsonb,d jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare basis jsonb:='{}'; f record; o jsonb;
begin
 if not(d ? 'speed') then return d;end if;
 for f in select key,value from jsonb_each(s->'farms') where not(d->'speed' ? 'map') or key=d->'speed'->>'map' loop
  for o in select value from jsonb_array_elements(f.value->'objects') where value->>'id'=d->'speed'->>'target' loop
   basis:=basis||jsonb_build_object(f.key,jsonb_build_object('plantedAt',o->'plantedAt','jobs',coalesce(o->'jobs','[]')));
  end loop;
 end loop;
 return jsonb_set(d,'{speed,basis}',basis);
end $$;
revoke all on function meadow_private.bind_farm_speed(jsonb,jsonb) from public,anon,authenticated;
create or replace function meadow_private.commit_economy_save(p_expected_revision bigint,p_save_data jsonb,p_write_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;
