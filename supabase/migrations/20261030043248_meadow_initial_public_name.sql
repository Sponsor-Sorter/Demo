-- A new account uses a generated public farm name until its player accepts rules.
-- Existing profile upserts preserve the chosen name and normal cloud startup.
create function meadow_private.initial_public_name() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.meadow_market_profiles where user_id=new.user_id) then new.display_name:='Farmer '||right(new.friend_code,5); end if;
 return new;
end $$;
revoke all on function meadow_private.initial_public_name() from public,anon,authenticated;
create trigger meadow_initial_public_name before insert on public.meadow_market_profiles for each row execute function meadow_private.initial_public_name();
