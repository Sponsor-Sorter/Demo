-- Meadow Markets only. Public clients cannot authorize purchases or grants.
create table if not exists meadow_private.commerce_config (
 id boolean primary key default true check(id), payments_enabled boolean not null default false,
 ads_enabled boolean not null default false, production_ready boolean not null default false
);
insert into meadow_private.commerce_config(id) values(true) on conflict do nothing;
create table if not exists meadow_private.test_access (
 user_id uuid primary key references public.meadow_market_profiles(user_id) on delete cascade,
 reason text not null, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists meadow_private.store_products (
 sku text primary key, product_id text unique not null, gems integer not null default 0 check(gems>=0),
 turns integer not null default 0 check(turns>=0), delivery jsonb not null default '{}',
 premium boolean not null default false, consumable boolean not null default true,
 enabled boolean not null default false
);
insert into meadow_private.store_products(sku,product_id,gems,turns,delivery,premium,consumable) values
 ('pocket_gems','mm_pocket_gems',100,0,'{}',false,true),
 ('gem_chest','mm_gem_chest',550,0,'{}',false,true),
 ('starter_pack','mm_starter_pack',150,0,'{"gold":1000,"items":{"wheat":15,"carrot":15,"milk":5,"egg":5}}',false,true),
 ('builders_pack','mm_builders_pack',300,0,'{"gold":3000}',false,true),
 ('reward_tickets','mm_reward_tickets',0,5,'{}',false,true),
 ('pantry_pack','mm_pantry_pack',0,0,'{"items":{"wheat":20,"milk":10,"egg":10,"apple":10,"flour":10}}',false,true),
 ('premium','mm_premium',0,0,'{}',true,false)
 on conflict(sku) do nothing;
create table if not exists meadow_private.store_purchases (
 token_hash text primary key, user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 product_id text not null, receipt_id uuid not null references public.meadow_market_economy_receipts(id),
 order_id text, test_purchase boolean not null, settled boolean not null default false,
 revoked_at timestamptz, created_at timestamptz not null default now()
);
alter table meadow_private.store_purchases add column if not exists benefits jsonb not null default '{}';
create table if not exists meadow_private.support_grants (
 request_id uuid primary key, user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 reason text not null, body jsonb not null, receipt_id uuid not null references public.meadow_market_economy_receipts(id),
 created_at timestamptz not null default now()
);
create table if not exists meadow_private.store_review_holds (
 user_id uuid primary key references public.meadow_market_profiles(user_id) on delete cascade,
 reason text not null, created_at timestamptz not null default now()
);
create table if not exists meadow_private.account_deletions (
 user_id uuid primary key references public.meadow_market_profiles(user_id) on delete cascade,
 requested_at timestamptz not null default now(), execute_after timestamptz not null default now()+interval '7 days'
);
create table if not exists meadow_private.deleted_game_accounts (
 account_hash text primary key, deleted_at timestamptz not null default now()
);
create table if not exists meadow_private.farm_backups (
 user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 backup_day date not null default current_date, revision bigint not null, save_data jsonb not null,
 created_at timestamptz not null default now(), primary key(user_id,backup_day)
);
create table if not exists meadow_private.diagnostics (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 build integer not null, module text not null, line integer not null, category text not null,
 created_at timestamptz not null default now()
);
create table if not exists meadow_private.ad_rewards (
 nonce uuid primary key default gen_random_uuid(), user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '15 minutes',
 transaction_id text unique, receipt_id uuid references public.meadow_market_economy_receipts(id) on delete cascade
);
create index if not exists meadow_ad_rewards_owner_time on meadow_private.ad_rewards(user_id,created_at);
create index if not exists meadow_diagnostics_owner_time on meadow_private.diagnostics(user_id,created_at);
create index if not exists meadow_store_purchases_owner on meadow_private.store_purchases(user_id);
create index if not exists meadow_support_grants_owner on meadow_private.support_grants(user_id);
create index if not exists meadow_store_purchases_receipt on meadow_private.store_purchases(receipt_id);
create index if not exists meadow_support_grants_receipt on meadow_private.support_grants(receipt_id);
alter table meadow_private.commerce_config enable row level security;
alter table meadow_private.test_access enable row level security;
alter table meadow_private.store_products enable row level security;
alter table meadow_private.store_purchases enable row level security;
alter table meadow_private.support_grants enable row level security;
alter table meadow_private.store_review_holds enable row level security;
alter table meadow_private.account_deletions enable row level security;
alter table meadow_private.deleted_game_accounts enable row level security;
alter table meadow_private.farm_backups enable row level security;
alter table meadow_private.diagnostics enable row level security;
alter table meadow_private.ad_rewards enable row level security;
revoke all on meadow_private.commerce_config,meadow_private.test_access,meadow_private.store_products,meadow_private.store_purchases,meadow_private.support_grants,meadow_private.account_deletions from public,anon,authenticated;
revoke all on meadow_private.farm_backups,meadow_private.diagnostics from public,anon,authenticated;
revoke all on meadow_private.ad_rewards from public,anon,authenticated;
revoke all on meadow_private.deleted_game_accounts from public,anon,authenticated;
revoke all on meadow_private.store_review_holds from public,anon,authenticated;

create or replace function meadow_private.commerce_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c meadow_private.commerce_config; tester boolean;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Sign in to Meadow Markets' using errcode='28000';end if;
 select * into c from meadow_private.commerce_config where id;
 tester:=exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now());
 return jsonb_build_object('test_access',tester,'payments_enabled',c.payments_enabled and c.production_ready,'ads_enabled',c.ads_enabled and c.production_ready,
 'account_id',encode(sha256(convert_to('meadow-markets:'||u::text,'UTF8')),'hex'),
 'products',(select coalesce(jsonb_agg(jsonb_build_object('sku',sku,'product_id',product_id,'consumable',consumable)),'[]') from meadow_private.store_products where enabled));
