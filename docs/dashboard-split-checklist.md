# Dashboard CSS Split Verification Checklist

Date: 2026-05-24

## Scope
Verify no visual regression after splitting `styles/dashboard.css` into modular imports.

## Critical checks
1. Top bar
- Brand block position, title/subtitle style
- Status pills alignment and spacing
- Right action buttons (收/投/出/备) style and hover

2. Main 3-column area
- Left asset card dimensions and chart block spacing
- Center core sphere + surrounding nodes position
- Right card stack spacing and border/radius

3. Bottom first strip (6 modules)
- Module titles font consistency
- Main value baseline consistency
- Donut/sparkline/progress visuals still visible
- No text clipping in any module

4. Bottom nav + status row
- Two-line status text fully visible
- Divider and spacing consistency
- Nav active state glow/border unchanged

5. Responsive checkpoints
- <=1180 layout wrapping still intact
- <=680 stack/collapse behavior unchanged

## File map (new source of truth)
- `styles/dashboard.css` (entry only)
- `styles/dashboard/layout.css` (layout entry)
- `styles/dashboard/layout-shell.css`
- `styles/dashboard/layout-topbar.css`
- `styles/dashboard/layout-main-center-right.css`
- `styles/dashboard/layout-bottom-strip.css`
- `styles/dashboard/layout-bottom-nav.css`
- `styles/dashboard/responsive.css`

## Archive
- Previous monolithic file archived at:
  - `docs/archive/dashboard.legacy.css`
