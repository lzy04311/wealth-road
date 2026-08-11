# Backend Sync Design

Date: 2026-06-07

## Scope

Add multi-device sync to the existing local-first personal finance app.

The first backend version uses Supabase Auth with email OTP or magic-link login, plus one cloud table that stores the complete app `state` as JSON. The existing browser `localStorage` flow remains the primary runtime path so the app still opens quickly and works offline.

## Goals

- Support the same user opening the app on multiple devices.
- Keep the current `localStorage` key and current state field names unchanged.
- Avoid a broad rewrite, frontend framework, custom backend server, or multi-table data model.
- Make sync failures non-destructive: local save must still work even when cloud sync fails.
- Prevent silent data loss when local and cloud versions diverge.

## Non-Goals

- No phone login in the first backend version.
- No real bank, broker, fund, or market data integration.
- No automatic per-record merge for incomes, expenses, investments, snapshots, accounts, or assets.
- No full SaaS admin system.
- No migration away from `localStorage`.

## Recommended Architecture

Use Supabase for authentication and persistence:

- Supabase Auth: email OTP or magic link.
- Supabase Postgres: one `user_finance_states` table.
- Row Level Security: each user can read and write only their own row.
- Frontend sync modules: small plain JavaScript files loaded by `index.html`.

Cloud table shape:

```sql
create table user_finance_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
```

The `state` JSON must remain compatible with the current pipeline:

```text
validateImportData -> migrateState -> normalizeState
```

## Frontend Components

Add three small scripts:

- `scripts/app-backend-config.js`
  - Holds Supabase project URL and anon key.
  - Must not contain service-role or admin secrets.

- `scripts/app-auth.js`
  - Initializes Supabase client.
  - Sends login OTP or magic link to an email address.
  - Tracks current session and signed-in user.
  - Supports logout.

- `scripts/app-sync.js`
  - Pulls cloud state for the signed-in user.
  - Pushes current local state to cloud.
  - Compares local and cloud timestamps.
  - Shows conflict choices through the existing modal style.

Small existing-file changes:

- `index.html`
  - Load Supabase CDN script or a local vendored client script.
  - Load the three new app sync scripts after the existing state/storage scripts and before action binding if needed.
  - Add a compact login/sync panel to the Data page.

- `scripts/app-storage.js`
  - Preserve the current `STORAGE_KEY`.
  - Track a local updated timestamp used for cloud conflict comparison.

- `scripts/app-actions-data.js`
  - Reuse the existing export path for manual backup before destructive cloud actions.

## Data Flow

Startup:

```text
1. Load local state from localStorage.
2. Render app immediately.
3. If a Supabase session exists, fetch cloud state.
4. Validate, migrate, and normalize cloud state.
5. Compare local and cloud updated timestamps.
6. If cloud is newer or conflict is possible, ask the user what to do.
```

Local save:

```text
1. Existing form action updates state.
2. Existing save() writes localStorage.
3. If signed in, enqueue or attempt cloud push.
4. If cloud push fails, keep local data and show a sync warning.
```

Manual sync actions:

- Pull cloud to this device.
- Push this device to cloud.
- Export local backup before overwrite.
- Logout.

## Conflict Handling

Use manual conflict resolution in the first version.

When both local and cloud have changed since the last known sync, do not auto-merge. Show choices:

- Use cloud data on this device.
- Keep local data and upload it to cloud.
- Export local backup first, then decide.
- Cancel.

This keeps behavior stable and prevents silent overwrites. Automatic record-level merge can be considered later only after there are focused tests for IDs, deletes, edits, and duplicate prevention.

## Error Handling

- If auth fails, keep the app in local-only mode.
- If cloud fetch fails, keep local data and show a non-blocking warning.
- If cloud state fails validation, reject it and keep local data.
- If cloud push fails, keep local data and show "local saved, cloud sync failed".
- If Supabase is not configured, hide or disable login/sync controls and keep local-only behavior.

## Security

- Use only Supabase anon key in the browser.
- Enable Row Level Security.
- Policy: authenticated users can only select, insert, update, and delete their own `user_id` row.
- Never commit personal exported JSON backups.
- Do not store the Supabase service role key in the frontend.

Suggested RLS policy shape:

```sql
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

## Testing

Add focused tests without introducing a test framework:

- Local load still works without Supabase config.
- Cloud state must pass validation before replacing local state.
- Future schema versions from cloud are rejected.
- Cloud push failure does not roll back local save.
- Conflict detection chooses no automatic overwrite.

Keep existing checks:

```powershell
node scripts\app-data-safety.test.js
node scripts\app-render-smoke.test.js
Get-ChildItem scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Implementation Order

1. Create Supabase project and table with RLS.
2. Add backend config placeholder file.
3. Add auth module and Data page login UI.
4. Add cloud fetch and push helpers.
5. Add conflict detection and modal choices.
6. Hook cloud push after successful local save.
7. Add tests for sync helpers and no-config behavior.
8. Verify local-only behavior still works.

## Open Decisions

- Supabase project URL and anon key are not yet provided.
- Magic-link redirect URL depends on how the app will be hosted.
- The first implementation should use manual sync controls plus safe automatic upload after local save; automatic pull should ask before overwriting.
