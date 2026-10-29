-- Meadow Markets only. Farm actions remain legacy/test-authoritative until
-- their individual rules move server-side. A journal is NOT proof of earnings.
create table meadow_private.farm_economy_journal (
 user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 revision bigint not null, lane text not null check(lane in ('legacy_baseline','legacy_snapshot','server_receipt')),
 source_id text not null default '', changes jsonb not null, balance_hash text not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,revision,lane,source_id)
);
create table meadow_private.farm_reward_deliveries (
 receipt_id uuid primary key references public.meadow_market_economy_receipts(id) on delete cascade,
 user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 revision bigint not null, imported boolean not null default false,
 created_at timestamptz not null default clock_timestamp()
);
create index meadow_farm_deliveries_owner on meadow_private.farm_reward_deliveries(user_id,receipt_id);
create table meadow_private.farm_save_receipts (
 user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 write_id uuid not null, body_hash text not null, revision bigint not null, patch jsonb not null,
 created_at timestamptz not null default clock_timestamp(), primary key(user_id,write_id)
);
alter table meadow_private.farm_economy_journal enable row level security;
alter table meadow_private.farm_reward_deliveries enable row level security;
alter table meadow_private.farm_save_receipts enable row level security;
revoke all on meadow_private.farm_economy_journal,meadow_private.farm_reward_deliveries,meadow_private.farm_save_receipts from public,anon,authenticated;