end $$;
revoke all on function meadow_private.commerce_status() from public,anon;
grant execute on function meadow_private.commerce_status() to authenticated;
create or replace function public.meadow_market_commerce_status() returns jsonb language sql security invoker set search_path='' as $$select meadow_private.commerce_status()$$;
revoke all on function public.meadow_market_commerce_status() from public,anon;
grant execute on function public.meadow_market_commerce_status() to authenticated;

-- Existing public RPC remains compatible, with free packs restricted to named testers.
-- Install the wrapper after renaming the existing implementation once.
do $$begin
 if to_regprocedure('meadow_private.play_service_before_store(text,jsonb)') is null then
  alter function meadow_private.play_service(text,jsonb) rename to play_service_before_store;
 end if;
end $$;
revoke all on function meadow_private.play_service_before_store(text,jsonb) from public,anon,authenticated;
create or replace function meadow_private.play_service(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r jsonb;
begin
 if u is null then raise exception 'Sign in first' using errcode='28000';end if;
 if exists(select 1 from meadow_private.account_deletions where user_id=u) then raise exception 'Account deletion is pending. Cancel it in Settings to resume.';end if;
 if p_action in ('purchase','ad_reward') and not exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now()) then
  raise exception 'Use Google Play for purchases. Free test packs are available only to approved test accounts.' using errcode='42501';
 end if;
 r:=meadow_private.play_service_before_store(p_action,p_data);
 return r||jsonb_build_object('commerce',meadow_private.commerce_status());
