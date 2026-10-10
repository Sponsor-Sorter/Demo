-- Remove inherited TRUNCATE/TRIGGER/REFERENCES privileges as well as public reads.
revoke all on table public.users_extended_data from public, anon, authenticated;
grant select, insert, update, delete on table public.users_extended_data to authenticated;
