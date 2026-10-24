-- Meadow Markets only. Structural bounds are not proof that resources were earned.
-- Protocol1 retains its legacy rollout behavior until a revision-aware client opts in.
create or replace function meadow_private.guard_save_resources()
returns trigger language plpgsql security invoker set search_path='' as $body$
declare f record; item record; amount numeric; count_farms integer:=0;
begin
 if new.save_protocol<2 and (tg_op='INSERT' or old.save_protocol<2) then return new;end if;
 if new.save_data is null or jsonb_typeof(new.save_data) is distinct from 'object'
    or octet_length(new.save_data::text)>4194304
    or (new.save_data->>'version') is distinct from '1'
    or jsonb_typeof(new.save_data->'farms') is distinct from 'object'
    or jsonb_typeof(new.save_data->'coins') is distinct from 'number'
 then raise exception 'Invalid farm save structure' using errcode='22023';end if;
 amount:=(new.save_data->>'coins')::numeric;
 if amount<0 or amount>1000000000000 or amount<>trunc(amount) then raise exception 'Invalid farm gold balance' using errcode='22023';end if;
 for f in select key,value from jsonb_each(new.save_data->'farms') loop
  count_farms:=count_farms+1;
  if count_farms>32 or jsonb_typeof(f.value) is distinct from 'object' then raise exception 'Invalid farm area' using errcode='22023';end if;
  if f.value ? 'objects' then
   if jsonb_typeof(f.value->'objects') is distinct from 'array' then raise exception 'Invalid farm objects' using errcode='22023';end if;
   if jsonb_array_length(f.value->'objects')>20000 then raise exception 'Too many farm objects' using errcode='22023';end if;
  end if;
  if f.value ? 'inventory' then
   if jsonb_typeof(f.value->'inventory') is distinct from 'object' then raise exception 'Invalid farm inventory' using errcode='22023';end if;
   if (select count(*) from jsonb_object_keys(f.value->'inventory'))>4096 then raise exception 'Too many inventory types' using errcode='22023';end if;
   for item in select key,value from jsonb_each(f.value->'inventory') loop
    if jsonb_typeof(item.value) is distinct from 'number' then raise exception 'Invalid inventory amount' using errcode='22023';end if;
    amount:=(item.value::text)::numeric;
    if amount<0 or amount>1000000000000 or amount<>trunc(amount) then raise exception 'Invalid inventory amount' using errcode='22023';end if;
   end loop;
  end if;
 end loop;
 return new;
end; $body$;
revoke all on function meadow_private.guard_save_resources() from public,anon,authenticated;
create trigger meadow_market_save_resource_guard before insert or update on public.meadow_market_saves for each row execute function meadow_private.guard_save_resources();
