-- Add only a finite complimentary proof horizon; preserve the existing function ACL.
-- Timed grants stop at their actual end. An indefinite grant gets a five-minute lease.
create or replace function public.meadow_littles_plus_projection(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare test_allowed boolean; paid_until timestamptz; paid boolean; gift boolean:=null; gift_until timestamptz; gift_permanent boolean:=false; effective boolean;
begin
 test_allowed:=exists(select 1 from meadow_littles_private.play_testers t where t.user_id=p_user and t.expires_at>now());
 select max(s.expires_at) into paid_until from meadow_littles_private.play_subscriptions s
 where s.user_id=p_user and s.state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED') and s.expires_at>now() and (not s.is_test or test_allowed);
 paid:=paid_until is not null;
 if to_regprocedure('public.fairplay_complimentary_entitled(text,uuid,text)') is not null then
  begin
   execute 'select public.fairplay_complimentary_entitled($1,$2,$3)' into gift using 'littles',p_user,'littles_plus';
   if gift then
    select coalesce(bool_or(g.expires_at is null),false),max(least(coalesce(g.expires_at,now()+interval '300 seconds'),now()+interval '300 seconds')) into gift_permanent,gift_until
    from public.fairplay_admin_complimentary_grants g
    where g.app='littles' and g.target=p_user and g.entitlement='littles_plus'
      and g.revoked_at is null and g.starts_at<=now() and (g.expires_at is null or g.expires_at>now());
   end if;
  exception when others then gift:=null;gift_until:=null;gift_permanent:=false;end;
 end if;
 effective:=case when paid then true when gift is not null then gift else null end;
 return jsonb_build_object('contract','littles-plus-projection-v1','user_id',p_user,'access_eligibility_verified',false,
 'paid_active',paid,'paid_until',paid_until,'test_allowed',test_allowed,'parent_account_bound',exists(select 1 from meadow_littles_private.play_accounts a where a.user_id=p_user),
 'complimentary_active',gift,'complimentary_proof_until',gift_until,'complimentary_permanent',gift_permanent,'paid_verified',true,'complimentary_verified',gift is not null,'effective_plus',effective,'effective_verified',effective is not null);
end $$;
