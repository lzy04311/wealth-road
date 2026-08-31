# Engineering Status

Last verified: 2026-08-31

## 1. Current Project Stage

- Project: 财记, a local-first private personal finance web app.
- Current phase: locally verified financial correctness with stabilized maintenance boundaries.
- Runtime stack: static HTML, CSS, and plain JavaScript; no build step and no external runtime dependency by default.
- Mobile layout, semantic accessibility, complete CRUD/reload behavior, and deterministic desktop/mobile screenshot comparison now run in a real installed Edge/Chrome browser as part of the project gate. Cross-browser/OS aesthetic review remains a separate release judgment because font rasterization is intentionally tolerated.
- Local engineering evidence and remote release evidence are recorded separately; the current merged, CI, deployment, and live-verification status is listed in section 6.

## 2. Verified Current Capabilities

### Data Safety And Financial Truth

- Current schema version is `6`.
- Import data passes entity, ID, date, amount, reference, transfer, and reconciliation validation before replacement.
- Corrupted localStorage is preserved under a recovery key instead of silently overwritten.
- Fund pools (`accounts`) and real money locations (`moneyAccounts`) are separate dimensions.
- Real-account transfers are two-sided; referenced accounts are archived instead of deleted.
- Reconciliation is an auditable adjustment and does not rewrite opening balances.
- Private natural-language finance events remain in an ignored append-only ledger.
- Every save mirrors state into an IndexedDB safety net: versioned automatic backups (latest 30 kept) plus an operation audit log (latest 1000 kept), with graceful no-op fallback when IndexedDB is unavailable. The Data page exposes one-tap restore from the latest backup and a recent-operations audit view with entity drill-down.
- Import accepts validated backups up to 16 MiB, matching realistic large exports. Regression fixtures exceed the retired 1 MiB ceiling, and a 6500-row state is written to IndexedDB, read back, and compared without truncation.
- The Data page has an independent append-only UTF-8 CSV ledger importer for `日期、项目、分类、收入、支出、类型、备注`. It previews income, expense, investment, suspected-duplicate, invalid, and unmapped counts; suspected duplicates require an explicit import/skip decision and are never silently removed. The existing JSON import remains the full-state recovery path.
- Schema v6 adds `expenses.paymentMode`. Payroll withholding counts toward consumption, category totals, and budget execution while calculation-layer cash expense, account balance, free cash, wealth change, and attribution avoid a second deduction after net salary reaches the bank.
- Destructive import, restore, and cloud-pull paths create an IndexedDB checkpoint and verify it by reading it back before confirmation. A browser download is reported as “started” until the browser can provide a verified File System Access write-and-close result.
- Storage health is evidence-based: a real localStorage write/read/remove probe, IndexedDB availability and backup count, last backup time, and browser quota estimate when supported. Unknown, writable-without-backup, verified-backup, and write-failure states are distinct.
- Archived real money accounts remain visible and continue to count toward financial assets until their balance is actually zero. Fund-pool opening dates exclude earlier linked transactions from current balances.
- Optional cloud writes use a server-side compare-and-swap RPC; privileged service-role keys and non-local client scripts are rejected before configuration.
- Dashboard 2.0 stage 8.1 adds reusable calculation-only APIs for baseline-safe wealth change, balanced wealth attribution, factual insights, and unified future finance events without changing persisted state or Dashboard UI.
- Dashboard 2.0 stage 8.2 reassigns the existing Dashboard shell to wealth change, cash flow, investment, upcoming events, goals, and factual insights; the right rail and monthly strip consume the stage 8.1 APIs without changing persisted state or introducing new views.
- Dashboard 2.0 stage 8.3 refines only the central wealth core and six-node compass: wealth change and cash flow become the restrained primary node pair (about 9% larger through `--orbit-node-size-primary`), nodes read as lightweight state markers instead of buttons, the champagne orbit is reduced to a faint dashed guide, and node data bindings, labels, and navigation stay untouched.
- First use no longer turns missing evidence into zero assets, a positive status, or a score. The Dashboard, Flow, Monthly, Assets, Goals, and Investments surfaces use explicit “待记录 / 待建账 / 待评估” states and retire the three-step onboarding only after real financial evidence exists.
- The health pill is an actual button connected to the versioned score explanation; only the three compass nodes with valid destinations remain buttons.

### Monthly Execution Health

- `FINANCIAL_HEALTH_MODEL` version 1 is the single source for score weights, thresholds, UI explanation, and tests.
- The user-facing label is “月度执行健康度”; it is a budget and cash-flow execution hint, not a comprehensive investment or solvency risk rating.
- Asset-baseline deductions apply when required snapshot data is incomplete.
- A month with neither a plan nor current-month activity is not scored. It returns `score: null`, `status: insufficient`, and the UI displays “待评估”.
- Threshold boundaries and representative healthy/stressed scenarios have direct regression tests.

### Upcoming Reminders

