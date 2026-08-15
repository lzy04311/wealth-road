# Dashboard CSS Audit

Last verified: 2026-08-15

## Current Facts

- Active CSS files: 14.
- Active CSS lines after verified cleanup: approximately 5243.
- `styles/dashboard.css` is a two-line import entry, not a monolithic stylesheet.
- `!important` declarations: 1.
- The project gate allows only `.hidden-view { display: none !important; }` in `styles/base.css`; every other occurrence fails.

## Completed Cleanup

- Removed the retired Dashboard pie renderer, mode state, event path, missing DOM references, and dedicated legacy pie CSS.
- Removed unused cockpit, asset action-card, asset tracking, old plan/data-tip, and unused investment action-group styles.
- Converted `.positive`, `.negative`, and `.warning` from force overrides into `--tone-color` providers consumed by component-owned color rules.
- Removed 33 unnecessary force overrides from the desktop bottom strip after verifying selector order and computed styles at 1600px and 1200px widths.
- Removed duplicate bottom-strip title locks, gave list bullets an explicit `.dashboard-strip-dot` class, and returned bottom-navigation sizing and spacing to its component rules.
- Versioned both levels of Dashboard CSS imports so a cache release refreshes nested component styles instead of serving stale rules.
- Preserved dynamic asset-kind classes because runtime builds those class names programmatically.
- Preserved active quick-modal styles and current Dashboard responsive overrides.

## Remaining Hotspots

- `.hidden-view` is the sole approved force override because hidden application views must remain hidden regardless of their layout display mode.
- Dashboard layout and responsive files now contain zero `!important` declarations; their remaining breakpoint repetition expresses different layouts rather than force-override debt.
- `styles/pages.css` remains the largest active stylesheet and should be reduced or split one page at a time.

## Safe Next Sequence

1. Keep the exact `!important` allowlist unchanged unless a documented component contract justifies an exception.
2. New status-colored components should consume `--tone-color` with a component-specific fallback.
3. Bump the top-level and nested Dashboard import versions together whenever cached Dashboard CSS changes.
4. Reduce or split `styles/pages.css` one page at a time with desktop and narrow visual checkpoints.

Do not use the archived monolithic Dashboard CSS as an active source file.
