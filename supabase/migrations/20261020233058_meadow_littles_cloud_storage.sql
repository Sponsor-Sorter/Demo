-- Isolated Meadow Market Littles storage. Existing Meadow Markets objects/Auth settings are unchanged.
create schema meadow_littles_private;
revoke all on schema meadow_littles_private from public;
grant usage on schema meadow_littles_private to authenticated;
create table public.meadow_littles_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Little Farmer' check(char_length(display_name) between 1 and 32 and display_name !~ '[[:cntrl:]]'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.meadow_littles_saves(
 user_id uuid primary key references public.meadow_littles_profiles(user_id) on delete cascade,
 cloud_version integer not null default 1 check(cloud_version=1),
 revision bigint not null default 0 check(revision between 0 and 9007199254740991),
 save_data jsonb not null default '{}'::jsonb check(jsonb_typeof(save_data)='object' and octet_length(save_data::text)<=262144),
 last_request_id uuid,last_request_hash text,
 updated_at timestamptz not null default now()
);
alter table public.meadow_littles_profiles enable row level security;
alter table public.meadow_littles_saves enable row level security;
revoke all on public.meadow_littles_profiles,public.meadow_littles_saves from public,anon,authenticated;
grant select on public.meadow_littles_profiles,public.meadow_littles_saves to authenticated;
grant all on public.meadow_littles_profiles,public.meadow_littles_saves to service_role;
create policy meadow_littles_owner_read on public.meadow_littles_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy meadow_littles_owner_read on public.meadow_littles_saves for select to authenticated using(user_id=(select auth.uid()));

create function meadow_littles_private.require_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();sid text:=auth.jwt()->>'session_id';
begin
 if actor is null or not exists(select 1 from auth.users a where a.id=actor and (a.banned_until is null or a.banned_until<=now()))
 or not exists(select 1 from auth.sessions s where s.user_id=actor and s.id::text=sid and (s.not_after is null or s.not_after>now())) then
 raise exception using errcode='42501',message='LITTLES_SIGN_IN_REQUIRED';end if;
 return actor;
end $$;
revoke all on function meadow_littles_private.require_actor() from public,anon,authenticated;

create function meadow_littles_private.open(p_display_name text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=meadow_littles_private.require_actor();p public.meadow_littles_profiles;s public.meadow_littles_saves;guest boolean;
begin
 if p_display_name is not null and (char_length(btrim(p_display_name)) not between 1 and 32 or p_display_name~'[[:cntrl:]]') then raise exception using errcode='22023',message='LITTLES_INVALID_DISPLAY_NAME';end if;
 insert into public.meadow_littles_profiles(user_id) values(actor) on conflict(user_id) do nothing;
 if p_display_name is not null then update public.meadow_littles_profiles set display_name=btrim(p_display_name),updated_at=now() where user_id=actor;end if;
 insert into public.meadow_littles_saves(user_id) values(actor) on conflict(user_id) do nothing;
 select * into p from public.meadow_littles_profiles where user_id=actor;
 select * into s from public.meadow_littles_saves where user_id=actor;
 select is_anonymous into guest from auth.users where id=actor;
 return jsonb_build_object('ok',true,'contract','meadow-littles-cloud-v1','profile',jsonb_build_object('user_id',actor,'display_name',p.display_name,'is_guest',coalesce(guest,false)),
 'save',jsonb_build_object('cloud_version',s.cloud_version,'revision',s.revision,'data',s.save_data,'updated_at',s.updated_at,'last_request_id',s.last_request_id),'entitlements_verified',false);
end $$;
revoke all on function meadow_littles_private.open(text) from public,anon;
grant execute on function meadow_littles_private.open(text) to authenticated;
create function public.meadow_littles_open(p_display_name text default null) returns jsonb language sql security invoker set search_path='' as $$select meadow_littles_private.open(p_display_name)$$;
revoke all on function public.meadow_littles_open(text) from public,anon;
grant execute on function public.meadow_littles_open(text) to authenticated;

create function meadow_littles_private.save(p_request_id uuid,p_expected_revision bigint,p_cloud_version integer,p_save_data jsonb,p_expected_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=meadow_littles_private.require_actor();s public.meadow_littles_saves;fingerprint text;replayed boolean:=false;
begin
 if p_expected_user_id is distinct from actor then raise exception using errcode='42501',message='LITTLES_ACCOUNT_CHANGED';end if;
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=9007199254740991 or p_cloud_version is distinct from 1 or p_save_data is null or jsonb_typeof(p_save_data)<>'object' or octet_length(p_save_data::text)>262144 or p_save_data->'schema' is distinct from '1'::jsonb then raise exception using errcode='22023',message='LITTLES_INVALID_SAVE';end if;
 fingerprint:=md5(jsonb_build_object('expected_revision',p_expected_revision,'cloud_version',p_cloud_version,'data',p_save_data)::text);
 select * into s from public.meadow_littles_saves where user_id=actor for update;
 if not found then raise exception using errcode='22023',message='LITTLES_OPEN_REQUIRED';end if;
 if s.last_request_id=p_request_id then
  if s.last_request_hash is distinct from fingerprint then raise sqlstate 'PT409' using message='LITTLES_REQUEST_BINDING_CONFLICT';end if;
  replayed:=true;
 else
  if s.revision<>p_expected_revision then raise sqlstate 'PT409' using message='LITTLES_SAVE_REVISION_CONFLICT';end if;
  if s.revision>0 and s.updated_at>now()-interval '500 milliseconds' then raise sqlstate 'PT429' using message='LITTLES_SAVE_RATE_LIMIT';end if;
  update public.meadow_littles_saves set revision=revision+1,cloud_version=p_cloud_version,save_data=p_save_data,last_request_id=p_request_id,last_request_hash=fingerprint,updated_at=now() where user_id=actor returning * into s;
 end if;
 return jsonb_build_object('ok',true,'contract','meadow-littles-cloud-v1','revision',s.revision,'request_id',p_request_id,'replayed',replayed,'updated_at',s.updated_at,'entitlements_verified',false);
end $$;
revoke all on function meadow_littles_private.save(uuid,bigint,integer,jsonb,uuid) from public,anon;
grant execute on function meadow_littles_private.save(uuid,bigint,integer,jsonb,uuid) to authenticated;
create function public.meadow_littles_save(p_request_id uuid,p_expected_revision bigint,p_cloud_version integer,p_save_data jsonb,p_expected_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$select meadow_littles_private.save(p_request_id,p_expected_revision,p_cloud_version,p_save_data,p_expected_user_id)$$;
revoke all on function public.meadow_littles_save(uuid,bigint,integer,jsonb,uuid) from public,anon;
grant execute on function public.meadow_littles_save(uuid,bigint,integer,jsonb,uuid) to authenticated;
comment on table public.meadow_littles_saves is 'Private client-reported Littles game progress. Scores, gems, purchases and adFree are unverified test/game data and confer no billing, payout or real subscription entitlement.';

