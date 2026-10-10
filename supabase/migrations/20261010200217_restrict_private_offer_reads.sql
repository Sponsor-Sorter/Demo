-- These permissive policies were OR-ed with the participant policies, exposing
-- every private campaign and review. Keep the existing party/admin policies.
alter table public.private_offers enable row level security;
alter table public.private_offer_reviews enable row level security;

drop policy if exists "Anon can select homepage offer fields" on public.private_offers;
drop policy if exists "Authenticated users can view their offers" on public.private_offers;
drop policy if exists "Dev unlock" on public.private_offers;
drop policy if exists "Anon can select homepage review fields" on public.private_offer_reviews;
drop policy if exists "Dev unlock" on public.private_offer_reviews;
drop policy if exists "Emergency unlock SELECT reviews" on public.private_offer_reviews;

-- Visitors use the deliberately projected public profile/review views instead.
-- Do not revoke their grants or change their opt-in filters here.
revoke select on public.private_offers, public.private_offer_reviews from anon;
