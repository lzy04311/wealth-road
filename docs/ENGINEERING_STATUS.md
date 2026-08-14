# Engineering Status

Last verified: 2026-08-15

## 1. Current Project Stage

- Project: 财记, a local-first private personal finance web app.
- Current phase: local financial correctness hardening plus scoped subpage workspace refinement.
- Dashboard-wide visual changes still require a separately scoped task. The current active UI work is limited to secondary pages and non-disruptive form drawers.
- This document records local engineering evidence only. It does not imply that the current commit is deployed or live verified.

## 2. Completed Hardening Work

### P0 Data Safety

- Hardened import validation so arbitrary JSON objects cannot overwrite state.
- Hardened localStorage loading so corrupted local data is preserved under a recovery key instead of silently normalized away.
- Added schema migration pipeline through `migrateState(rawState)`.
- Kept migration and normalization responsibilities separate.

### Regression Tests

- `scripts/app-data-safety.test.js`: 35 data safety, import-integrity, and financial-invariant tests.
- `scripts/app-render-smoke.test.js`: 23 render, interaction, local-only auth, and sync-safety smoke tests.
- `scripts/pwa-assets.test.js`: 8 PWA and product-brand contract tests.
- `scripts/finance-ledger.test.js`: 9 append-only ledger tests.
- Test style: Node native `assert`, no external test framework.
- Covered areas include entity-level import validation, unique IDs, reference integrity, schema v1-v5 migration, corrupted localStorage recovery, account conservation, liabilities, balance reconciliation, render paths, conflict safety, and PWA assets.

### Financial Truth And Workflow

- Current schema version is `5`.
- Real money locations live in `moneyAccounts`; purpose/budget pools remain in `accounts`.
- Transfers between real accounts are two-sided and conserve total owned cash.
- `reconciliations` records balance-check adjustments without rewriting opening balances.
- Historical records missing real-account links are shown for explicit user repair; the app does not guess those links.
- Referenced fund pools and real accounts are archived instead of deleted.

### State Layer Split

- `scripts/app-state.js`
  - Global state structure, defaults, normalization, base utilities.
- `scripts/app-validators.js`
  - Import validation and state shape validation.
- `scripts/app-migrations.js`
  - Schema migration pipeline.
- `scripts/app-storage.js`
  - localStorage keys, load/save, corrupted data recovery.

### Actions Layer Split

- `scripts/app-actions-data.js`
  - Data export/import actions.
- `scripts/app-actions-crud.js`
  - `upsert`, `removeRecord`, `editRecord`, historical real-account repair, archive safeguards.
- `scripts/app-actions-quick-entry.js`
  - Quick entry modal open/close and submit binding.
- `scripts/app-actions-modals.js`
  - Snapshot records modal and health detail modal.
- `scripts/app-actions-navigation.js`
  - View switching and dashboard home mode.
- `scripts/app-actions.js`
  - Form-drawer lifecycle, form submit binding, reconciliation input, feature toggles, click binding, and init.

### CSS Comment Sections

- `styles/base.css`
  - Added sections for design tokens, base layout, dashboard home mode, header/tabs/views.
- `styles/components.css`
  - Added sections for generic cards/stats, legacy cockpit components, action tips/deprecated candidates.
- `styles/pages.css`
  - Added sections for assets, pie/chart legacy area, accounts, forms, buttons, records, data/backup, flow/monthly.
- `styles/responsive.css`
  - Added sections for global responsive, dashboard responsive, legacy dashboard responsive candidates, account role cards.
- `styles/subpages.css`
  - Secondary-page hierarchy, inspector layout, contextual actions, and responsive form drawers.

## 3. Current Do-Not-Touch List

- Do not change state field names.
- Do not change the localStorage main key.
- Do not change dashboard visual design without a separately scoped task.
- Do not enable or expand login/cloud sync without deployment configuration, conflict guarantees, and explicit product scope.
- Do not start mini-program or App Store work.
- Do not introduce a frontend framework.
- Do not perform large-scale CSS migration.
- Do not split `bindClicks` or `handleSubmit` unless separately planned.

## 4. Required Checks After Engineering Changes

Run these after every engineering change:

```powershell
node scripts\app-data-safety.test.js
node scripts\app-render-smoke.test.js
node scripts\pwa-assets.test.js
node scripts\finance-ledger.test.js
Get-ChildItem scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

If a change only touches documentation or CSS comments, explain why behavior tests were not run.