end $$;
revoke all on function meadow_private.play_service(text,jsonb) from public,anon;
grant execute on function meadow_private.play_service(text,jsonb) to authenticated;
create or replace function public.meadow_market_play_service(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select meadow_private.play_service(p_action,p_data)$$;

do $$begin
 if to_regprocedure('meadow_private.reward_round_before_store(text,jsonb)') is null then alter function meadow_private.reward_round(text,jsonb) rename to reward_round_before_store;end if;
end $$;
revoke all on function meadow_private.reward_round_before_store(text,jsonb) from public,anon,authenticated;
create or replace function meadow_private.reward_round(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); preview boolean;
begin
 if u is null then raise exception 'Sign in first';end if;
 if exists(select 1 from meadow_private.account_deletions where user_id=u) then raise exception 'Account deletion is pending';end if;
 preview:=p_data->>'game'='ad' or exists(select 1 from meadow_private.reward_rounds where user_id=u and id=(p_data->>'id')::uuid and game='ad');
 if preview and not exists(select 1 from meadow_private.test_access where user_id=u and expires_at>now()) then raise exception 'Real ad rewards require provider verification' using errcode='42501';end if;
 return meadow_private.reward_round_before_store(p_action,p_data);
end $$;
revoke all on function meadow_private.reward_round(text,jsonb) from public,anon;
grant execute on function meadow_private.reward_round(text,jsonb) to authenticated;
create or replace function public.meadow_market_reward_round(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select meadow_private.reward_round(p_action,p_data)$$;

create or replace function meadow_private.start_ad_reward() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n uuid;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Sign in first';end if;
 if not exists(select 1 from meadow_private.commerce_config where id and ads_enabled and production_ready) then raise exception 'Ads are not enabled';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,195));
 if exists(select 1 from meadow_private.account_deletions where user_id=u) then raise exception 'Account unavailable';end if;
 if (select count(*) from meadow_private.ad_rewards where user_id=u and created_at>now()-interval '1 hour')>=10 then raise exception 'Please try later';end if;
 if (select count(*) from meadow_private.ad_rewards where user_id=u and receipt_id is not null and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=3 then raise exception 'Three daily ad rewards already collected';end if;
 insert into meadow_private.ad_rewards(user_id) values(u) returning nonce into n;
 return jsonb_build_object('nonce',n);
end $$;
revoke all on function meadow_private.start_ad_reward() from public,anon;
grant execute on function meadow_private.start_ad_reward() to authenticated;
create or replace function public.meadow_market_start_ad_reward() returns jsonb language sql security invoker set search_path='' as $$select meadow_private.start_ad_reward()$$;
revoke all on function public.meadow_market_start_ad_reward() from public,anon;
grant execute on function public.meadow_market_start_ad_reward() to authenticated;

create or replace function public.meadow_market_finish_ad_reward(p_nonce uuid,p_account text,p_transaction text,p_at timestamptz) returns boolean language plpgsql security definer set search_path='' as $$
declare r meadow_private.ad_rewards; rid uuid;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 if p_transaction is null or length(p_transaction) not between 8 and 256 or p_at is null then raise exception 'Invalid ad reward';end if;
 select * into r from meadow_private.ad_rewards where nonce=p_nonce for update;
 if not found or p_account is distinct from encode(sha256(convert_to('meadow-markets:'||r.user_id::text,'UTF8')),'hex') then raise exception 'Ad account mismatch';end if;
 if r.receipt_id is not null then if r.transaction_id<>p_transaction then raise exception 'Ad nonce reused';end if;return true;end if;
 if p_at<r.created_at-interval '1 minute' or p_at>r.expires_at or clock_timestamp()>r.created_at+interval '24 hours' then raise exception 'Ad reward expired';end if;
 insert into public.meadow_market_wallets(user_id) values(r.user_id) on conflict do nothing;
 perform 1 from public.meadow_market_wallets where user_id=r.user_id for update;
 if exists(select 1 from meadow_private.account_deletions where user_id=r.user_id) then raise exception 'Account unavailable';end if;
 if (select count(*) from meadow_private.ad_rewards where user_id=r.user_id and receipt_id is not null and created_at>=date_trunc('day',r.created_at at time zone 'UTC') at time zone 'UTC')>=3 then raise exception 'Daily ad reward limit';end if;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery) values(r.user_id,p_nonce,'admob_reward','admob:'||p_transaction,'{}') returning id into rid;
 update public.meadow_market_wallets set gems=gems+5,reward_turns=reward_turns+1,updated_at=now() where user_id=r.user_id;
 update meadow_private.ad_rewards set transaction_id=p_transaction,receipt_id=rid where nonce=p_nonce;
 return true;
