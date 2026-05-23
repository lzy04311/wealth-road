# Dashboard CSS Audit (2026-05-24)

## File size
- `styles/dashboard.css`: 2724 lines

## Highest duplicate selectors (top 15)
- `.dashboard-bottom-nav` x7
- `.dashboard-status-item` x5
- `.dashboard-center-orbit` x4
- `.dashboard-right-cards` x4
- `.dashboard-status-item strong` x4
- `.dashboard-bottom-nav-actions` x4
- `.dashboard-bottom-strip` x4
- `.dashboard-cockpit-page` x3
- `.dashboard-main-grid` x3
- `.dashboard-asset-card` x3
- `.dashboard-asset-metrics` x3
- `.dashboard-status-bar` x3
- `.dashboard-status-pill` x3
- `.dashboard-bottom-nav button` x3
- `.dashboard-structure` x3

## Conflict hotspot (bottom area)
Frequent redefinitions are concentrated in these line ranges:
- 35-173 (`FINAL LOCK` + desktop override)
- 1550-2297 (main bottom-strip/nav definitions)
- 2343-2366 (responsive overrides)
- 2515-2588 (another responsive override set)
- 2601-2646 (mobile collapse overrides)

## Key risks
1. Same selectors are defined in both global and `@media` blocks with `!important`.
2. Bottom-strip/nav has layered overrides across multiple regions, causing "changed but no effect" behavior.
3. Some rules target broad selectors (`.dashboard-status-item`, `.dashboard-bottom-nav`) instead of scoping to `#dashboardCockpit` / `#dashboardBottomStrip`.

## Safe consolidation strategy (no visual value change)
1. Keep one canonical block for bottom-strip/nav desktop defaults.
2. Keep one canonical block for `@media (min-width: 901px)` desktop override.
3. Keep one canonical block for mobile collapse (`max-width` range).
4. Delete duplicate definitions outside canonical blocks, keeping the last effective value unchanged.

