-- Littles-only billing. No main-game wallet, receipt or entitlement is modified.
create table meadow_littles_private.play_config (
 singleton boolean primary key default true check(singleton),
 checkout_enabled boolean not null default false,
 ads_enabled boolean not null default false
);
insert into meadow_littles_private.play_config(singleton) values(true);
create table meadow_littles_private.play_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 account_hash text unique not null check(account_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
create table meadow_littles_private.play_subscriptions (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references meadow_littles_private.play_accounts(user_id) on delete cascade,
 state text not null,
 expires_at timestamptz not null,
 observed_at timestamptz not null,
 is_test boolean not null default false,
 check(state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED','SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_EXPIRED','SUBSCRIPTION_STATE_PENDING','SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'))
);
create index littles_play_subscription_owner on meadow_littles_private.play_subscriptions(user_id, expires_at);
create table meadow_littles_private.play_testers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 reason text not null check(length(reason) between 5 and 500)
);
alter table meadow_littles_private.play_config enable row level security;
alter table meadow_littles_private.play_accounts enable row level security;
alter table meadow_littles_private.play_subscriptions enable row level security;
alter table meadow_littles_private.play_testers enable row level security;
revoke all on meadow_littles_private.play_config,meadow_littles_private.play_accounts,meadow_littles_private.play_subscriptions,meadow_littles_private.play_testers from public,anon,authenticated;
grant usage on schema meadow_littles_private to service_role;
grant all on meadow_littles_private.play_config,meadow_littles_private.play_accounts,meadow_littles_private.play_subscriptions,meadow_littles_private.play_testers to service_role;

create function meadow_littles_private.play_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := meadow_littles_private.require_actor(); parent_ready boolean; account_hash text; paid_until timestamptz; config meadow_littles_private.play_config;
begin
 select not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null into parent_ready from auth.users u where u.id=actor;
 account_hash:=encode(sha256(convert_to('meadow-littles:'||actor::text,'UTF8')),'hex');
 if parent_ready then
  insert into meadow_littles_private.play_accounts(user_id,account_hash) values(actor,account_hash) on conflict(user_id) do nothing;
 end if;
 select max(s.expires_at) into paid_until from meadow_littles_private.play_subscriptions s
 where s.user_id=actor and s.state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED') and s.expires_at>now();
 select * into config from meadow_littles_private.play_config where singleton;
 return jsonb_build_object('user_id',actor,'parent_ready',coalesce(parent_ready,false),'account_id',case when parent_ready then account_hash else null end,
 'paid_active',coalesce(parent_ready and paid_until>now(),false),'paid_until',paid_until,
 'checkout_enabled',config.checkout_enabled,'ads_enabled',config.ads_enabled,'free_daily_rounds',5,'product','ml_plus','base_plan','monthly');
end $$;
revoke all on function meadow_littles_private.play_status() from public,anon;
grant execute on function meadow_littles_private.play_status() to authenticated;
create function public.meadow_littles_play_status() returns jsonb language sql security invoker set search_path='' as $$select meadow_littles_private.play_status()$$;
revoke all on function public.meadow_littles_play_status() from public,anon;
grant execute on function public.meadow_littles_play_status() to authenticated;

create function public.meadow_littles_play_owner(p_account_hash text) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('user_id',a.user_id,'test_allowed',exists(select 1 from meadow_littles_private.play_testers t where t.user_id=a.user_id and t.expires_at>now()))
 from meadow_littles_private.play_accounts a where a.account_hash=p_account_hash
$$;
revoke all on function public.meadow_littles_play_owner(text) from public,anon,authenticated;
grant execute on function public.meadow_littles_play_owner(text) to service_role;

create function public.meadow_littles_play_record(p_user uuid,p_account_hash text,p_token_hash text,p_state text,p_expires timestamptz,p_observed timestamptz,p_test boolean) returns void language plpgsql security invoker set search_path='' as $$
declare prior meadow_littles_private.play_subscriptions;
begin
 if p_observed>now()+interval '2 minutes' or p_observed<now()-interval '5 minutes' or p_expires is null then raise exception 'INVALID_OBSERVATION';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_token_hash,0));
 perform 1 from meadow_littles_private.play_accounts a where a.user_id=p_user and a.account_hash=p_account_hash for update;
 if not found then raise exception 'PURCHASE_ACCOUNT_MISMATCH';end if;
 if p_test and not exists(select 1 from meadow_littles_private.play_testers t where t.user_id=p_user and t.expires_at>now()) then raise exception 'LICENSE_TEST_NOT_ENABLED';end if;
 select * into prior from meadow_littles_private.play_subscriptions where token_hash=p_token_hash for update;
 if found then
  if prior.user_id<>p_user then raise exception 'PURCHASE_ACCOUNT_MISMATCH';end if;
  if prior.observed_at>=p_observed then return;end if;
 end if;
 insert into meadow_littles_private.play_subscriptions(token_hash,user_id,state,expires_at,observed_at,is_test)
 values(p_token_hash,p_user,p_state,p_expires,p_observed,p_test)
 on conflict(token_hash) do update set state=excluded.state,expires_at=excluded.expires_at,observed_at=excluded.observed_at,is_test=excluded.is_test;
end $$;
revoke all on function public.meadow_littles_play_record(uuid,text,text,text,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.meadow_littles_play_record(uuid,text,text,text,timestamptz,timestamptz,boolean) to service_role;
