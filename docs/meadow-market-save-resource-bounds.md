# Save resource bounds — 24 October2026

Migration `20261024020441_meadow_markets_save_resource_bounds.sql` was applied to the shared BargainBarge project, touching only a Meadow Markets private trigger function and the Meadow save table's trigger.

For revision-aware saves, the database now checks snapshot structure and size, integral nonnegative gold/inventory quantities, bounded quantities, inventory type counts, farm count and object-array shape/size. This applies to normal RPC writes and direct table updates, including attempted protocol downgrades. Legacy protocol1 rollout behavior stays compatible until the revision-aware client opts an account in.

Before deployment, the36 existing saves had no invalid inventory shapes or amounts. The rollback-only SQL fixture `tools/meadow-save-resource-check.sql` verified valid/zero quantities and rejection of negative, fractional, string, null, boolean and excessive values through both write paths. Failed writes did not advance the save revision. No test accounts or saves persisted. The existing save-revision SQL fixture also passed again. Security-advisor lint groups stayed unchanged; none named the new trigger function.

These bounds are structural validation, not an authoritative economic ledger. A plausible positive quantity is not proof it was earned. Server-issued rewarded mini-game sessions, score proof and authoritative farm transactions remain backlog work. Test gem packs, subscriptions and ads remain free simulations.

No web build bump is needed for this database-only guard. It is compatible with the published build181 client.
