-- Separate, default-off optional ad rewards. Existing Plus, saves, daily counts and fair rewards are unchanged.
create table meadow_littles_private.ad_round_config (
 singleton boolean primary key default true check (singleton),
 enabled boolean not null default false,
 serving_ready boolean not null default false,
 format_reviewed boolean not null default false,
 private_users uuid[] not null default '{}',
 private_until timestamptz,
 unit_id text not null default 'ca-app-pub-6946008351204848/6193791997'
   check (unit_id='ca-app-pub-6946008351204848/6193791997'),
 max_prepares_per_hour integer not null default 10 check (max_prepares_per_hour between 1 and 30)
);
insert into meadow_littles_private.ad_round_config(singleton) values(true);
create table meadow_littles_private.ad_round_requests (
 id uuid primary key default gen_random_uuid(),
 actor uuid not null references auth.users(id) on delete cascade,
 client_id uuid not null,
 game text not null check (game ~ '^[a-z0-9_-]{1,80}$'),
 request_id uuid not null,
 unit_id text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '10 minutes',
 transaction_id text unique,
 verified_at timestamptz,
 claimed_at timestamptz,
 unique(actor,request_id)
);
create index littles_ad_round_actor_created on meadow_littles_private.ad_round_requests(actor,created_at desc);
alter table meadow_littles_private.ad_round_config enable row level security;
alter table meadow_littles_private.ad_round_requests enable row level security;
revoke all on meadow_littles_private.ad_round_config,meadow_littles_private.ad_round_requests from public,anon,authenticated;

