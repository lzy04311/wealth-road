# Browser E2E Verification

Last verified: 2026-08-31

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
7. Exported a complete JSON backup. The UI distinguished a verified File System Access write from a fallback browser download and, for the fallback, asked for confirmation in the browser download list instead of claiming success.
8. Imported the v5 recovery fixture through the v6 migration chain. The UI formed an IndexedDB checkpoint, read it back, disclosed whether verification succeeded, and restored one real account, income `321`, and net worth `1321`.
9. Edited the restored account name and note and verified the updated values in the rendered account card.
10. Imported the empty fixture to remove synthetic test data. The final state showed zero real accounts and zero income.

## Additional Checks

- `tests/fixtures/ledger-import-sample.csv` 可用于手工复核流水导入的文件选择、字段映射与预览流程；停在确认写入前退出不会修改本地数据。

- Product title and visible brand remained `财记` throughout the workflow.
- The tested viewport had `clientWidth = 668` and `scrollWidth = 668`, so no page-level horizontal overflow was present.
- The project gate validates both browser fixtures through the production import pipeline before browser testing.

## Automated Real-Browser Quality Gate

`node scripts/browser-real-flow.test.js` starts an ephemeral localhost server and a clean-profile installed Edge/Chrome at a fixed `390 × 844` viewport. It verifies:

- pristine state displays “待评估 / 待建账 / 待记录” and renders the three-step onboarding;
- the health pill opens the current versioned score rules;
- the compass contains exactly three actionable buttons and three read-only status nodes;
- mobile home actions are at least `44 × 44px`, context text is at least `12px`, and the six-card data strip is horizontally scrollable with a visible cue;
- the independent CSV ledger parser renders a real preview for net salary and payroll withholding before any write;
- the production v5 sample migrates to v6, saves through localStorage, re-renders as rated data, and round-trips through IndexedDB with matching record count;
- export, automatic backup/restore, JSON recovery, and CSV ledger append precede collapsed experimental cloud sync;
- the PWA manifest allows any orientation.

This gate is invoked by `node scripts/check-project.js` and adds no npm or runtime dependency. The host must have Edge/Chrome installed or expose a compatible path through `CHROME_PATH`.

## Production Release Verification

- PR #10 merged source commit `4c41d31a820d7b745e2883be3b4784673bfe87f9` into `main` as `a2ddf6c4b4d768ee3f316003889e062c4e1d4aa4` on 2026-08-31.
- GitHub Actions `Project Check` run `33341569884` and Pages deployment run `33341569443` both completed successfully for the merge commit.
- The Vercel production site declared by the repository `homepage` was opened after deployment. The live Dashboard rendered the evidence-based first-use state and `实际现金净流入`; the live Data page rendered export, automatic backup/restore, full JSON recovery, independent CSV ledger append, audit history, and collapsed experimental cloud sync in the expected order.
- This live check did not submit forms or write financial records. It confirms the public user path and deployed feature presence, not Vercel provider-side deployment metadata.

## Dashboard Runtime Sanity

- Local HTTP entry and all requested app-shell resources loaded successfully.
- Dashboard plus Flow, Investments, Assets, Goals, Accounts, and Data navigation worked.
- No application console warnings or errors were observed.
- No page-level horizontal overflow was observed at the tested desktop and narrow viewports.
- The secondary-page form drawer and no-account reconciliation guidance worked.

## Boundary Refactor Regression

- All 28 ordered browser scripts loaded, including the isolated CSV ledger import action module.
- `styles/controls.css` loaded through the root stylesheet; visible inputs retained a 44px minimum height and primary buttons retained a 40px minimum height.
- `styles/pages.css` and `styles/subpages.css` loaded as import-only entries, and all six business-page plus two secondary-workspace modules were present in the active stylesheet graph.
- After consolidating the secondary-workspace shell into `workspace-base.css`, browser-computed styles for the app width, module header, back button, title, description, pseudo-element, and context bar matched the pre-change baseline exactly.
- After removing the final `hierarchy.css` override layer, computed styles for Flow, Investments, Assets, Goals, and Data workspace components matched the pre-removal baseline exactly.
- Final narrow-viewport navigation covered Flow, Investments, Assets, Goals, Accounts, and Data; every page remained free of document- and body-level horizontal overflow.
- Flow and Accounts navigation, quick entry, and the real-account form drawer opened correctly.
- Desktop and narrow viewport checks showed no page-level horizontal overflow, including while the form drawer was open.
- No application console warnings or errors were observed, and no form was submitted during this structural verification.

This evidence verifies runtime structure, not pixel parity. The remaining visual comparison uses [`docs/assets/reference-dashboard.png`](assets/reference-dashboard.png) and must cover the top bar, three-column body, bottom data strip, status/navigation row, text clipping, and responsive breakpoints.

## Repair Regression

- The account drawer focused its first field on open, trapped forward Tab navigation at the final close button, closed on Escape, and restored focus to the triggering button.
- Every remaining `.field > label` resolved to a live form control; the Supabase same-origin client-script field was required.
- The Data page rendered the IndexedDB audit panel on demand.
- Browser asset query versions and the service-worker cache are aligned at `v34`; the application initializes and renders every tested workspace without new console warnings or errors.
- Archived-account valuation, opening-date filtering, server-side compare-and-swap sync conflicts, and bounded IndexedDB audit retention are covered by deterministic regression tests. No live Supabase project was exercised.

## Automation Boundary

The narrow-screen behavioral, layout, storage, and semantic contract is automated in a real browser without third-party packages. The longer create/edit/transfer/archive/reconciliation workflow above and pixel-identical screenshot comparison across browser/OS combinations remain manual release checks. The one-command project gate covers Node regressions, the real-browser mobile flow, syntax, script and CSS order, cache coherence, AA status colors, touch targets, reduced motion, documents, branding, Git whitespace, and the private-ledger boundary.
