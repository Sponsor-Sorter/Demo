-- Root reviewed against the actual live private function and ACL. Serving stays OFF.
begin;
do $littles97_baseline$
declare f pg_proc; c meadow_littles_private.ad_round_config;
begin
 select * into strict f from pg_proc where oid=to_regprocedure('meadow_littles_private.ad_rounds(text,jsonb)');
 if f.proowner::regrole::text<>'postgres' or not f.prosecdef
  or f.proconfig is distinct from array['search_path=""']::text[]
  or f.proacl::text<>'{postgres=X/postgres,authenticated=X/postgres}'
  or encode(sha256(convert_to(replace(f.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>'4c3abb8918ddcbf00d0bd2a4dc8f141f410b226a462f77f765f104681101962c' then
  raise exception 'Littles ad admission baseline drift';
 end if;
 select * into strict c from meadow_littles_private.ad_round_config where singleton for update;
 if c.enabled or c.serving_ready or c.format_reviewed or cardinality(c.private_users)<>0 or c.private_until is not null
  or c.unit_id<>'ca-app-pub-6946008351204848/6193791997' then
  raise exception 'Littles ad serving must be held off before admission update';
 end if;
end $littles97_baseline$;
-- New offers require the accepted native candidate; historical signed claims are unchanged.
-- Private native17 diagnostics, public native18 with diagnostic surface compiled out.
-- This migration never enables serving or changes an existing reward, allowance or save.
create or replace function meadow_littles_private.ad_rounds(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 viewer uuid:=meadow_littles_private.require_actor();
 config meadow_littles_private.ad_round_config;
 item meadow_littles_private.ad_round_requests;
 base jsonb; projection jsonb; eligible boolean; private_allowed boolean;
 client uuid; chosen_game text; request_uuid uuid; challenge uuid; native_version integer:=0; required_version integer;
 envelope jsonb:=jsonb_build_object('contract','littles-ad-round-v1','user_id',viewer,'actor',viewer);
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4096 then
  raise exception using errcode='22023',message='INVALID_AD_REQUEST';end if;
 client:=(p_data->>'client')::uuid;
 if client is null then raise exception using errcode='22023',message='INVALID_AD_REQUEST';end if;
 select * into strict config from meadow_littles_private.ad_round_config where singleton;
 private_allowed:=viewer=any(config.private_users) and config.private_until>now();
 -- Compatibility admission only; this client value never verifies a reward.
 required_version:=case when coalesce(private_allowed,false) then 17 else 18 end;
 if jsonb_typeof(p_data->'nativeVersion')='number' and (p_data->>'nativeVersion') ~ '^[1-9][0-9]{0,5}$' then
  native_version:=(p_data->>'nativeVersion')::integer;
 end if;
 base:=meadow_littles_private.play_status();
 projection:=public.meadow_littles_plus_projection(viewer);
 eligible:=coalesce((base->>'parent_ready')::boolean,false)
   and coalesce((projection->>'effective_verified')::boolean,false)
   and not coalesce((projection->>'effective_plus')::boolean,true)
   and native_version>=required_version
   and config.format_reviewed
   and coalesce((base->>'ads_enabled')::boolean,false)
   and ((config.enabled and config.serving_ready) or coalesce(private_allowed,false));
 if p_action='status' then
  return envelope||jsonb_build_object('enabled',coalesce(eligible,false),'privateTest',coalesce(private_allowed,false),
   'unit',config.unit_id,'format','opt_in_skippable_rewarded_interstitial_v1','formatReviewed',config.format_reviewed,
   'requiredNativeVersion',required_version,'requiredCloseMs',5000,'eligibilityEvidence','https://support.google.com/admob/answer/9884467?hl=en');
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

commit;
