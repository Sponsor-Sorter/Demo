-- Command farms must honour the same pending-deletion restriction as purchases.
-- This reader is checked again inside the atomic command committer.
do $migration$
declare body text; marker text;
begin
 body:=pg_get_functiondef('meadow_private.read_farm_command(uuid,uuid,jsonb)'::regprocedure);
 marker:=' if p_user is null or p_request_id is null';
 if position(marker in body)=0 then raise exception 'Review command reader before adding account guard';end if;
 body:=replace(body,marker,$guard$
 if not exists(select 1 from public.meadow_market_profiles where user_id=p_user)
  or exists(select 1 from meadow_private.account_deletions where user_id=p_user)
 then raise exception 'Account unavailable' using errcode='42501';end if;
$guard$||marker);
 execute body;
end $migration$;
