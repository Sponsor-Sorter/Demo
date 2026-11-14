-- Littles-only deletion must cascade weekly activity without deleting shared Fairplay Auth.
alter table meadow_littles_private.weekly_fair drop constraint weekly_fair_user_id_fkey;
alter table meadow_littles_private.weekly_fair add constraint weekly_fair_user_id_fkey foreign key(user_id) references public.meadow_littles_profiles(user_id) on delete cascade;
alter table meadow_littles_private.weekly_rounds drop constraint weekly_rounds_user_id_fkey;
alter table meadow_littles_private.weekly_rounds add constraint weekly_rounds_user_id_fkey foreign key(user_id) references public.meadow_littles_profiles(user_id) on delete cascade;
