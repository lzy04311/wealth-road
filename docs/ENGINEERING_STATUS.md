# Engineering Status

Last verified: 2026-08-15

## 1. Current Project Stage

- Project: 财记, a local-first private personal finance web app.
- Current phase: locally verified financial correctness with stabilized maintenance boundaries.
- Runtime stack: static HTML, CSS, and plain JavaScript; no build step and no external runtime dependency by default.
- Dashboard-wide pixel comparison remains a separately scoped visual task.
- This document records local engineering evidence only. It does not imply push, merge, deployment, or live verification.

## 2. Verified Current Capabilities

### Data Safety And Financial Truth

- Current schema version is `5`.
- Import data passes entity, ID, date, amount, reference, transfer, and reconciliation validation before replacement.
- Corrupted localStorage is preserved under a recovery key instead of silently overwritten.
- Fund pools (`accounts`) and real money locations (`moneyAccounts`) are separate dimensions.
- Real-account transfers are two-sided; referenced accounts are archived instead of deleted.
- Reconciliation is an auditable adjustment and does not rewrite opening balances.
- Private natural-language finance events remain in an ignored append-only ledger.

### Monthly Execution Health

- `FINANCIAL_HEALTH_MODEL` version 1 is the single source for score weights, thresholds, UI explanation, and tests.
- The user-facing label is “月度执行健康度”; it is a budget and cash-flow execution hint, not a comprehensive investment or solvency risk rating.
- Asset-baseline deductions apply when required snapshot data is incomplete.
- Threshold boundaries and representative healthy/stressed scenarios have direct regression tests.

### Runtime Structure

- `index.html` loads 26 ordered browser scripts.
- The dependency-free classic-script runtime is an explicit contract: the complete 26-file order and every top-level declaration are checked deterministically.
- State normalization, UI feedback, validators, migrations, storage, calculations, rendering, form bindings, orchestration, optional sync, and PWA responsibilities are split into focused files.
- The project gate enforces the load order and prevents UI feedback, render context, form submission, shared controls, and secondary-workspace shell selectors from drifting back into the wrong files.
- Dashboard bottom-strip helpers have one active definition; retired pie/trend renderers and their stale DOM paths are removed.
- `styles/pages.css` and `styles/subpages.css` are import-only entries backed by six business-page modules and two secondary-workspace modules. The retired hierarchy override layer is gone; workspace structure and component hierarchy have one owner in `workspace-base.css`.

## 3. Verification Evidence

- `scripts/app-data-safety.test.js`: 41 tests.
- `scripts/app-render-smoke.test.js`: 24 tests.
- `scripts/pwa-assets.test.js`: 8 tests.
- `scripts/finance-ledger.test.js`: 9 tests.
- Total deterministic tests: 82.
- All JavaScript files pass syntax checking.
- The project gate rejects duplicate browser globals, script or page-CSS order drift, CSS cache-version drift, layer-boundary drift, missing literal DOM IDs, CSS `!important` growth above the audited baseline, retired brands, broken Markdown links, Git whitespace errors, and private-ledger tracking.
- Real browser create/edit/transfer/archive/reconciliation/export/import recovery is recorded in `docs/BROWSER_E2E_VERIFICATION.md`. It remains a manual release check while the repository intentionally has no browser-automation dependency.

## 4. Current Boundaries

- Do not change state field names or the localStorage main key without a migration plan and regression tests.
- Do not enable login or cloud sync without authentication, RLS, conflict, same-origin client script, and deployment verification.
- Do not introduce a frontend framework or perform a large-scale rewrite.
- Do not change Dashboard visual design without screenshot regression.
- Do not treat monthly execution health as comprehensive financial risk.

## 5. Required Check

Run after every engineering change:

```powershell
node scripts\check-project.js
```

GitHub Actions runs the same dependency-free gate on pushes and pull requests. Browser automation is not part of the current no-external-dependency contract; enabling it requires a separately authorized tooling change.

## 6. Release State

- Local implementation: verified.
- Current branch remote: local commits are not yet pushed.
- CI result for these unpushed changes: pending.
- Merge, deployment, and live verification: not claimed.
