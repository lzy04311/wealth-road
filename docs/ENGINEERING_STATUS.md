# Engineering Status

## 1. Current Project Stage

- Project: 财富志, a local-first private personal finance web app.
- Current phase: engineering hardening.
- Visual redesign is paused. Do not make dashboard or broad UI changes unless a later task explicitly scopes them.

## 2. Completed Hardening Work

### P0 Data Safety

- Hardened import validation so arbitrary JSON objects cannot overwrite state.
- Hardened localStorage loading so corrupted local data is preserved under a recovery key instead of silently normalized away.
- Added schema migration pipeline through `migrateState(rawState)`.
- Kept migration and normalization responsibilities separate.

### Regression Tests

- Test file: `scripts/app-data-safety.test.js`
- Current coverage: 14 tests.
- Test style: Node native `assert`, no external test framework.
- Covered areas include import validation, schema migration, corrupted localStorage recovery, and core financial calculations.

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
  - `upsert`, `removeRecord`, `editRecord`.
- `scripts/app-actions-quick-entry.js`
  - Quick entry modal open/close and submit binding.
- `scripts/app-actions-modals.js`
  - Snapshot records modal and health detail modal.
- `scripts/app-actions-navigation.js`
  - View switching and dashboard home mode.
- `scripts/app-actions.js`
  - Still owns form helpers, form submit binding, feature toggles, click binding, and init.

### CSS Comment Sections

- `styles/base.css`
  - Added sections for design tokens, base layout, dashboard home mode, header/tabs/views.
- `styles/components.css`
  - Added sections for generic cards/stats, legacy cockpit components, action tips/deprecated candidates.
- `styles/pages.css`
  - Added sections for assets, pie/chart legacy area, accounts, forms, buttons, records, data/backup, flow/monthly.
- `styles/responsive.css`
  - Added sections for global responsive, dashboard responsive, legacy dashboard responsive candidates, account role cards.

## 3. Current Do-Not-Touch List

- Do not change state field names.
- Do not change the localStorage main key.
- Do not change dashboard visual design.
- Do not add login or cloud sync.
- Do not start mini-program or App Store work.
- Do not introduce a frontend framework.
- Do not perform large-scale CSS migration.
- Do not split `bindClicks` or `handleSubmit` unless separately planned.

## 4. Required Checks After Engineering Changes

Run these after every engineering change:

```powershell
node scripts\app-data-safety.test.js
Get-ChildItem scripts -Filter *.js | ForEach-Object { node --check $_.FullName }
```

If a change only touches documentation or CSS comments, explain why behavior tests were not run.
