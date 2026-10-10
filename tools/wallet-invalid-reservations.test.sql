-- Execute whole file: every fixture mutation is rolled back.
begin;
do $test$
declare u uuid; profile_id uuid; p uuid := gen_random_uuid(); invalid numeric;
begin
  select user_id,id into u,profile_id from public.users_extended_data
  where is_admin is not true and "userType"='sponsor'
    and user_id <> '62a9095d-d212-4dd5-842b-6b575b879be7'::uuid
    and lower(coalesce(username,'')) <> 'moikailive' limit 1;
  if u is null then raise exception 'Missing non-protected wallet fixture'; end if;
  update public.users_extended_data set wallet=100 where user_id=u;
  insert into public.payouts(id,sponsee_id,payout_amount,payout_user_role,status,payout_currency)
  values(p,u,80,'sponsor','processing','usd');
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if public.use_wallet_funds(profile_id,30) then raise exception 'Spent reserved funds'; end if;
  if not public.use_wallet_funds(profile_id,10) then raise exception 'Valid spend failed'; end if;
  if (select wallet from public.users_extended_data where user_id=u)<>90 then raise exception 'Wrong debit'; end if;
  execute 'reset role';
  foreach invalid in array array['NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric,-10::numeric,0::numeric] loop
    update public.payouts set payout_amount=invalid where id=p;
    execute 'set local role authenticated';
    begin
      perform public.use_wallet_funds(profile_id,1);
      raise exception 'Invalid reservation accepted';
    exception when others then
      if sqlerrm <> 'Wallet reservations are invalid' then raise; end if;
    end;
    if (select wallet from public.users_extended_data where user_id=u)<>90 then raise exception 'Invalid reservation changed wallet'; end if;
    execute 'reset role';
  end loop;
  begin
    update public.payouts set payout_amount=null where id=p;
    raise exception 'Null reservation accepted';
  exception when not_null_violation then null;
  end;
  update public.payouts set payout_amount=80 where id=p;
  foreach invalid in array array['NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric,-10::numeric] loop
    update public.users_extended_data set wallet=invalid where user_id=u;
    execute 'set local role authenticated';
    begin
      perform public.use_wallet_funds(profile_id,1);
      raise exception 'Invalid balance accepted';
    exception when others then
      if sqlerrm <> 'Wallet balance is invalid' then raise; end if;
    end;
    execute 'reset role';
  end loop;
  update public.users_extended_data set wallet=90 where user_id=u;
  execute 'set local role authenticated';
  begin
    update public.users_extended_data set wallet=999 where user_id=u;
    raise exception 'Direct wallet tampering accepted';
  exception when others then
    if sqlerrm <> 'Protected account fields can only be changed by trusted services' then raise; end if;
  end;
end;
$test$;
rollback;
