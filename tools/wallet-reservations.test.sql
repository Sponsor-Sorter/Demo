-- All fixture changes are rolled back. Run this entire file as one transaction.
begin;
do $test$
declare u uuid; profile_id uuid; p uuid := gen_random_uuid(); ok boolean;
begin
  select user_id,id into u,profile_id from public.users_extended_data where is_admin is not true and "userType"='sponsor' limit 1;
  if u is null then raise exception 'Missing wallet fixture'; end if;
  update public.users_extended_data set wallet=100 where user_id=u;
  insert into public.payouts(id,sponsee_id,payout_amount,payout_user_role,status,payout_currency)
  values(p,u,80,'sponsor','processing','usd');
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  ok := public.use_wallet_funds(profile_id,30);
  if ok then raise exception 'Reserved withdrawal funds were spent'; end if;
  ok := public.use_wallet_funds(profile_id,10);
  if not ok or (select wallet from public.users_extended_data where user_id=u)<>90 then
    raise exception 'Legitimate wallet spending failed';
  end if;
  begin
    update public.users_extended_data set wallet=999 where user_id=u;
    raise exception 'Direct wallet tampering succeeded';
  exception when others then
    if sqlerrm <> 'Protected account fields can only be changed by trusted services' then raise; end if;
  end;
  begin
    perform public.use_wallet_funds(profile_id,'NaN'::numeric);
    raise exception 'Nonfinite amount accepted';
  exception when others then if sqlerrm <> 'Amount must be greater than zero' then raise; end if; end;
end;
$test$;
rollback;
