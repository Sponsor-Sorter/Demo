-- Cover reverse friend lookups and the collectible-catalog foreign key.
set lock_timeout = '3s';
create index if not exists meadow_market_friendships_recipient_status
 on public.meadow_market_friendships (recipient_id,status);
create index if not exists meadow_market_collectibles_item
 on public.meadow_market_collectibles (item_id);
