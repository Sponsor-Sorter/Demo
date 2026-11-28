-- Meadow Markets only. December gem bundles have fixed, published contents.
-- Existing verified gem balances and collectible ownership are reused.
insert into public.meadow_market_collection_catalog(id,definition) values
 ('collection_xmas_globe','{"id":"collection_xmas_globe","name":"Starlight snow globe","purchaseOnly":true,"price":35,"w":1,"h":1,"theme":"christmas","rarity":"seasonal","art":"assets/generated/christmas267/christmas-snowglobe.webp"}'),
 ('collection_xmas_pavilion','{"id":"collection_xmas_pavilion","name":"Golden bell pavilion","purchaseOnly":true,"price":65,"w":2,"h":2,"theme":"christmas","rarity":"seasonal","art":"assets/generated/christmas267/christmas-pavilion.webp"}')
on conflict(id) do update set definition=excluded.definition;

create or replace function meadow_private.christmas_purchase267(p_item text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); w public.meadow_market_wallets; r public.meadow_market_economy_receipts;
 price int; contents jsonb; event_at timestamptz:=clock_timestamp();
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then
  raise exception 'Connect your Meadow Markets farm first' using errcode='28000';
 end if;
 perform meadow_private.control_guard('play',u);
 if p_request is null or p_item not in('collection_xmas_globe','collection_xmas_pavilion') or p_item is null then raise exception 'Choose a current Christmas bundle';end if;
 insert into public.meadow_market_wallets(user_id) values(u) on conflict do nothing;
 select * into w from public.meadow_market_wallets where user_id=u for update;
 select * into r from public.meadow_market_economy_receipts where user_id=u and request_id=p_request;
 if found then
  if r.kind<>'christmas_purchase267' or r.delivery->>'collectible' is distinct from p_item then raise exception 'This request belongs to another action';end if;
  return jsonb_build_object('ok',true,'item',p_item,'replayed',true);
 end if;
 if event_at<'2026-12-01T00:00:00Z'::timestamptz or event_at>='2027-01-01T00:00:00Z'::timestamptz then raise exception 'Christmas bundles are available 1–31 December 2026 (UTC)';end if;
 if exists(select 1 from public.meadow_market_collectibles where user_id=u and item_id=p_item) then raise exception 'You already own this Christmas decoration';end if;
 if p_item='collection_xmas_globe' then
  price:=35;contents:='{"gold":400,"items":{"wheat":8,"apple":4}}';
 else
  price:=65;contents:='{"gold":900,"items":{"wheat":12,"egg":8}}';
 end if;
 if w.gems<price then raise exception 'NOT_ENOUGH_GEMS';end if;
 update public.meadow_market_wallets set gems=gems-price,vip_xp=vip_xp+price,updated_at=now() where user_id=u;
 insert into public.meadow_market_collectibles(user_id,item_id,source) values(u,p_item,'christmas2026_gems');
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery)
 values(u,p_request,'christmas_purchase267','christmas2026:'||p_item,contents||jsonb_build_object('collectible',p_item,'gems_spent',price));
 return jsonb_build_object('ok',true,'item',p_item,'spent',price,'replayed',false);
end $$;
revoke all on function meadow_private.christmas_purchase267(text,uuid) from public,anon;
grant execute on function meadow_private.christmas_purchase267(text,uuid) to authenticated;
create or replace function public.meadow_market_christmas_purchase267(p_item text,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select meadow_private.christmas_purchase267(p_item,p_request);
$$;
revoke all on function public.meadow_market_christmas_purchase267(text,uuid) from public,anon;
grant execute on function public.meadow_market_christmas_purchase267(text,uuid) to authenticated;