- `upcomingReminders` derives payday, subscription-renewal, and repayment-due reminders from existing data without new schema.
- `upcomingFinanceEvents` standardizes explicit future payday, renewal, and repayment records for configurable 7/14/30-day horizons; unknown amounts remain null and overdue records are excluded.
- The Dashboard status bar and a right-side card surface the next seven days of reminders; overdue items are flagged negative.

### Runtime Structure

- `index.html` loads 28 ordered browser scripts.
- The dependency-free classic-script runtime is an explicit contract: the complete 28-file order and every top-level declaration are checked deterministically.
- State normalization, UI feedback, validators, migrations, storage, calculations, rendering, form bindings, orchestration, optional sync, and PWA responsibilities are split into focused files.
- The project gate enforces the load order and prevents UI feedback, render context, form submission, shared controls, and secondary-workspace shell selectors from drifting back into the wrong files.
- The Data page hierarchy is local-first: manual export, verified automatic backup/restore, full JSON recovery, append-only CSV ledger import, and audit history appear before collapsed experimental cloud sync.
- PWA orientation is `any`. Mobile home actions and shared buttons use 44 px targets; Dashboard context copy is at least 12 px at the narrow breakpoint, horizontal cards expose a text cue and visible scrollbar, status colors pass WCAG AA on the primary surface, and reduced-motion preferences are honored.
- Dashboard bottom-strip helpers have one active definition; retired pie/trend renderers and their stale DOM paths are removed.
- `styles/pages.css` and `styles/subpages.css` are import-only entries backed by six business-page modules and two secondary-workspace modules. The retired hierarchy override layer is gone; workspace structure and component hierarchy have one owner in `workspace-base.css`.

## 3. Verification Evidence

- `scripts/app-data-safety.test.js`: 69 tests, including large-backup, schema-v6 payroll-withholding, unknown-health, and storage-state regressions.
- `scripts/app-ledger-import.test.js`: 5 tests covering quoted CSV parsing, four-type mapping, explicit duplicate decisions, invalid rows, and append-only full-state validation.
- `scripts/app-render-smoke.test.js`: 41 tests, including first-use semantics, action semantics, and honest download-copy regressions.
- `scripts/pwa-assets.test.js`: 9 tests, including orientation and Data-page hierarchy regressions.
- `scripts/finance-ledger.test.js`: 9 tests.
- `scripts/app-idb.test.js`: 7 tests, including a 6500-row verified backup round trip.
- `scripts/browser-real-flow.test.js`: 1 real-browser gate that launches an installed Edge/Chrome at 390×844 through localhost and verifies empty-state truth, score explanation, CSV preview, sample save/render, IndexedDB round trip, full create/edit/transfer/reconcile/archive/reload behavior, 44 px actions, accessible names, page-level overflow, font floor, horizontal overflow cue, semantic nodes, Data hierarchy, and orientation.
- `scripts/browser-visual-regression.test.js`: 2 deterministic screenshot scenarios at 1440×900 and 390×844, with reviewed PNG baselines, anti-aliasing tolerance, and hard failure for material pixel drift.
- Total automated business assertions in the seven data/render suites remain 141, plus the CRUD/reload browser flow and two visual scenarios.
- All JavaScript files pass syntax checking.
- The project gate rejects duplicate browser globals, script or page-CSS order drift, CSS cache-version drift, layer-boundary drift, missing literal DOM IDs, CSS `!important` growth above the audited baseline, retired brands, broken Markdown links, Git whitespace errors, and private-ledger tracking.
- Real-browser evidence is recorded in `docs/BROWSER_E2E_VERIFICATION.md`. The mobile CRUD/reload gate and desktop/mobile screenshot comparison are dependency-free and automated; cross-browser/OS aesthetic review remains a release check.

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

The same dependency-free gate now includes a locally installed Edge/Chrome run. Environments running the gate must provide one of those Chromium binaries (or set `CHROME_PATH`); no npm browser package is introduced.

## 6. Release State

- Local implementation: verified.
- Source commit: `4c41d31a820d7b745e2883be3b4784673bfe87f9`, pushed on `codex/subpage-workspace-redesign`.
- Merge: PR #10 merged into `main` as `a2ddf6c4b4d768ee3f316003889e062c4e1d4aa4` on 2026-08-31.
- CI: GitHub Actions `Project Check` run `33341569884` completed successfully for the merge commit.
- Deployment: GitHub Pages build/deployment run `33341569443` completed successfully for the same merge commit.
- Live verification: the Vercel production site declared by the repository `homepage` was opened on 2026-08-31. The live Dashboard exposed the new evidence-based empty states and `实际现金净流入`; the Data page exposed the independent CSV `流水导入`, payroll-withholding copy, JSON recovery, audit history, and the local-first ordering before experimental cloud sync.
- Vercel's internal deployment marker was not available from this repository session; live content was verified by user-visible behavior rather than claimed from an unobserved provider record.
