# Meadow Markets175 — farm-title notices and native bridge repair

Brown collection/help notices are anchored six pixels beneath map-title (for example Willowbrook Meadow), centred on its actual bounds. Portrait screens clamp the notice to safe horizontal margins. The title/header are observed for layout changes and every new notice remeasures its position. Colour, padding and animation are retained.

Actual Samsung acceptance caught a native integration error missed by the browser fallback tests: this classic-script game receives Capacitor's generated Plugins bindings, but does not import the core module that defines registerPlugin. The v1 auth/updater adapters called that missing method, preventing online startup on the new wrapper. Both now use the generated native plugin first, with module registration as a fallback. New native-shaped mocks explicitly omit registerPlugin. The existing level58 farm remained on the phone during the failure; no reset or player-data deletion was performed.

Native acceptance remains in progress until the vault entry, online identity and actual8→9 Android installer flow are checked. The1.6.1 APK binary and native manifest digest are unchanged by this web fix.
