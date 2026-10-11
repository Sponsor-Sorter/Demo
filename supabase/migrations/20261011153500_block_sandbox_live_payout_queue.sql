-- Sandbox purchases must never enter the legacy real-money payout queue.
create function sponsorship_private.guard_sandbox_payout() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='payouts' then
  if exists(select 1 from public.sponsorship_orders o where o.offer_id=NEW.offer_id and o.stripe_session_id like 'cs_test_%') then
   raise exception 'Sandbox sponsorships cannot enter the live payout queue';
  end if;
 elsif NEW.payout_status is distinct from OLD.payout_status and NEW.payout_status not in ('unpaid','pending') then
  if exists(select 1 from public.sponsorship_orders o where o.offer_id=NEW.id and o.stripe_session_id like 'cs_test_%') then
   raise exception 'Sandbox sponsorships cannot be marked paid by the live payout system';
  end if;
 end if;
 return NEW;
end; $$;
revoke all on function sponsorship_private.guard_sandbox_payout() from public,anon,authenticated;
create trigger guard_sandbox_payout before insert or update on public.payouts for each row execute function sponsorship_private.guard_sandbox_payout();
create trigger guard_sandbox_offer_payout before update on public.private_offers for each row execute function sponsorship_private.guard_sandbox_payout();
