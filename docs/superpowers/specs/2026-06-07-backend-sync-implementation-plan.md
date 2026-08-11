# Backend Sync Implementation Plan

Date: 2026-06-07

Design source: `docs/superpowers/specs/2026-06-07-backend-sync-design.md`

## Constraints

- Keep the current `localStorage` key unchanged.
- Keep the current state field names unchanged.
- Preserve local-first behavior: the app must run without Supabase config.
- Do not add a frontend framework or custom backend server.
- Do not split the state into multiple cloud tables in this phase.

## Phase 1: Configuration and Safe Defaults

Files:

- Add `scripts/app-backend-config.js`
- Modify `index.html`

Steps:

1. Add a config object with empty placeholders for Supabase URL and anon key.
2. Add a helper flag that reports whether cloud sync is configured.
3. Load the config script from `index.html`.
4. Make no-config behavior explicit: login and sync controls should show local-only state instead of throwing errors.

Verification:

- Opening `index.html` without Supabase config still renders.
- Existing render smoke test still passes.

## Phase 2: Auth Module

Files:

- Add `scripts/app-auth.js`
- Modify `index.html`
- Modify Data page markup in `index.html`

Steps:

1. Add a compact Data page auth panel:
   - email input
   - send login link/code button
   - session status
   - logout button
2. Initialize Supabase only when config is present and the client library is available.
3. Implement email OTP or magic-link login request.
4. Read current session on startup.
5. Update auth status without blocking the rest of the app.

Verification:

- With empty config, auth panel reports local-only mode.
- Auth functions fail gracefully if Supabase script is missing.

## Phase 3: Local Sync Metadata

Files:

- Modify `scripts/app-storage.js`
- Possibly add helper tests in `scripts/app-data-safety.test.js`

Steps:

1. Keep `STORAGE_KEY` as-is.
2. Add a separate metadata key for local sync timestamps.
3. Update local metadata only after successful local save.
4. Store:
   - `localUpdatedAt`
   - `lastCloudUpdatedAt`
   - `lastSyncedAt`

Verification:

- Existing corrupted localStorage recovery behavior remains unchanged.
- Failed local save does not update sync metadata.

## Phase 4: Cloud State Read and Write

Files:

- Add `scripts/app-sync.js`
- Modify `index.html`

Steps:

1. Implement `fetchCloudState(userId)`.
2. Implement `pushCloudState(userId, state)`.
3. Cloud writes send:
   - `user_id`
   - `schema_version`
   - full `state`
   - server-side `updated_at`
4. Every fetched cloud state must pass:
   - `validateImportData`
   - `migrateState`
   - `normalizeState`
5. Reject invalid or future-schema cloud data.

Verification:

- Invalid cloud state cannot replace local state.
- Future schema versions are rejected.

## Phase 5: Conflict Detection and User Choice

Files:

- Modify `scripts/app-actions-modals.js`
- Modify or use `scripts/app-sync.js`

Steps:

1. Compare local metadata and cloud `updated_at`.
2. If only cloud is newer, ask before applying cloud state.
3. If local and cloud both changed, show choices:
   - use cloud
   - keep local and upload
   - export local backup first
   - cancel
4. Reuse the existing modal style.
5. Do not auto-merge individual records in this phase.

Verification:

- Conflict path does not overwrite without a selected user action.
- Cancel keeps local state unchanged.

## Phase 6: Save Hook

Files:

- Modify `scripts/app-storage.js`
- Possibly modify `scripts/app-actions.js` only if needed

Steps:

1. After local `save()` succeeds, attempt cloud push if:
   - user is signed in
   - Supabase is configured
   - no unresolved conflict exists
2. Cloud push failure must not roll back the local save.
3. Show status text:
   - local saved
   - cloud synced
   - cloud sync failed

Verification:

- Local form saves still work offline.
- Cloud sync failure keeps local changes.

## Phase 7: Data Page Manual Controls

Files:

- Modify `index.html`
- Modify `scripts/app-sync.js`
- Modify `styles/pages.css` only for small layout styling if needed

Steps:

1. Add manual buttons:
   - pull cloud
   - push local
   - export local backup
2. Disable buttons when logged out.
3. Show last local save and last cloud sync timestamps.

Verification:

- Buttons are disabled or harmless without login.
- Export still uses existing JSON backup behavior.

## Phase 8: Tests and Final Verification

Files:

- Extend `scripts/app-data-safety.test.js`
- Extend `scripts/app-render-smoke.test.js` only if new DOM IDs require it

Tests:

1. Local-only startup does not throw.
2. Missing Supabase config disables sync without breaking render.
3. Cloud state validation rejects arbitrary JSON.
4. Cloud future schema is rejected.
5. Save failure does not update sync metadata.
6. Cloud push failure does not roll back local state.
7. Conflict detection does not auto-overwrite.

Commands:

```powershell
node scripts\app-data-safety.test.js
node scripts\app-render-smoke.test.js
Get-ChildItem scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Manual Supabase Setup Required

Before live sync can work, create a Supabase project and run:

```sql
create table user_finance_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table user_finance_states enable row level security;

create policy "own state select"
on user_finance_states
for select
using (auth.uid() = user_id);

create policy "own state insert"
on user_finance_states
for insert
with check (auth.uid() = user_id);

create policy "own state update"
on user_finance_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

Then provide:

- Supabase project URL
- Supabase anon key
- Allowed auth redirect URL

## Rollback Plan

If sync causes problems:

1. Remove or clear Supabase config values.
2. App returns to local-only mode.
3. Existing `localStorage` data remains usable.
4. JSON export/import remains available for backup and recovery.
