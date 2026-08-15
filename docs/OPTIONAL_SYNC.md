# Optional Sync Boundary

Last verified: 2026-08-15

## Current Status

- Supabase support is optional and disabled by default.
- `scripts/app-backend-config.js` contains empty project URL, anon key, and client-script values, so the application remains local-only.
- `scripts/app-auth.js` and `scripts/app-sync.js` provide guarded authentication, state transfer, conflict detection, and local fallback paths.
- Current Content Security Policy permits same-origin scripts only; no broad CDN client is loaded.
- This repository contains no verified Supabase project, RLS deployment, redirect configuration, release marker, or multi-device acceptance evidence.

These facts describe dormant capability, not authorization to enable cloud sync.

## Stable Contract

- Keep the existing `localStorage` main key and state field names unchanged.
- Local load and save remain the primary path and must work without network access or backend configuration.
- Cloud state must pass `validateImportData -> migrateState -> normalizeState` before use.
- Unknown future schema versions and invalid references must be rejected.
- Cloud replacement must create a local JSON backup first.
- Two-device edits require an explicit user choice; do not auto-merge or silently overwrite.
- Cloud failure must never roll back a successful local save.

The first supported backend shape remains one authenticated row per user containing `user_id`, `schema_version`, the complete state JSON, and `updated_at`.

## Activation Gate

Enabling sync requires all of the following:

1. A user-owned Supabase project and `user_finance_states` table.
2. Row Level Security with select, insert, and update policies restricted to `auth.uid() = user_id`.
3. Browser use of an anon key only; service-role or administrator secrets must never enter frontend code.
4. A pinned Supabase browser client served from the application origin, or a separately reviewed CSP change.
5. Verified email authentication, allowed redirect URLs, logout, and expired-session handling.
6. Versioned writes, invalid-cloud-state rejection, failed-push recovery, and explicit conflict choices.
7. Tests for local-only startup, missing client behavior, future schema rejection, backup-before-overwrite, and multi-device conflicts.
8. Deployment, canonical-user-path, and rollback verification distinct from local tests.

## Rollback

Clearing the optional backend configuration returns the application to local-only mode. Existing local data and JSON export/import remain usable. A rollback must not delete local state or weaken import validation.

## Open Decisions

- Supabase project URL and anon key.
- Same-origin client packaging and version.
- Authentication redirect URL for the eventual hosting origin.
- The accepted manual-sync and automatic-push behavior across two real devices.

Until these decisions and the activation gate are closed, sync controls must remain disabled or explicitly report local-only mode.
