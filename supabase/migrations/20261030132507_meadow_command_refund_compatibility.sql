-- Preserve verified refunds when a farm eventually enters command-only protocol4.
-- No cohort enrollment or storefront activation occurs here.
alter table meadow_private.farm_economy_journal drop constraint farm_economy_journal_lane_check;
alter table meadow_private.farm_economy_journal add constraint farm_economy_journal_lane_check
 check(lane in ('legacy_baseline','legacy_snapshot','server_receipt','verified_action','server_refund'));

create function meadow_private.write_verified_refund(p_user uuid,p_save jsonb,p_source text) returns void
language plpgsql security invoker set search_path='' as $$
declare previous_owner text:=current_setting('meadow.command_owner',true); at_revision bigint;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 if p_user is null or p_source is null or p_source!~'^[a-f0-9]{64}$' then raise exception 'Invalid refund source' using errcode='22023';end if;
 -- Called ONLY after the existing refund RPC verified and locked its stored
 -- purchase, wallet and save. The marker is never accepted from a game client.
 perform set_config('meadow.command_owner',p_user::text,true);
 update public.meadow_market_saves set save_data=p_save where user_id=p_user returning revision into at_revision;
 perform set_config('meadow.command_owner',coalesce(previous_owner,''),true);
 update meadow_private.farm_economy_journal set lane='server_refund',source_id=p_source
  where user_id=p_user and revision=at_revision and lane='legacy_snapshot';
exception when others then
 perform set_config('meadow.command_owner',coalesce(previous_owner,''),true);
 raise;
end $$;
revoke all on function meadow_private.write_verified_refund(uuid,jsonb,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.meadow_market_revoke_store_purchase(p_token_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r meadow_private.store_purchases; p meadow_private.store_products; e public.meadow_market_economy_receipts;
 saved public.meadow_market_saves; s jsonb; home text; f record; item record; bag jsonb;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_token_hash,0));
 select * into r from meadow_private.store_purchases where token_hash=p_token_hash;
 if not found then return false;end if;
 if r.revoked_at is not null then return true;end if;
 perform 1 from public.meadow_market_wallets where user_id=r.user_id for update;
 select * into saved from public.meadow_market_saves where user_id=r.user_id for update;
 select * into p from meadow_private.store_products where product_id=r.product_id;
 select * into e from public.meadow_market_economy_receipts where id=r.receipt_id;
 update meadow_private.store_purchases set revoked_at=now() where token_hash=p_token_hash;
 update public.meadow_market_wallets set gems=greatest(0,gems-coalesce((r.benefits->>'gems')::int,p.gems)),reward_turns=greatest(0,reward_turns-coalesce((r.benefits->>'turns')::int,p.turns)),vip_xp=greatest(0,vip_xp-coalesce((r.benefits->>'gems')::int,p.gems)),updated_at=now() where user_id=r.user_id;
 if p.premium then
  update public.meadow_market_wallets set premium=exists(select 1 from meadow_private.store_purchases a join meadow_private.store_products b on b.product_id=a.product_id where a.user_id=r.user_id and a.revoked_at is null and b.premium)
   or exists(select 1 from meadow_private.support_grants g where g.user_id=r.user_id and g.body->>'premium'='true') where user_id=r.user_id;
 end if;
 -- Prevent an uncollected refunded bundle arriving at the next farm save.
 if not exists(select 1 from meadow_private.farm_reward_deliveries where receipt_id=r.receipt_id) then
  update public.meadow_market_economy_receipts set delivery='{}' where id=r.receipt_id;
 elsif saved.user_id is not null then
  s:=jsonb_set(saved.save_data,'{coins}',to_jsonb(greatest(0,coalesce((saved.save_data->>'coins')::numeric,0)-coalesce((e.delivery->>'gold')::numeric,0))));
  home:=case when s->>'sharedPantryVersion'='1' then 'willow' when s->'farms' ? (e.delivery->>'map') then e.delivery->>'map' else s->>'active' end;
  bag:=coalesce(s->'farms'->home->'inventory','{}');
  for item in select key,value from jsonb_each(coalesce(e.delivery->'items','{}')) loop bag:=jsonb_set(bag,array[item.key],to_jsonb(greatest(0,coalesce((bag->>item.key)::int,0)-(item.value::text)::int)));end loop;
  s:=jsonb_set(s,array['farms',home,'inventory'],bag);
  if s->>'sharedPantryVersion'='1' then
   for f in select key from jsonb_each(s->'farms') loop s:=jsonb_set(s,array['farms',f.key,'inventory'],bag);end loop;
   s:=jsonb_set(s,'{inventory}',bag);
  end if;
  perform meadow_private.write_verified_refund(r.user_id,s,r.token_hash);
 end if;
 -- Spent consumables need review; no repeated refund/purchase loop is permitted.
 insert into meadow_private.store_review_holds(user_id,reason) values(r.user_id,'Google Play refund; review remaining virtual goods before another purchase') on conflict do nothing;
 return true;
end $function$
