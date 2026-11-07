set local lock_timeout='3s';
set local statement_timeout='15s';
-- Origins212 replaced the refund204 constraint. Both lanes must remain valid.
alter table meadow_private.farm_economy_journal drop constraint farm_economy_journal_lane_check;
alter table meadow_private.farm_economy_journal add constraint farm_economy_journal_lane_check
 check(lane in ('legacy_baseline','legacy_snapshot','server_receipt','verified_action','server_initial','server_refund'));
