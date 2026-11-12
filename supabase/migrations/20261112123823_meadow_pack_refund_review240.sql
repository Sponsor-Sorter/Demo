-- Packs now include consumables. Preserve ordinary unused-pack refunds, but
-- prevent repeated refund/rebuy extraction of used boosters or spent gems.
create or replace function public.meadow_market_revoke_store_purchase(p_token_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare answer boolean;u uuid;s jsonb;g jsonb;r meadow_private.store_purchases;
 at_ms bigint:=floor(extract(epoch from now())*1000);review_consumed boolean:=false;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_token_hash,0));
 select * into r from meadow_private.store_purchases where token_hash=p_token_hash;
 u:=r.user_id;
 perform 1 from public.meadow_market_wallets where user_id=u for update;
 select save_data into s from public.meadow_market_saves where user_id=u for update;
 if r.revoked_at is null and exists(select 1 from meadow_private.store_products where product_id=r.product_id and sku in ('welcome_garden','coop_charm','market_makeover')) then
  review_consumed:=coalesce((select gems<coalesce((r.benefits->>'gems')::int,0) from public.meadow_market_wallets where user_id=u),false)
   or exists(select 1 from meadow_private.pack_benefit_grants b where b.user_id=u and b.source='play:'||p_token_hash and coalesce((s#>>array['packBenefits','used',b.id::text])::int,0)>0);
 end if;
 answer:=meadow_private.revoke_store_purchase239(p_token_hash);
 if not answer then return false;end if;
 update meadow_private.pack_benefit_grants set revoked_at=coalesce(revoked_at,now()) where user_id=u and source='play:'||p_token_hash;
 select save_data into s from public.meadow_market_saves where user_id=u for update;
 if s ? 'packBenefits' then
  g:=meadow_private.pack_grants240(u);
  s:=jsonb_set(s,'{packBenefits,grants}',g);
  s:=jsonb_set(s,'{packBenefits,windows}',coalesce((select jsonb_agg(
   case when exists(select 1 from meadow_private.pack_benefit_grants b where b.id::text=w->>'grant' and b.revoked_at is not null)
    then jsonb_set(w,'{until}',to_jsonb(least(coalesce((w->>'until')::bigint,at_ms),at_ms))) else w end)
   from jsonb_array_elements(coalesce(s#>'{packBenefits,windows}','[]')) w),'[]'));
  perform meadow_private.write_verified_refund(u,s,p_token_hash);
 end if;
 if review_consumed then
  insert into meadow_private.store_review_holds(user_id,reason) values(u,'Refunded pack contained used boosters or spent gems; review consumed benefits before another purchase') on conflict do nothing;
 end if;
 return true;
end $$;
revoke all on function public.meadow_market_revoke_store_purchase(text) from public,anon,authenticated;
grant execute on function public.meadow_market_revoke_store_purchase(text) to service_role;
