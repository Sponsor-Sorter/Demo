create table public.partner_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 contenttype text not null default '' check(length(contenttype)<=400),
 target_audience text not null default '' check(length(target_audience)<=400),
 preferred_content_format text not null default '' check(length(preferred_content_format)<=400),
 partnership_type text not null default '' check(length(partnership_type)<=400),
 platforms text[] not null default '{}' check(cardinality(platforms)<=7 and platforms <@ array['youtube','instagram','tiktok','twitch','facebook','twitter','snapchat']),
 minfollowers bigint not null default 0 check(minfollowers between 0 and 1000000000),
 location text not null default '' check(length(location)<=200)
);
create table public.partner_feedback (
 user_id uuid not null references auth.users(id) on delete cascade,
 partner_id uuid not null references auth.users(id) on delete cascade,
 status text not null check(status in ('saved','dismissed')),
 primary key(user_id,partner_id),check(user_id<>partner_id)
);
create index partner_feedback_target on public.partner_feedback(partner_id);
alter table public.partner_preferences enable row level security;
alter table public.partner_feedback enable row level security;
revoke all on public.partner_preferences,public.partner_feedback from anon,authenticated;
grant select,insert,update,delete on public.partner_preferences,public.partner_feedback to authenticated;
create policy own_partner_preferences on public.partner_preferences to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid() and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.users_extended_data p where p.user_id=auth.uid() and not coalesce(p.banned,false)));
create policy own_partner_feedback on public.partner_feedback to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid() and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.users_extended_data p where p.user_id=auth.uid() and not coalesce(p.banned,false))
 and exists(select 1 from public.public_user_directory p where p.user_id=partner_id));