-- Flatten shared baskets once. Shop shelves are separate accounts, so moving
-- goods from basket to shelves remains visible without pretending it is a sale.
create function meadow_private.farm_balances(s jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb; f record; v record; shared boolean:=s->>'sharedPantryVersion'='1';
begin
 result:=jsonb_build_object('gold',coalesce(s->'coins','0'::jsonb),'xp',coalesce(s->'xp','0'::jsonb),'level',coalesce(s->'level','1'::jsonb));
 for f in select key,value from jsonb_each(coalesce(s->'farms','{}')) loop
  if not coalesce(shared,false) or f.key='willow' then
   for v in select key,value from jsonb_each(coalesce(f.value->'inventory','{}')) loop
    result:=result||jsonb_build_object('basket:'||(case when shared then 'shared' else f.key end)||':'||v.key,v.value);
   end loop;
  end if;
  for v in select key,value from jsonb_each(coalesce(f.value->'shop'->'stock','{}')) loop
   result:=result||jsonb_build_object('shelves:'||f.key||':'||v.key,v.value);
  end loop;
 end loop;
 return result;
end $$;
create function meadow_private.farm_balance_delta(a jsonb,b jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(k,to_jsonb(coalesce((b->>k)::numeric,0)-coalesce((a->>k)::numeric,0))),'{}')
 from (select jsonb_object_keys(a) k union select jsonb_object_keys(b)) keys
 where coalesce((a->>k)::numeric,0)<>coalesce((b->>k)::numeric,0)
$$;
revoke all on function meadow_private.farm_balances(jsonb),meadow_private.farm_balance_delta(jsonb,jsonb) from public,anon,authenticated;

-- No direct/old-client save can silently downgrade an enrolled farm. The new
-- RPC checks auth.uid + expected revision before its privileged atomic write.
create function meadow_private.guard_farm_economy_protocol() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and
   (new.save_protocol>=3 or (tg_op='UPDATE' and old.save_protocol>=3)) then
  raise exception 'Update Meadow Markets before syncing this farm' using errcode='40001';
 end if;
 return new;
end $$;
revoke all on function meadow_private.guard_farm_economy_protocol() from public,anon,authenticated;
create trigger meadow_market_farm_economy_guard before insert or update on public.meadow_market_saves
for each row execute function meadow_private.guard_farm_economy_protocol();

create function meadow_private.journal_farm_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_balance jsonb; after_balance jsonb; delta jsonb;
begin
 if auth.uid() is not null and auth.uid()<>new.user_id then raise exception 'Farm owner mismatch' using errcode='42501';end if;
 after_balance:=meadow_private.farm_balances(new.save_data);
 if not exists(select 1 from meadow_private.farm_economy_journal j where j.user_id=new.user_id and j.lane='legacy_baseline') then
  before_balance:=case when tg_op='UPDATE' then meadow_private.farm_balances(old.save_data) else after_balance end;
  insert into meadow_private.farm_economy_journal(user_id,revision,lane,changes,balance_hash)
   values(new.user_id,case when tg_op='UPDATE' then old.revision else new.revision end,'legacy_baseline',before_balance,encode(sha256(convert_to(before_balance::text,'UTF8')),'hex'));
 end if;
 if tg_op='UPDATE' then
  before_balance:=meadow_private.farm_balances(old.save_data);
  delta:=meadow_private.farm_balance_delta(before_balance,after_balance);
  if delta<>'{}' then
   insert into meadow_private.farm_economy_journal(user_id,revision,lane,changes,balance_hash)
    values(new.user_id,new.revision,'legacy_snapshot',delta,encode(sha256(convert_to(after_balance::text,'UTF8')),'hex'));
  end if;
 end if;
 return new;
end $$;
revoke all on function meadow_private.journal_farm_snapshot() from public,anon,authenticated;
create trigger meadow_market_journal_farm_snapshot after insert or update on public.meadow_market_saves
for each row execute function meadow_private.journal_farm_snapshot();

-- Pure server effect reducer. Values come only from server-owned receipts.
create function meadow_private.apply_farm_receipt(s jsonb,r public.meadow_market_economy_receipts) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d jsonb:=r.delivery; f record; it record; o jsonb; objects jsonb; jobs jsonb; j jsonb;
 gold numeric:=coalesce((s->>'coins')::numeric,0); xp numeric:=coalesce((s->>'xp')::numeric,0);
 lv int:=coalesce((s->>'level')::int,1); home text; bag jsonb; q jsonb; effect text; k text;
 n numeric; rewards jsonb; applied jsonb;
begin
 gold:=gold+coalesce((d->>'gold')::numeric,0);
 if coalesce((d->>'xp')::numeric,0)>0 then
  xp:=xp+(d->>'xp')::numeric;
  -- Matches the current game's one-level-per-XP-award rule, including its bonus.
  if xp>=90+(lv-1)*50 then xp:=xp-(90+(lv-1)*50);lv:=lv+1;gold:=gold+35;end if;
 end if;
 s:=s||jsonb_build_object('coins',gold,'xp',xp,'level',lv);
 home:=case when s->'farms' ? (d->>'map') then d->>'map' when s->'farms' ? (s->>'active') then s->>'active' else 'willow' end;
 if s->>'sharedPantryVersion'='1' then home:='willow';end if;
 bag:=coalesce(s->'farms'->home->'inventory','{}');
 for it in select key,value from jsonb_each(coalesce(d->'items','{}')) loop
  n:=coalesce((bag->>it.key)::numeric,0)+(it.value::text)::numeric;
  bag:=jsonb_set(bag,array[it.key],to_jsonb(n));
 end loop;
 s:=jsonb_set(s,array['farms',home,'inventory'],bag);
 if s->>'sharedPantryVersion'='1' then
  s:=jsonb_set(s,'{inventory}',bag);
  for f in select key from jsonb_each(s->'farms') loop s:=jsonb_set(s,array['farms',f.key,'inventory'],bag);end loop;
 end if;
 foreach effect in array array['well_watering','well_upgrade','queue_slot','speed'] loop
  q:=d->effect;if q is null then continue;end if;
  for f in select key,value from jsonb_each(s->'farms') where not(q ? 'map') or key=q->>'map' loop
   objects:='[]';
   for o in select value from jsonb_array_elements(f.value->'objects') loop
    if o->>'id'=q->>'target' then
     if effect='well_watering' and o->>'type'='well' then o:=o||'{"autoWater":true}';
     elsif effect='well_upgrade' and o->>'type'='well' then o:=o||jsonb_build_object('wellGemTier',greatest(coalesce((o->>'wellGemTier')::int,0),least(4,(q->>'level')::int)));
     elsif effect='queue_slot' and o->>'type' in ('kitchen','workshop') then o:=o||jsonb_build_object('queueSlots',greatest(coalesce((o->>'queueSlots')::int,0),least(8,(q->>'level')::int)));
     elsif effect='speed' then
      n:=(q->>'minutes')::numeric*60000;
      if o->>'type'='plot' and coalesce((o->>'plantedAt')::numeric,0)<>0 then o:=jsonb_set(o,'{plantedAt}',to_jsonb((o->>'plantedAt')::numeric-n));end if;
      if o ? 'jobs' then
       jobs:='[]';for j in select value from jsonb_array_elements(o->'jobs') loop jobs:=jobs||jsonb_build_array(j||jsonb_build_object('startAt',(j->>'startAt')::numeric-n,'finishAt',(j->>'finishAt')::numeric-n));end loop;
       o:=jsonb_set(o,'{jobs}',jobs);
      end if;
     end if;
    end if;
    objects:=objects||jsonb_build_array(o);
   end loop;
   s:=jsonb_set(s,array['farms',f.key,'objects'],objects);
  end loop;
 end loop;
 if d ? 'game' and r.kind<>'reward_turn' then
  s:=jsonb_set(s,'{minigames}',coalesce(s->'minigames','{"records":{},"rewards":{}}'));
  rewards:=coalesce(s->'minigames'->'rewards','{}');k:=to_char(r.created_at at time zone 'UTC','YYYY-MM-DD')||':'||(d->>'game');
  rewards:=jsonb_set(rewards,array[k],to_jsonb(coalesce((rewards->>k)::int,0)+1));
  s:=jsonb_set(s,'{minigames,rewards}',rewards);
 end if;
 s:=jsonb_set(s,'{club}',coalesce(s->'club','{}'));
 applied:=coalesce(s->'club'->'applied','[]');
 if not applied ? r.id::text then applied:=applied||jsonb_build_array(r.id);end if;
 return jsonb_set(s,'{club,applied}',applied);
end $$;
revoke all on function meadow_private.apply_farm_receipt(jsonb,public.meadow_market_economy_receipts) from public,anon,authenticated;

create function meadow_private.commit_economy_save(p_expected_revision bigint,p_save_data jsonb,p_write_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); saved public.meadow_market_saves; ack meadow_private.farm_save_receipts;
 r public.meadow_market_economy_receipts; canonical jsonb; original jsonb; patch jsonb; rows jsonb:='[]';
 digest text; at_cursor bigint; to_cursor bigint; new_revision bigint; b jsonb; a jsonb; delta jsonb; legacy_delta jsonb;
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
  canonical:=meadow_private.apply_farm_receipt(canonical,r);
  a:=meadow_private.farm_balances(canonical);delta:=meadow_private.farm_balance_delta(b,a);
  insert into meadow_private.farm_reward_deliveries(receipt_id,user_id,revision) values(r.id,u,new_revision);
  insert into meadow_private.farm_economy_journal(user_id,revision,lane,source_id,changes,balance_hash)
   values(u,new_revision,'server_receipt',r.id::text,delta,encode(sha256(convert_to(a::text,'UTF8')),'hex'));
  rows:=rows||jsonb_build_array(jsonb_build_object('id',r.id,'kind',r.kind,'created_at',r.created_at,'delivery',r.delivery));
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
revoke all on function meadow_private.commit_economy_save(bigint,jsonb,uuid) from public,anon;
grant execute on function meadow_private.commit_economy_save(bigint,jsonb,uuid) to authenticated;
create function public.meadow_market_commit_economy_save(p_expected_revision bigint,p_save_data jsonb,p_write_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select meadow_private.commit_economy_save(p_expected_revision,p_save_data,p_write_id)$$;
revoke all on function public.meadow_market_commit_economy_save(bigint,jsonb,uuid) from public,anon;
grant execute on function public.meadow_market_commit_economy_save(bigint,jsonb,uuid) to authenticated;
comment on table meadow_private.farm_economy_journal is 'Meadow Markets test economy audit. legacy_* rows are NOT validated earnings; server_receipt rows are atomic fixed server deliveries. Individual farm action authority is still pending.';

create function meadow_private.farm_ledger() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 if u is null then raise exception 'Sign in to view your farm ledger' using errcode='28000';end if;
 select jsonb_build_object('revision',s.revision,'balances',meadow_private.farm_balances(s.save_data),'enrolled',s.save_protocol>=3,
  'pending',(select count(*) from public.meadow_market_economy_receipts e where e.user_id=u and not exists(select 1 from meadow_private.farm_reward_deliveries d where d.receipt_id=e.id)),
  'entries',(select coalesce(jsonb_agg(to_jsonb(t) order by t.revision desc,t.created_at desc),'[]') from (
   select j.revision,j.lane,j.changes,j.created_at from meadow_private.farm_economy_journal j where j.user_id=u order by j.revision desc,j.created_at desc limit 25
  ) t)) into result from public.meadow_market_saves s where s.user_id=u;
 return coalesce(result,'{"entries":[],"enrolled":false,"pending":0}');
end $$;
revoke all on function meadow_private.farm_ledger() from public,anon;
grant execute on function meadow_private.farm_ledger() to authenticated;
create function public.meadow_market_farm_ledger() returns jsonb language sql security invoker set search_path='' as $$ select meadow_private.farm_ledger() $$;
revoke all on function public.meadow_market_farm_ledger() from public,anon;
grant execute on function public.meadow_market_farm_ledger() to authenticated;
