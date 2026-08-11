# Financial System Closure Plan

## Current Assessment

The current App is usable as a local manual-recording MVP. Its reliable loop is:

`manual entry -> localStorage save -> monthly display -> JSON export/import`

It is not yet a decision-grade wealth system because account balances, transfers, asset valuation, returns, goals, subscriptions, and multi-device state do not share one authoritative model.

## Confirmed Gaps

### P0: Financial Correctness

1. Account balance is calculated as cumulative investment minus cumulative expense. It has no opening balance or income allocation and clamps negative balances to zero.
2. Transfers are one-sided investment records, so money is not conserved and a transfer-out can increase reported surplus.
3. Dashboard return, annualized return, and drawdown use asset-size changes without adjusting for contributions or withdrawals.
4. Existing accounts have no edit, archive, or delete entry in the actual UI.

### P1: Workflow Closure

1. Deleting an account leaves orphan records and removes those expenses from historical totals.
2. Account snapshots and asset inventory can double-count cash and investments; total-asset definitions differ by page.
3. `fixedBudget` is stored but unused, and a default account cannot retain a zero budget percentage.
4. Rules, subscriptions, and goals are mostly descriptive and do not produce executable actions or alerts.
5. Cloud sync is visible but unconfigured; its current push path lacks strong concurrent-write protection.

### P2: Data Quality And Tests

1. Import validation checks top-level shape but not duplicate IDs, relationships, or date/month consistency.
2. Historical health scoring uses today's calendar day.
3. Quick-entry date changes do not automatically update the event month.
4. Existing tests cover crash safety and top-level data safety, not financial invariants or complete browser workflows.

## Delivery Sequence

### Phase 1: Preserve Raw Facts

- Use `data/raw/wealth-events.csv` as the append-only source ledger.
- Preserve exact natural-language source text, imported JSON payloads, IDs, timestamps, and integrity hashes.
- Record corrections as new events instead of rewriting history.

### Phase 2: Establish One Financial Truth

- Add opening balances and explicit income allocation.
- Introduce a two-sided transfer model.
- Archive accounts instead of deleting referenced accounts.
- Derive month from effective date and enforce relationship invariants.
- Add an additive v2 -> v3 migration without renaming existing fields or changing the localStorage key.

### Phase 3: Unify Valuation And Performance

- Link inventory items to account assets or mark them as independently valued.
- Carry forward snapshots per account, not per partial portfolio date.
- Calculate contribution-adjusted investment returns.
- Use one total-asset definition across Dashboard, Investments, Assets, and Goals.

### Phase 4: Close User Workflows

- Add account edit and archive interactions.
- Make fixed and variable budget behavior explicit.
- Add goal deadlines, planned monthly contribution, and next-action guidance.
- Convert subscriptions into recurring expenses or reminders.
- Turn selected rules into validations and actionable warnings.
- Add a repair flow for orphan records.

### Phase 5: Reliability And Optional Sync

- Add entity-level validation, unique-ID checks, referential integrity, and finance invariant tests.
- Add real-browser E2E coverage for record, edit, archive, correction, import, and recovery workflows.
- Keep sync hidden while local-only is the product decision.
- If multi-device use becomes a goal, add authenticated storage, RLS, versioned writes, conflict handling, and deployment configuration before exposing sync controls.
