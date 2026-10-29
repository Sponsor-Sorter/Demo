-- Meadow Markets only. Preserve existing grants and closed commerce flags.
create or replace function meadow_private.commerce_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c meadow_private.commerce_config; tester boolean;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Sign in to Meadow Markets' using errcode='28000';end if;
 select * into c from meadow_private.commerce_config where id;
 tester:=exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now());
 return jsonb_build_object('test_access',tester,'payments_enabled',c.payments_enabled and c.production_ready,'ads_enabled',c.ads_enabled and c.production_ready,
 'purchase_account_ready',exists(select 1 from public.meadow_market_accounts a join auth.users au on au.id=a.user_id where a.user_id=u and a.ready and au.is_anonymous is false),
 'account_id',encode(sha256(convert_to('meadow-markets:'||u::text,'UTF8')),'hex'),
 'products',(select coalesce(jsonb_agg(jsonb_build_object('sku',sku,'product_id',product_id,'consumable',consumable)),'[]') from meadow_private.store_products where enabled));
end $$;

create or replace function public.meadow_market_deliver_store_purchase(p_user uuid,p_product text,p_token_hash text,p_order text,p_test boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p meadow_private.store_products; prior meadow_private.store_purchases; rid uuid; w public.meadow_market_wallets; c meadow_private.commerce_config;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 if p_token_hash !~ '^[a-f0-9]{64}$' or p_test is null then raise exception 'Invalid purchase';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_token_hash,0));
 select * into prior from meadow_private.store_purchases where token_hash=p_token_hash;
 if found then
  if prior.user_id<>p_user or prior.product_id<>p_product or prior.revoked_at is not null then raise exception 'Purchase belongs to another account or was revoked';end if;
  return jsonb_build_object('receipt_id',prior.receipt_id,'duplicate',true,'settled',prior.settled);
 end if;
 select * into c from meadow_private.commerce_config where id;
 if not c.payments_enabled or not c.production_ready then raise exception 'Store not open';end if;
 if not exists(select 1 from public.meadow_market_accounts a join auth.users au on au.id=a.user_id where a.user_id=p_user and a.ready and au.is_anonymous is false) then raise exception 'Protect your farm before purchasing' using errcode='42501';end if;
 if exists(select 1 from meadow_private.store_review_holds where user_id=p_user) then raise exception 'Purchases need a support review after a refund';end if;
 select * into p from meadow_private.store_products where product_id=p_product and enabled;
 if not found then raise exception 'Product unavailable';end if;
 if not exists(select 1 from public.meadow_market_profiles where user_id=p_user) or exists(select 1 from meadow_private.account_deletions where user_id=p_user) then raise exception 'Account unavailable';end if;
 insert into public.meadow_market_wallets(user_id) values(p_user) on conflict do nothing;
 select * into w from public.meadow_market_wallets where user_id=p_user for update;
 if not p.consumable and exists(select 1 from meadow_private.store_purchases where user_id=p_user and product_id=p_product and revoked_at is null) then raise exception 'Product already owned';end if;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery)
 values(p_user,gen_random_uuid(),'play_purchase','play:'||p_token_hash,p.delivery) returning id into rid;
 update public.meadow_market_wallets set gems=gems+p.gems,reward_turns=reward_turns+p.turns,vip_xp=vip_xp+p.gems,premium=premium or p.premium,updated_at=now() where user_id=p_user;
 insert into meadow_private.store_purchases(token_hash,user_id,product_id,receipt_id,order_id,test_purchase,benefits) values(p_token_hash,p_user,p_product,rid,p_order,p_test,jsonb_build_object('gems',p.gems,'turns',p.turns,'premium',p.premium,'delivery',p.delivery));
 return jsonb_build_object('receipt_id',rid,'duplicate',false,'settled',false);
end $$;
