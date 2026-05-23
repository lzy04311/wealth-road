# Legacy Cockpit Style Candidates (Safe Review List)

Date: 2026-05-24
Goal: identify likely legacy cockpit/dashboard-overlap selectors before deletion or scope isolation.

## A) In `styles/components.css`
Likely legacy cockpit block:
- `.cockpit-card`
- `.cockpit-main`
- `.cockpit-mini`
- `.cockpit-list.compact` (+ descendants)
- `.cockpit-kicker`
- `.cockpit-main-asset`
- `.cockpit-main-metrics` (+ descendants)
- `.cockpit-status`
- `.main-action-tips`
- `.today-suggest-inline`
- `.today-suggest-label`

Risk:
- These may overlap with newer dashboard concepts and increase cascade conflicts.

## B) In `styles/pages.css`
Likely cockpit-era/shared UI:
- `.asset-track-item` (+ descendants)
- `.cockpit-title`
- `.cockpit-list` (+ descendants)
- `.cockpit-hint`
- `.cockpit-quick-actions`
- `.quick-modal` / `.quick-modal-mask` / `.quick-modal-panel` / `.quick-modal-close`

Risk:
- If still used by active quick entry modal and asset page, cannot be deleted directly.
- Prefer scope narrowing first, then delete only unused selectors.

## C) In `styles/base.css`
Dashboard home mode toggles:
- `html:has(body.dashboard-home-mode)`
- `.dashboard-home-mode .app-header, .dashboard-home-mode .tabs`

Risk:
- Functional but tied to `:has`, less legacy-safe on older engines.

## Recommended safe sequence
1. Add temporary usage markers (DOM/class grep + runtime check) for selectors above.
2. Move confirmed dashboard-only selectors into `styles/dashboard/*` scoped files.
3. Keep modal-related selectors until runtime verifies no dependency.
4. Delete only selectors confirmed unused in current views.
