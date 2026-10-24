-- Meadow Markets only. Additive rollout: legacy saves stay compatible until a revision-aware client writes them.
alter table public.meadow_market_saves
 add column if not exists revision bigint not null default 0,
 add column if not exists save_protocol smallint not null default 1,
 add column if not exists save_write_id uuid,
 add column if not exists save_write_hash text;

create or replace function meadow_private.guard_save_revision()
returns trigger language plpgsql security invoker set search_path = '' as $body$
declare expected bigint; incoming text;
begin
 if tg_op='UPDATE' and new.user_id is distinct from old.user_id then raise exception 'Farm owner cannot change' using errcode='23514'; end if;
 if current_user in ('authenticated','anon') and (new.save_protocol>=2 or (tg_op='UPDATE' and old.save_protocol>=2)) then
  incoming:=new.save_data->>'_cloudRevision';
  if incoming is null or incoming !~ '^[0-9]{1,18}$' then raise exception 'Update Meadow Markets before syncing this farm' using errcode='40001'; end if;
  expected:=incoming::bigint;
  if expected<>(case when tg_op='UPDATE' then old.revision else 0 end) then raise exception 'Farm changed on another device' using errcode='40001'; end if;
 end if;
 if tg_op='UPDATE' and new.save_write_id is not distinct from old.save_write_id and (new.save_data-'_cloudRevision') is distinct from (old.save_data-'_cloudRevision') then new.save_write_id:=null;new.save_write_hash:=null;end if;
 if tg_op='UPDATE' then new.revision:=old.revision+1;new.save_protocol:=greatest(old.save_protocol,new.save_protocol);else new.revision:=1;end if;
 new.updated_at:=statement_timestamp();
 new.save_data:=jsonb_set(new.save_data,'{_cloudRevision}',to_jsonb(new.revision),true);
 return new;
end; $body$;
revoke all on function meadow_private.guard_save_revision() from public,anon,authenticated;
create trigger meadow_market_save_revision_guard before insert or update on public.meadow_market_saves for each row execute function meadow_private.guard_save_revision();

create or replace function public.meadow_market_commit_save(p_expected_revision bigint,p_save_data jsonb,p_write_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $body$
declare u uuid:=auth.uid(); saved public.meadow_market_saves%rowtype; digest text; bytes integer;
begin
 if u is null then raise exception 'Sign in to save a farm' using errcode='28000'; end if;
 if p_expected_revision is null or p_expected_revision<0 or p_write_id is null then raise exception 'Invalid save revision' using errcode='22023'; end if;
 bytes:=octet_length(p_save_data::text);
 if p_save_data is null or jsonb_typeof(p_save_data)<>'object' or bytes>4194304
    or (p_save_data->>'version') is distinct from '1' or jsonb_typeof(p_save_data->'farms') is distinct from 'object'
    or jsonb_typeof(p_save_data->'coins') is distinct from 'number'
    or (p_save_data->>'coins')::numeric<0 or (p_save_data->>'coins')::numeric>1000000000000
    or (p_save_data->>'coins')::numeric<>trunc((p_save_data->>'coins')::numeric)
 then raise exception 'Invalid farm save' using errcode='22023';end if;
 p_save_data:=jsonb_set(p_save_data,'{_cloudRevision}',to_jsonb(p_expected_revision),true);
 digest:=encode(sha256(convert_to(p_save_data::text,'UTF8')),'hex');
 select * into saved from public.meadow_market_saves where user_id=u for update;
 if found then
  if saved.save_write_id=p_write_id then
   if saved.save_write_hash is distinct from digest then raise exception 'Save receipt reused for different data' using errcode='22023';end if;
   return jsonb_build_object('ok',true,'revision',saved.revision,'write_id',p_write_id,'replayed',true);
  end if;
  if saved.revision<>p_expected_revision then return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,'save_data',saved.save_data);end if;
  update public.meadow_market_saves set save_data=p_save_data,save_protocol=2,save_write_id=p_write_id,save_write_hash=digest where user_id=u returning * into saved;
 else
  if p_expected_revision<>0 then return jsonb_build_object('ok',false,'conflict',true,'revision',0,'save_data',null);end if;
  insert into public.meadow_market_saves(user_id,save_data,save_protocol,save_write_id,save_write_hash)
   values(u,p_save_data,2,p_write_id,digest) on conflict(user_id) do nothing returning * into saved;
  if not found then
   select * into saved from public.meadow_market_saves where user_id=u for update;
   if saved.save_write_id=p_write_id and saved.save_write_hash=digest then return jsonb_build_object('ok',true,'revision',saved.revision,'write_id',p_write_id,'replayed',true);end if;
   return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,'save_data',saved.save_data);
  end if;
 end if;
 return jsonb_build_object('ok',true,'revision',saved.revision,'write_id',p_write_id);
end; $body$;
revoke all on function public.meadow_market_commit_save(bigint,jsonb,uuid) from public,anon;
grant execute on function public.meadow_market_commit_save(bigint,jsonb,uuid) to authenticated;
comment on function public.meadow_market_commit_save(bigint,jsonb,uuid) is 'Meadow Markets owned save CAS; atomic revision check and retry receipt, under existing owner/friend RLS.';
