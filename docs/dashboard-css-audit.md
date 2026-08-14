# Dashboard CSS Audit

Last verified: 2026-08-15

## Current Facts

- Active CSS files: 14.
- Active CSS lines after verified cleanup: approximately 5261.
- `styles/dashboard.css` is a two-line import entry, not a monolithic stylesheet.
- `!important` declarations: 62.
- The project gate blocks growth above the audited baseline of 62.

## Completed Cleanup

- Removed the retired Dashboard pie renderer, mode state, event path, missing DOM references, and dedicated legacy pie CSS.
- Removed unused cockpit, asset action-card, asset tracking, old plan/data-tip, and unused investment action-group styles.
- Kept the shared `.positive`, `.negative`, and `.warning` utilities only in `styles/components.css`, removing identical Dashboard-nav copies.
- Preserved dynamic asset-kind classes because runtime builds those class names programmatically.
- Preserved active quick-modal styles and current Dashboard responsive overrides.

## Remaining Hotspots

- `styles/dashboard/responsive.css` still contains the largest concentration of `!important` declarations.
- Bottom navigation, status items, and Dashboard responsive selectors intentionally repeat across breakpoints; exact-selector repetition alone is not proof of a conflict.
- `styles/pages.css` remains the largest active stylesheet and should be reduced or split one page at a time.

## Safe Next Sequence

1. Keep the CSS override count from growing.
2. Select one visual region and record desktop/narrow screenshots.
3. Consolidate only rules whose final computed values are known.
4. Run `node scripts/check-project.js` and repeat the same visual checkpoints.

Do not use the archived monolithic Dashboard CSS as an active source file.
