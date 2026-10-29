# Meadow Markets build188 — reward-safe device conflict review

Build188 completes live acceptance of the farm journal work in186 and the level guidance correction in187. Before publishing acceptance, concurrent-device review found that “keep this device’s farm” could repeatedly conflict when another device had advanced its reward cursor.

The explicit keep-local choice now fetches only this account's missing server delivery patches. It validates the complete sequence on a clone before changing the active farm, adds the missing rewards without discarding local farming changes, adopts the observed server revision, then resumes normal compare-and-swap saving. Gaps or very old/large histories safely offer loading the online farm. Private receipt tables remain inaccessible to players and friends. An indexed, owner-only invoker RPC exposes the bounded response patches.

Node checks cover preserving a local seed purchase alongside another device's reward, no duplicate payout on repeated review and no partial mutation on an incomplete sequence. Rolled-back database assertions cover missing/current/future cursors. Existing conflict, owner, backup and retry checks remain in the full suite.

The owner's real browser recovery and subsequent new-password sign-in passed. See186 for the journal/authority boundary: ordinary crop, animal, construction and shop actions still need server commands before paid production. This release retains free purchases and test advertisements.
