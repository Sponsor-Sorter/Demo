create or replace function public.meadow_market_guard_friendship_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.requester_id is distinct from old.requester_id
     or new.recipient_id is distinct from old.recipient_id
     or old.status <> 'pending'
     or auth.uid() is distinct from old.recipient_id
     or new.status not in ('accepted','declined') then
    raise exception 'Invalid Meadow & Market friend request update';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.meadow_market_guard_friendship_update() from public, anon, authenticated;
drop trigger if exists meadow_market_guard_friendship_update on public.meadow_market_friendships;
create trigger meadow_market_guard_friendship_update before update on public.meadow_market_friendships
for each row execute function public.meadow_market_guard_friendship_update();
