# Build 181 — lighter crop rendering

## Bottlenecks addressed

- Every crop growth check filtered the entire farm's objects for flowers. Rendering, animation ticks and flower-bonus settlement now build one flower list per pass. No persistent cache can become stale after movement, sale or planting.
- Mature crops repeatedly wrote identical animation styles every900ms. A visual key now skips those writes until the crop or planting cycle changes. Growing crops continue to animate normally.

## Checks

- A300-plot/400-decoration fixture checks zero repeated mature-plant style writes; growing plants still update.
- 1,200 growth checks inspect1,200 flower candidates rather than all farm objects each time.
- Flower bonuses, large-plot range, moving fields, repeated settlement, visitor/background guards and map previews retain their existing behavior.
- These are deterministic operation-count improvements, not a claim of measured Samsung frame rate. Native profiling and installer acceptance remain pending an available test window.

Build180 return-worker allowance and build179 revision-safe cloud saves are retained. Production payments/ads remain disabled in free test mode.
