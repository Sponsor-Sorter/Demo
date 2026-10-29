# Meadow Markets build199 — account switching guard

A registered farm's sign-in screen no longer offers registration of that same farm again. A second guard sends any stale create-account action back to the account choices; the existing separate-guest-farm flow remains the way to create another account. Create/sign-in choices wait for the initial account lookup so a returning player is not briefly presented as a new guest. A failed lookup leaves the choices usable and the current farm safe.

Web199 / game199 / accounts9 / style167. Focused account transition/backup and production distribution tests passed before publishing. No passwords or recovery keys were entered, changed or read. The same account-only backend and save-switch barriers are retained.

Store setup in the same session: all seven products and their fixed contents, backwards-compatible buy options and draft regional prices were created and verified with zero active options. See meadow-play-operations.md for prices. The published game privacy policy is saved in Play Console, ready for review. AdMob payment information is still a user handoff, and live commerce remains disabled.

This release does not close the ordinary-farming server authority, real provider, store declaration/review or physical-device production gates. The test Samsung remains reserved for Frontlines.
