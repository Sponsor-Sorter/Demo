-- Existing cache policies allowed every signed-in account to read/change every row.
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='stats_snapshot' loop
  execute format('drop policy %I on public.stats_snapshot',p.policyname);
 end loop;
end $$;
revoke all on public.stats_snapshot from anon;
create policy campaign_snapshot_participants on public.stats_snapshot to authenticated
 using(sponsorship_private.offer_access(offer_id::text))
 with check(sponsorship_private.offer_access(offer_id::text) and updated_by=auth.uid());

do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='offer_engagement_analytics' loop
  execute format('drop policy %I on public.offer_engagement_analytics',p.policyname);
 end loop;
end $$;
revoke all on public.offer_engagement_analytics from anon,authenticated;
grant select on public.offer_engagement_analytics to authenticated;
create policy campaign_analytics_participants on public.offer_engagement_analytics for select to authenticated
 using(sponsorship_private.offer_access(offer_id::text));

create table public.campaign_metric_history (
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.private_offers(id) on delete restrict,
 content_url text not null,platform text not null,
 metrics jsonb not null,recorded_at timestamptz not null default now(),
 observed_by uuid not null references auth.users(id),
 observation_source text not null default 'browser' check(observation_source='browser')
);
create index campaign_metric_history_offer on public.campaign_metric_history(offer_id,recorded_at desc);
create index campaign_metric_history_observer on public.campaign_metric_history(observed_by);
alter table public.campaign_metric_history enable row level security;
revoke all on public.campaign_metric_history from anon,authenticated;
grant select on public.campaign_metric_history to authenticated;
create policy metric_history_participants on public.campaign_metric_history for select to authenticated
 using(sponsorship_private.offer_access(offer_id::text));

create function public.record_campaign_observation(campaign_id uuid,content_url text,platform text,metrics jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare o public.private_offers; k text; v jsonb; previous public.campaign_metric_history;
begin
 if not sponsorship_private.offer_access(campaign_id::text) then raise exception 'Campaign access required'; end if;
 select * into strict o from public.private_offers where id=campaign_id for update;
 if not (content_url=any(coalesce(o.live_urls,'{}'::text[])) or content_url is not distinct from o.live_url) or content_url is null or length(content_url)>2000 then raise exception 'Published campaign link required'; end if;
 if platform is null or platform not in ('youtube','tiktok','twitch','instagram','facebook','twitter','snapchat') then raise exception 'Unsupported platform'; end if;
 if metrics is null or jsonb_typeof(metrics)<>'object' or metrics='{}'::jsonb then raise exception 'Metrics required'; end if;
 for k,v in select * from jsonb_each(metrics) loop
  if k not in ('views','likes','comments','shares','video_views','impressions','reach','saved','engagement')
  or (v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or v::text::numeric<0 or v::text::numeric>9007199254740991)) then raise exception 'Invalid metric'; end if;
 end loop;
 select * into previous from public.campaign_metric_history h where h.offer_id=campaign_id and h.content_url=record_campaign_observation.content_url order by h.recorded_at desc limit 1;
 -- Bound repeated refreshes without overwriting historical observations.
 if previous.id is not null and previous.recorded_at>now()-interval '15 minutes' then return; end if;
 insert into public.campaign_metric_history(offer_id,content_url,platform,metrics,observed_by)
 values(campaign_id,content_url,platform,metrics,auth.uid());
end; $$;
revoke all on function public.record_campaign_observation(uuid,text,text,jsonb) from public,anon;
grant execute on function public.record_campaign_observation(uuid,text,text,jsonb) to authenticated;
