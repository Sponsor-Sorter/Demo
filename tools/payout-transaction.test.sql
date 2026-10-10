-- Integration assertions using temporary fixtures. ALWAYS run the whole file;
-- rollback leaves no payout, wallet, notification or audit changes committed.
begin;
do $test$
declare
  a uuid; s uuid; member_id uuid; p uuid := gen_random_uuid(); q uuid := gen_random_uuid();
  r jsonb; n integer;
begin
  select user_id into a from public.users_extended_data where is_admin is true limit 1;
  select user_id into s from public.users_extended_data where "userType"='sponsor' and user_id<>a limit 1;
  select user_id into member_id from public.users_extended_data where is_admin is not true limit 1;
  if a is null or s is null or member_id is null then raise exception 'Missing integration fixtures'; end if;
  update public.users_extended_data set wallet=100 where user_id=s;
  insert into public.payouts(id,sponsee_id,payout_amount,payout_user_role,status,payout_currency)
  values(p,s,10,'sponsor','pending','usd'),(q,s,1000,'sponsor','pending','usd');
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  r := public.decide_admin_payout(p,'paid',null);
  if r->>'status'<>'paid' or (select wallet from public.users_extended_data where user_id=s)<>90 then
    raise exception 'Payment accounting failed';
  end if;
  r := public.decide_admin_payout(p,'paid',null);
  if (r->>'already_processed')::boolean is not true or (select wallet from public.users_extended_data where user_id=s)<>90 then
    raise exception 'Replay protection failed';
  end if;
  select count(*) into n from public.admin_activity_log where target_id=p::text;
  if n<>1 then raise exception 'Audit count failed'; end if;
  begin
    perform public.decide_admin_payout(p,'rejected','conflict');
    raise exception 'Conflicting decision accepted';
  exception when others then if sqlerrm='Conflicting decision accepted' then raise; end if; end;
  begin
    perform public.decide_admin_payout(q,'paid',null);
    raise exception 'Overdraw accepted';
  exception when others then if sqlerrm <> 'Insufficient wallet balance' then raise; end if; end;
  if (select status from public.payouts where id=q)<>'pending' or (select wallet from public.users_extended_data where user_id=s)<>90 then
    raise exception 'Failed payment changed accounting';
  end if;
  r := public.decide_admin_payout(q,'rejected','Insufficient funds');
  if r->>'status'<>'rejected' or (select wallet from public.users_extended_data where user_id=s)<>90 then
    raise exception 'Rejection changed wallet';
  end if;
  perform set_config('request.jwt.claim.sub',member_id::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',member_id,'role','authenticated')::text,true);
  begin
    perform public.decide_admin_payout(p,'paid',null);
    raise exception 'Member access accepted';
  exception when insufficient_privilege then null; end;
end;
$test$;
rollback;
