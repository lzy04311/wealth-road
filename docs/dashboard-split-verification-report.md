# Dashboard Split Verification Report

Date: 2026-05-24
Based on: `docs/dashboard-split-checklist.md`

## 1) Top bar
- Brand block position/title style: `PENDING (visual)`
- Status pills alignment/spacing: `PENDING (visual)`
- Action buttons (收/投/出/备) style/hover: `PENDING (visual)`

Code evidence:
- `styles/dashboard/layout-topbar.css`
- `styles/dashboard/responsive.css`

## 2) Main 3-column area
- Left asset card dimensions/chart spacing: `PENDING (visual)`
- Center sphere + nodes position: `PENDING (visual)`
- Right card stack spacing/border/radius: `PENDING (visual)`

Code evidence:
- `styles/dashboard/layout-main-center-right.css`
- `styles/dashboard/responsive.css`

## 3) Bottom first strip (6 modules)
- Title font consistency: `PASS (code-path)`
- Main value baseline consistency: `PENDING (visual)`
- Donut/sparkline/progress visibility: `PASS (code-path)`
- Text clipping absent: `PENDING (visual)`

Code evidence:
- `styles/dashboard/layout-bottom-strip.css`
- `scripts/dashboard/render-bottom-strip.js`

## 4) Bottom nav + status row
- Two-line status text full visibility: `PASS (code-path)`
- Divider/spacing consistency: `PENDING (visual)`
- Active nav glow/border unchanged: `PENDING (visual)`

Code evidence:
- `styles/dashboard/layout-bottom-nav.css`
- `styles/dashboard/layout-shell.css`

## 5) Responsive checkpoints
- <=1180 wrapping intact: `PASS (structure)`
- <=680 collapse behavior intact: `PASS (structure)`

Code evidence:
- `styles/dashboard/responsive.css`

## Integrity checks completed
- Dashboard entry is import-only: `PASS`
  - `styles/dashboard.css`
- Legacy monolith archived: `PASS`
  - `docs/archive/dashboard.legacy.css`
- Split chain present: `PASS`
  - `styles/dashboard/layout.css` imports 5 layout modules

## Notes
- Current report is code-level + structure-level verification.
- Visual items marked `PENDING` should be confirmed in-browser on desktop and mobile widths.
