-- Extend only the existing expiring provider-test lane to the three new keepsakes.
alter table meadow_private.play_license_acceptance drop constraint play_license_acceptance_product_ids_check;
alter table meadow_private.play_license_acceptance add constraint play_license_acceptance_product_ids_check check(cardinality(product_ids) between 1 and 3 and product_ids <@ array['mm_pocket_gems','mm_premium','mm_welcome_garden','mm_coop_charm','mm_market_makeover']::text[]);
create or replace function public.meadow_market_claim_test_story_pack(p_sku text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p meadow_private.store_products;rid uuid;
begin
 perform meadow_private.control_guard('play');
 if u is null or not exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now()) or meadow_private.play_license_test_allowed(u) then raise exception 'Approved free test accounts only' using errcode='42501';end if;
 if p_sku not in ('welcome_garden','coop_charm','market_makeover') then raise exception 'Unknown keepsake';end if;
 select * into p from meadow_private.store_products where sku=p_sku;
 if not found or not (p.delivery ? 'collectible') then raise exception 'Keepsake unavailable';end if;
 insert into public.meadow_market_wallets(user_id) values(u) on conflict do nothing;
 perform 1 from public.meadow_market_wallets where user_id=u for update;
 insert into public.meadow_market_collectibles(user_id,item_id,source) values(u,p.delivery->>'collectible','story_pack_test') on conflict do nothing;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery) values(u,gen_random_uuid(),'story_pack_test','story_pack_test:'||p_sku,jsonb_build_object('collectible',p.delivery->>'collectible')) on conflict do nothing returning id into rid;
 return jsonb_build_object('owned',true,'test',true);
end $$;
revoke all on function public.meadow_market_claim_test_story_pack(text) from public,anon,service_role;
grant execute on function public.meadow_market_claim_test_story_pack(text) to authenticated;
comment on function public.meadow_market_claim_test_story_pack(text) is 'Meadow Markets approved free-test keepsakes only; never verifies or simulates a Google Play order.';
