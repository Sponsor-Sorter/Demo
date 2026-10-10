-- Preserve intended reads and inserts while closing unrestricted client access.
alter table public.roadmap_items enable row level security;
alter table public.abuse_report_log enable row level security;
alter table public.offer_engagement_analytics enable row level security;
alter table public.guest_analytics enable row level security;
alter table public.group_offer_decisions enable row level security;

revoke all on public.roadmap_items, public.abuse_report_log,
  public.offer_engagement_analytics, public.guest_analytics,
  public.group_offer_decisions from public, anon, authenticated;

grant select on public.roadmap_items to anon, authenticated;
grant insert, update, delete on public.roadmap_items to authenticated;
create policy roadmap_public_read on public.roadmap_items for select to anon, authenticated using (true);
create policy roadmap_admin_write on public.roadmap_items for all to authenticated
  using ((select public.is_current_user_admin()))
  with check ((select public.is_current_user_admin()));

grant select, insert, update, delete on public.abuse_report_log to authenticated;
create policy abuse_log_admin_only on public.abuse_report_log for all to authenticated
  using ((select public.is_current_user_admin()))
  with check ((select public.is_current_user_admin()));

grant select on public.offer_engagement_analytics to authenticated;
create policy engagement_participant_read on public.offer_engagement_analytics for select to authenticated
  using ((select public.is_current_user_admin()) or exists (
    select 1 from public.private_offers o
    where o.id = offer_engagement_analytics.offer_id
      and (o.sponsor_id = (select auth.uid()) or o.sponsee_id = (select auth.uid()))
  ));

-- Guest telemetry is intentionally insert-only; no guest may read existing sessions.
grant insert on public.guest_analytics to anon, authenticated;
grant select on public.guest_analytics to authenticated;
create policy guest_analytics_append on public.guest_analytics for insert to anon, authenticated
  with check (true);
create policy guest_analytics_admin_read on public.guest_analytics for select to authenticated
  using ((select public.is_current_user_admin()));

grant select, insert on public.group_offer_decisions to authenticated;
create policy group_decisions_participant_read on public.group_offer_decisions for select to authenticated
  using ((select public.is_current_user_admin()) or exists (
    select 1 from public.group_offers o where o.id = group_offer_decisions.group_offer_id
  ));
create policy group_decisions_admin_insert on public.group_offer_decisions for insert to authenticated
  with check (
    decided_by = (select auth.uid()) and (
      (select public.is_current_user_admin()) or exists (
        select 1 from public.group_offers o
        where o.id = group_offer_decisions.group_offer_id
          and public.is_group_admin(o.group_id, (select auth.uid()))
      )
    )
  );
