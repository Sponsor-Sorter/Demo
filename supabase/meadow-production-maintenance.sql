-- Game-owned job only; bounded batches, no shared-app data writes.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('meadow-markets-maintenance','13,28,43,58 * * * *','select meadow_private.maintain_game_accounts();');