end $$;
revoke all on function public.meadow_market_finish_ad_reward(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.meadow_market_finish_ad_reward(uuid,text,text,timestamptz) to service_role;

-- Backend-only: caller verifies Google before reaching this function.
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
revoke all on function public.meadow_market_deliver_store_purchase(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.meadow_market_deliver_store_purchase(uuid,text,text,text,boolean) to service_role;

create or replace function public.meadow_market_settle_store_purchase(p_token_hash text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 update meadow_private.store_purchases set settled=true where token_hash=p_token_hash and revoked_at is null;
 return found;
end $$;
revoke all on function public.meadow_market_settle_store_purchase(text) from public,anon,authenticated;
grant execute on function public.meadow_market_settle_store_purchase(text) to service_role;

create or replace function public.meadow_market_store_purchase_owner(p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r meadow_private.store_purchases;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 select * into r from meadow_private.store_purchases where token_hash=p_token_hash;
 if not found then return null;end if;
 return jsonb_build_object('user_id',r.user_id,'product_id',r.product_id,'revoked',r.revoked_at is not null);
end $$;
revoke all on function public.meadow_market_store_purchase_owner(text) from public,anon,authenticated;
grant execute on function public.meadow_market_store_purchase_owner(text) to service_role;

create or replace function public.meadow_market_revoke_store_purchase(p_token_hash text) returns boolean language plpgsql security definer set search_path='' as $$
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
  update public.meadow_market_saves set save_data=s where user_id=r.user_id;
 end if;
 -- Spent consumables need review; no repeated refund/purchase loop is permitted.
 insert into meadow_private.store_review_holds(user_id,reason) values(r.user_id,'Google Play refund; review remaining virtual goods before another purchase') on conflict do nothing;
 return true;
end $$;
revoke all on function public.meadow_market_revoke_store_purchase(text) from public,anon,authenticated;
grant execute on function public.meadow_market_revoke_store_purchase(text) to service_role;

create or replace function public.meadow_market_support_grant(p_request uuid,p_user uuid,p_gems int,p_gold int,p_turns int,p_premium boolean,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare prior meadow_private.support_grants; body jsonb; rid uuid;
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' then raise exception 'Backend only' using errcode='42501';end if;
 if p_request is null or p_gems is null or p_gems not between 0 and 100000 or p_gold is null or p_gold not between 0 and 1000000 or p_turns is null or p_turns not between 0 and 10000 or p_premium is null or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Invalid support grant';end if;
 if not exists(select 1 from public.meadow_market_profiles where user_id=p_user) then raise exception 'Unknown farm';end if;
 body:=jsonb_build_object('gems',p_gems,'gold',p_gold,'turns',p_turns,'premium',p_premium,'reason',trim(p_reason));
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into prior from meadow_private.support_grants where request_id=p_request;
 if found then if prior.user_id<>p_user or prior.body<>body then raise exception 'Grant request reused';end if;return prior.receipt_id;end if;
 insert into public.meadow_market_wallets(user_id) values(p_user) on conflict do nothing;
 perform 1 from public.meadow_market_wallets where user_id=p_user for update;
 insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery) values(p_user,p_request,'support_grant','support:'||p_request::text,jsonb_build_object('gold',p_gold)) returning id into rid;
 update public.meadow_market_wallets set gems=gems+p_gems,reward_turns=reward_turns+p_turns,premium=premium or p_premium,updated_at=now() where user_id=p_user;
 insert into meadow_private.support_grants values(p_request,p_user,trim(p_reason),body,rid,now());
 return rid;
end $$;
revoke all on function public.meadow_market_support_grant(uuid,uuid,int,int,int,boolean,text) from public,anon,authenticated;
grant execute on function public.meadow_market_support_grant(uuid,uuid,int,int,int,boolean,text) to service_role;

-- Cancellation window avoids an accidental irreversible deletion from one tap.
create or replace function meadow_private.account_deletion(p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); d meadow_private.account_deletions;
begin
 if u is null then raise exception 'Sign in to your farm' using errcode='28000';end if;
 if exists(select 1 from meadow_private.deleted_game_accounts where account_hash=encode(sha256(convert_to('meadow-deleted:'||u::text,'UTF8')),'hex')) then return '{"deleted":true,"pending":false}'::jsonb;end if;
 if not exists(select 1 from public.meadow_market_profiles where user_id=u) then return '{"pending":false}'::jsonb;end if;
 if p_action='request' then insert into meadow_private.account_deletions(user_id) values(u) on conflict do nothing;
 elsif p_action='cancel' then delete from meadow_private.account_deletions where user_id=u;
 elsif p_action<>'status' then raise exception 'Unknown account action';end if;
 select * into d from meadow_private.account_deletions where user_id=u;
 return jsonb_build_object('pending',d.user_id is not null,'execute_after',d.execute_after);
end $$;
revoke all on function meadow_private.account_deletion(text) from public,anon;
grant execute on function meadow_private.account_deletion(text) to authenticated;
create or replace function public.meadow_market_account_deletion(p_action text default 'status') returns jsonb language sql security invoker set search_path='' as $$select meadow_private.account_deletion(p_action)$$;
revoke all on function public.meadow_market_account_deletion(text) from public,anon;
grant execute on function public.meadow_market_account_deletion(text) to authenticated;

-- A game-only erasure job: no shared auth user or another app is deleted here.
-- A private technical Auth principal can be shared by other games; the removed
-- game username and recovery records can no longer authenticate this game account.
create or replace function meadow_private.erase_due_game_accounts() returns integer language plpgsql security definer set search_path='' as $$
declare candidate record; n integer:=0;
begin
 for candidate in select user_id from meadow_private.account_deletions where execute_after<=clock_timestamp() order by execute_after limit 100 for update skip locked loop
  insert into meadow_private.deleted_game_accounts(account_hash) values(encode(sha256(convert_to('meadow-deleted:'||candidate.user_id::text,'UTF8')),'hex')) on conflict do nothing;
  delete from public.meadow_market_friendships where requester_id=candidate.user_id or recipient_id=candidate.user_id;
  delete from public.meadow_market_saves where user_id=candidate.user_id;
  delete from public.meadow_market_accounts where user_id=candidate.user_id;
  delete from public.meadow_market_profiles where user_id=candidate.user_id;
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function meadow_private.erase_due_game_accounts() from public,anon,authenticated;

create or replace function meadow_private.reject_deleted_farm() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from meadow_private.deleted_game_accounts where account_hash=encode(sha256(convert_to('meadow-deleted:'||new.user_id::text,'UTF8')),'hex')) then raise exception 'This Meadow Markets account has been deleted. Start a new guest farm.' using errcode='42501';end if;
 return new;
end $$;
revoke all on function meadow_private.reject_deleted_farm() from public,anon,authenticated;
drop trigger if exists meadow_reject_deleted_farm on public.meadow_market_profiles;
create trigger meadow_reject_deleted_farm before insert on public.meadow_market_profiles for each row execute function meadow_private.reject_deleted_farm();

create or replace function meadow_private.maintain_game_accounts() returns jsonb language plpgsql security definer set search_path='' as $$
declare removed integer; backed integer;
begin
 removed:=meadow_private.erase_due_game_accounts();
 insert into meadow_private.farm_backups(user_id,backup_day,revision,save_data)
  select s.user_id,current_date,s.revision,s.save_data from public.meadow_market_saves s join public.meadow_market_profiles p using(user_id)
  where not exists(select 1 from meadow_private.farm_backups b where b.user_id=s.user_id and b.backup_day=current_date)
  order by s.updated_at desc limit 100 on conflict do nothing;
 get diagnostics backed=row_count;
 delete from meadow_private.farm_backups where created_at<now()-interval '30 days';
 delete from meadow_private.diagnostics where created_at<now()-interval '30 days';
 return jsonb_build_object('deleted',removed,'backed_up',backed);
end $$;
revoke all on function meadow_private.maintain_game_accounts() from public,anon,authenticated;

create or replace function meadow_private.diagnostic_event(p_build int,p_module text,p_line int,p_category text) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then return false;end if;
 if p_build not between 1 and 999999 or p_build is null or p_module is null or p_module !~ '^[a-z0-9-]{1,60}\.js$' or p_line is null or p_line not between 0 and 1000000 or p_category is null or p_category not in ('runtime','promise') then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,194));
 if (select count(*) from meadow_private.diagnostics where user_id=u and created_at>now()-interval '1 hour')>=20 then return false;end if;
 insert into meadow_private.diagnostics(user_id,build,module,line,category) values(u,p_build,p_module,p_line,p_category);
 return true;
end $$;
revoke all on function meadow_private.diagnostic_event(int,text,int,text) from public,anon;
grant execute on function meadow_private.diagnostic_event(int,text,int,text) to authenticated;
create or replace function public.meadow_market_diagnostic_event(p_build int,p_module text,p_line int,p_category text) returns boolean language sql security invoker set search_path='' as $$select meadow_private.diagnostic_event(p_build,p_module,p_line,p_category)$$;
revoke all on function public.meadow_market_diagnostic_event(int,text,int,text) from public,anon;
grant execute on function public.meadow_market_diagnostic_event(int,text,int,text) to authenticated;

-- Named legacy test accounts keep test access. New accounts never inherit it.
insert into meadow_private.test_access(user_id,reason,expires_at)
 select user_id,'Owner-approved browser and Samsung playtest',now()+interval '180 days'
 from public.meadow_market_accounts where username in ('test_browser','test_phone')
 on conflict(user_id) do nothing;