create function meadow_littles_private.ad_rounds(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 viewer uuid:=meadow_littles_private.require_actor();
 config meadow_littles_private.ad_round_config;
 item meadow_littles_private.ad_round_requests;
 base jsonb; projection jsonb; eligible boolean; private_allowed boolean;
 client uuid; chosen_game text; request_uuid uuid; challenge uuid;
 envelope jsonb:=jsonb_build_object('contract','littles-ad-round-v1','user_id',viewer,'actor',viewer);
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4096 then
  raise exception using errcode='22023',message='INVALID_AD_REQUEST';end if;
 client:=(p_data->>'client')::uuid;
 if client is null then raise exception using errcode='22023',message='INVALID_AD_REQUEST';end if;
 select * into strict config from meadow_littles_private.ad_round_config where singleton;
 private_allowed:=viewer=any(config.private_users) and config.private_until>now();
 base:=meadow_littles_private.play_status();
 projection:=public.meadow_littles_plus_projection(viewer);
 eligible:=coalesce((base->>'parent_ready')::boolean,false)
   and coalesce((projection->>'effective_verified')::boolean,false)
   and not coalesce((projection->>'effective_plus')::boolean,true)
   and config.format_reviewed
   and coalesce((base->>'ads_enabled')::boolean,false)
   and ((config.enabled and config.serving_ready) or coalesce(private_allowed,false));
 if p_action='status' then
  return envelope||jsonb_build_object('enabled',coalesce(eligible,false),'privateTest',coalesce(private_allowed,false),
   'unit',config.unit_id,'format','opt_in_skippable_rewarded_interstitial_v1','formatReviewed',config.format_reviewed,
   'requiredCloseMs',5000,'eligibilityEvidence','https://support.google.com/admob/answer/9884467?hl=en');
 end if;
 chosen_game:=p_data->>'game';
 if chosen_game is null or chosen_game !~ '^[a-z0-9_-]{1,80}$' then
  raise exception using errcode='22023',message='INVALID_AD_GAME';end if;
 if p_action='prepare' then
  if not coalesce(eligible,false) then raise exception using errcode='42501',message='AD_NOT_AVAILABLE';end if;
  request_uuid:=(p_data->>'requestId')::uuid;
  if request_uuid is null then raise exception using errcode='22023',message='INVALID_AD_REQUEST';end if;
  -- One actor lock makes request-id idempotency and the hourly request cap atomic.
  perform pg_advisory_xact_lock(hashtextextended('littles-ad:'||viewer::text,0));
  select * into item from meadow_littles_private.ad_round_requests r where r.actor=viewer and r.request_id=request_uuid;
  if found then
   if item.client_id<>client or item.game<>chosen_game or item.expires_at<=now() then
    raise exception using errcode='22023',message='AD_REQUEST_MISMATCH';end if;
  else
   if (select count(*) from meadow_littles_private.ad_round_requests r where r.actor=viewer and r.created_at>now()-interval '1 hour')>=config.max_prepares_per_hour then
    raise exception using errcode='P0001',message='AD_NOT_AVAILABLE';end if;
   insert into meadow_littles_private.ad_round_requests(actor,client_id,game,request_id,unit_id)
    values(viewer,client,chosen_game,request_uuid,config.unit_id) returning * into item;
  end if;
  return envelope||jsonb_build_object('game',chosen_game,'challenge',item.id,'unit',item.unit_id,'expiresAt',floor(extract(epoch from item.expires_at)*1000)::bigint);
 elsif p_action='claim' then
  challenge:=(p_data->>'challenge')::uuid;
  select * into item from meadow_littles_private.ad_round_requests r where r.id=challenge and r.actor=viewer and r.client_id=client and r.game=chosen_game for update;
  if not found then raise exception using errcode='42501',message='AD_REQUEST_MISMATCH';end if;
  -- Claiming an already earned view remains possible after eligibility or Plus changes.
  if item.verified_at is null then
   return envelope||jsonb_build_object('status',case when item.expires_at+interval '24 hours'<=now() then 'expired' else 'pending' end);
  end if;
  if item.claimed_at is null then
   update meadow_littles_private.ad_round_requests r set claimed_at=now() where r.id=item.id returning * into item;
  end if;
  if item.claimed_at+interval '24 hours'<=now() then return envelope||jsonb_build_object('status','expired');end if;
  return envelope||jsonb_build_object('status','verified','verified',true,'game',item.game,'challenge',item.id,
   'client',item.client_id,'unit',item.unit_id,'transaction',item.transaction_id,'amount',1,
   'expiresAt',floor(extract(epoch from item.claimed_at+interval '24 hours')*1000)::bigint);
 end if;
 raise exception using errcode='22023',message='INVALID_AD_ACTION';
end $$;
revoke all on function meadow_littles_private.ad_rounds(text,jsonb) from public,anon;
grant execute on function meadow_littles_private.ad_rounds(text,jsonb) to authenticated;
create function public.meadow_littles_ad_rounds(p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select meadow_littles_private.ad_rounds(p_action,p_data) $$;
revoke all on function public.meadow_littles_ad_rounds(text,jsonb) from public,anon;
grant execute on function public.meadow_littles_ad_rounds(text,jsonb) to authenticated;

-- This is a service-only signed-webhook entry, never an end-user reward/Plus grant API.
create function meadow_littles_private.record_ad_round(p_challenge uuid,p_transaction text,p_unit text,p_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item meadow_littles_private.ad_round_requests;
begin
 if p_transaction is null or p_transaction !~ '^[A-Za-z0-9_-]{1,128}$' then
  raise exception using errcode='22023',message='INVALID_AD_RECEIPT';end if;
 select * into item from meadow_littles_private.ad_round_requests r where r.id=p_challenge for update;
 if not found or item.unit_id<>p_unit or p_at is null or p_at<item.created_at-interval '1 minute' or p_at>item.expires_at or p_at>now()+interval '1 minute' then
  raise exception using errcode='22023',message='INVALID_AD_RECEIPT';end if;
 if item.transaction_id is not null then
  if item.transaction_id<>p_transaction then raise exception using errcode='22023',message='AD_RECEIPT_MISMATCH';end if;
  return jsonb_build_object('recorded',true,'duplicate',true);
 end if;
 update meadow_littles_private.ad_round_requests r set transaction_id=p_transaction,verified_at=now() where r.id=item.id;
 return jsonb_build_object('recorded',true,'duplicate',false);
end $$;
revoke all on function meadow_littles_private.record_ad_round(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function meadow_littles_private.record_ad_round(uuid,text,text,timestamptz) to service_role;
create function public.meadow_littles_record_ad_round(p_challenge uuid,p_transaction text,p_unit text,p_at timestamptz) returns jsonb
language sql security invoker set search_path='' as $$ select meadow_littles_private.record_ad_round(p_challenge,p_transaction,p_unit,p_at) $$;
revoke all on function public.meadow_littles_record_ad_round(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.meadow_littles_record_ad_round(uuid,text,text,timestamptz) to service_role;
