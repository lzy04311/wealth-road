# Browser E2E Verification

Last verified: 2026-08-15

## Scope

- Surface: `http://127.0.0.1:4173/` served from the repository root.
- Data boundary: isolated localhost origin with synthetic fixture data only.
- Deployment claim: none. This is local browser verification, not deployed or live verification.
- Fixtures:
  - `tests/fixtures/browser-e2e-backup.json`
  - `tests/fixtures/browser-empty-backup.json`

## Verified Workflow

1. Created two real money accounts with opening balances of `1000` and `100`.
2. Recorded income `500` into the bank account and assigned it to the daily-use pool.
3. Recorded expense `20` from the wallet account.
4. Transferred `50` from the bank account to the wallet without changing total owned cash.
5. Reconciled the bank account from book balance `1450` to actual balance `1445`; the UI recorded adjustment `-5`.
6. Attempted to delete the referenced wallet account; the UI required a second confirmation, archived it, and the feedback action restored it.
7. Exported a complete JSON backup and received the success notification.
8. Imported the v5 recovery fixture. The UI showed the pre-import safety-backup confirmation and restored one real account, income `321`, and net worth `1321`.
9. Edited the restored account name and note and verified the updated values in the rendered account card.
10. Imported the empty fixture to remove synthetic test data. The final state showed zero real accounts and zero income.

## Additional Checks

- Product title and visible brand remained `财记` throughout the workflow.
- The tested viewport had `clientWidth = 668` and `scrollWidth = 668`, so no page-level horizontal overflow was present.
- The project gate validates both browser fixtures through the production import pipeline before browser testing.

## Remaining Boundary

This workflow is repeatable with the committed fixtures, but the browser interaction itself is not yet executed by CI. The one-command project gate covers deterministic Node tests, syntax, documents, branding, Git whitespace, and the private-ledger boundary.
