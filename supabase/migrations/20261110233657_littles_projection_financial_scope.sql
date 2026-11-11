-- Finance-only service projection. Actor/session eligibility is checked by play_status;
-- this function deliberately has no access to the Auth directory.
create or replace function public.meadow_littles_plus_projection(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare test_allowed boolean; paid_until timestamptz; paid boolean; gift boolean:=null; effective boolean;
begin
 test_allowed:=exists(select 1 from meadow_littles_private.play_testers t where t.user_id=p_user and t.expires_at>now());
 select max(s.expires_at) into paid_until from meadow_littles_private.play_subscriptions s
 where s.user_id=p_user and s.state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED') and s.expires_at>now() and (not s.is_test or test_allowed);
 paid:=paid_until is not null;
 if to_regprocedure('public.fairplay_complimentary_entitled(text,uuid,text)') is not null then
  begin execute 'select public.fairplay_complimentary_entitled($1,$2,$3)' into gift using 'littles',p_user,'littles_plus';exception when others then gift:=null;end;
 end if;
 effective:=case when paid then true when gift is not null then gift else null end;
 return jsonb_build_object('contract','littles-plus-projection-v1','user_id',p_user,'access_eligibility_verified',false,
 'paid_active',paid,'paid_until',paid_until,'test_allowed',test_allowed,'parent_account_bound',exists(select 1 from meadow_littles_private.play_accounts a where a.user_id=p_user),
 'complimentary_active',gift,'paid_verified',true,'complimentary_verified',gift is not null,'effective_plus',effective,'effective_verified',effective is not null);
end $$;
revoke all on function public.meadow_littles_plus_projection(uuid) from public,anon,authenticated;
grant execute on function public.meadow_littles_plus_projection(uuid) to service_role;
