-- Meadow-only foreign-key lookups. All three tables were inspected before
-- this migration (5,25,0 estimated rows); no grants or player data change.
set lock_timeout='3s';
create index if not exists meadow_ad_rewards_receipt on meadow_private.ad_rewards(receipt_id);
create index if not exists meadow_control_admissions_owner on meadow_private.control_admissions(user_id);
create index if not exists meadow_market_sale_round on meadow_private.market_sale_rounds(round_id);
