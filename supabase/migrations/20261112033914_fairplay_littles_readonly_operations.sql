begin;
-- Read only: reuse existing service_role SELECT privileges; grant no table access.
create function public.fairplay_admin_littles_operations(p_actor uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_config record;
begin
 if current_user<>'service_role' or not public.fairplay_admin_cap(p_actor,'operations','littles') then
  raise exception 'Littles operations scope required' using errcode='42501';
 end if;
 select checkout_enabled,ads_enabled into strict v_config
 from meadow_littles_private.play_config where singleton;
 return jsonb_build_object(
  'source','Live Littles global launch configuration; account test leases excluded',
  'flags',jsonb_build_object('checkout_enabled',v_config.checkout_enabled,'ads_enabled',v_config.ads_enabled),
  'products',jsonb_build_array(jsonb_build_object('id','ml_plus','label','Littles Plus monthly','price','AUD 4.99/month reference catalogue; current native Google Play price is authoritative')),
  'policy',jsonb_build_object('free_completed_rounds_per_game_per_day',5,'plus_ad_free',true,'plus_unlimited_completed_rounds',true,'failed_or_abandoned_rounds_count',false),
  'policy_editable',false,
  'activation','Global request gates only. Google Play approval, AdMob app readiness and account test leases are separate.',
  'price_source','Qualified Littles catalogue reference; not a live billing-price API',
  'checked_at',statement_timestamp());
end $$;
revoke all on function public.fairplay_admin_littles_operations(uuid) from public,anon,authenticated;
grant execute on function public.fairplay_admin_littles_operations(uuid) to service_role;
comment on function public.fairplay_admin_littles_operations(uuid) is 'Read-only app-scoped Admin projection. No account status calls, test leases, flag changes, purchases or grants.';
commit;
