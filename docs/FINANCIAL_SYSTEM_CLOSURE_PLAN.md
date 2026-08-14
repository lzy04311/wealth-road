# Financial System Closure Plan

Last verified: 2026-08-15

## Current Assessment

The App is a locally verified, local-first personal finance system. Its current reliable loop is:

`manual entry -> validated schema v5 state -> localStorage save -> monthly/wealth views -> JSON export/import`

The current code includes real money accounts, two-sided transfers, purpose allocations, balance reconciliation, historical account-link repair, and responsive form drawers. This document records local engineering evidence only; commit, merge, deployment, and live status must be verified from their own systems.

## Verified Current Capabilities

### Financial Correctness

- Fund pools (`accounts`) and real money locations (`moneyAccounts`) are separate dimensions.
- Opening balances and effective dates are included in balance calculations.
- Income, expense, investment, and transfer records can reference their actual money locations.
- Real-account transfers are two-sided and conserve total owned cash.
- Referenced fund pools and real accounts are archived instead of deleted.
- Balance reconciliation records an auditable adjustment without rewriting the opening balance.
- Month is derived from record date during normalization.
- Liabilities reduce net worth; unresolved cash/investment asset items are excluded to avoid double counting.
- Snapshot-based monthly change adjusts for ledger contributions between snapshot dates.

### Workflow Closure

- Existing fund pools and real accounts can be edited, archived, and restored.
- Historical records missing real-account links are listed for explicit user repair.
- New income, expense, and investment records require real-account selection once real accounts exist.
- JSON import backs up current state before applying validated migrated data.
- Cloud-pull conflict handling backs up local state before replacement and does not auto-overwrite conflicting local changes.

### Verification

- 41 data safety, import-integrity, browser-fixture, score-model, and financial-invariant tests pass.
- 24 render, interaction, health-explanation, auth fallback, and sync-safety smoke tests pass.
- 8 PWA asset and product-brand contract tests pass.
- 9 append-only finance-ledger tests pass.
- All JavaScript files pass syntax checking.
- Duplicate browser globals, missing literal DOM IDs, and CSS override growth are blocked by the project gate.
- Local browser sanity checks pass for all primary modules and the responsive form drawer.

## Remaining Gaps

### P0: Release And Recovery Evidence

1. No canonical deployed/live surface or release marker is documented, so local verification cannot be promoted to a deployment claim.
2. The actual private ledger and real browser data are intentionally outside repository tests; user-data correctness is not implied by fixture results.
3. Schema migrations are covered by synthetic backups, but acceptance against a user-controlled real export still requires an explicit, privacy-preserving test.

### P1: Financial And Workflow Depth

1. ROI is a snapshot/principal view and monthly change is contribution-adjusted, but annualized return, drawdown, and richer performance attribution are not decision-grade.
2. “月度执行健康度” version 1 is locally tested, but it is an execution hint rather than a structural financial-risk model.
3. Rules, subscriptions, and goals remain mainly descriptive; they do not yet form a complete alert or recurring-action system.
4. Historical records require manual account repair; no automated mapping should be added without explicit user-approved rules.

### P2: Verification And Optional Sync

1. The complete browser workflow is locally verified with isolated fixtures, but durable browser automation is not yet part of CI.
2. Dashboard pixel-level comparison remains pending even though runtime and responsive sanity checks pass.
3. Supabase support is present but unconfigured. Before enabling it, verify authentication, RLS, redirect URLs, versioned writes, concurrent-device conflicts, and deployment configuration.

## Delivery Sequence

### Phase 1: Preserve Raw Facts — `verified-current`

- Keep `data/raw/wealth-events.csv` append-only and private.
- Preserve exact source text, imported payloads, IDs, timestamps, and integrity hashes.
- Record corrections as new events instead of rewriting history.

### Phase 2: Establish One Financial Truth — `locally verified`

- Schema v5, opening balances, real accounts, two-sided transfers, allocations, reconciliation, archive behavior, and historical repair are locally verified.
- Every integration must preserve the localStorage key and run the full migration, finance-invariant, render, ledger, PWA, and syntax gates.

### Phase 3: Strengthen Data Quality — `locally verified`

- Entity-level validation, unique-ID checks, referential integrity, transfer endpoint rules, and reconciliation invariants are locally verified.
- Complete browser workflow coverage using isolated fixture data is recorded in `docs/BROWSER_E2E_VERIFICATION.md`; CI automation remains a separate pending release-engineering item.

### Phase 4: Deepen Decisions — `pending`

- Define the required performance metrics before implementing annualized return or drawdown.
- Turn selected goals, rules, and subscriptions into explicit actions only when their product behavior is agreed.

### Phase 5: Optional Sync And Release — `pending`

- Keep sync in local-only fallback until deployment configuration and multi-device conflict behavior are verified.
- Distinguish committed, pushed, merged, deployed, live verified, knowledge closed, and cleaned states in every release closeout.
