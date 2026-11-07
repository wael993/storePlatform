# Tenant backup (API, web Settings → Backup, Google Drive / Dropbox / OneDrive)

Spec: [backlog/backup.md](../backlog/backup.md). This file is what shipped.

## Decisions

| Topic | Decision |
| --- | --- |
| Entitlement | Superadmin enables page `BACKUP` on the tenant (like `INVOICE_AI`) + `backupRetentionCount` (1–30, default 3) via `PATCH /tenants/:id`. Expired subscription → writes (incl. backup/restore) 403. |
| Who | Owner role only, every `/backup` endpoint (server-enforced). |
| Encryption | `BACKUP_MASTER_KEY` (env, base64 32 bytes) → HKDF per tenant + purpose. AES-256-GCM for archives and for stored provider refresh tokens. Key never in the archive. **Losing the env key = all backups and connections unreadable.** No key → backup feature off (cron not started, endpoints 422). |
| Change detection | `tenantBackupStates.dataVersion` +1 once per mutating tenant request (`bumpTenantDataVersion` middleware, after response; 4xx and `/backup` paths excluded). `lastBackupVersion` only moves on COMPLETED (`$max`). |
| Queue | `backups` collection is both job queue and history. Scheduler (cron `BACKUP_SCHEDULE`, default `0 3 * * *`, `CRON_TIMEZONE`) only inserts PENDING jobs; in-process worker polls every 10 s, claims atomically (`findOneAndUpdate`), max `BACKUP_WORKER_CONCURRENCY` (default 5) per instance. |
| Format | Frames = BSON docs (manifest first, then `{c, d}` per record) → gzip → AES-256-GCM. File: `SPBK` + format byte + IV … ciphertext … tag. Raw driver cursor / insert, so ObjectId, Decimal128, Date, Int32/Long round-trip exactly. Streaming to a temp file; nothing held in RAM. |
| Providers | Driver registry `shared/backup/drivers/index.ts` (shared OAuth/HTTP plumbing in `drivers/http.ts`). Only drivers with env credentials are offered (`configured`); old backups stay restorable via `getDriver`. Google Drive: scope `drive.file`. Dropbox: App-folder app, `token_access_type=offline`, refresh tokens don't rotate. OneDrive: `Files.ReadWrite.AppFolder` (approot), **refresh token rotates → driver saves it via `connection.save`**, chunked upload session (10 MiB, 320 KiB-aligned). Connections stored per provider, so backups made before a switch stay restorable and retention can delete them. |
| Web UI | Settings → Backup tab (`components/settings/BackupSettings.tsx`): owner + tenant page `BACKUP` only; online only. Toggle, per-provider connect / change account / use / disconnect, Backup now, history (polls every 4 s while a job or restore runs), restore with confirm + status banner + Reload. OAuth returns to `/settings?backup=…`, which opens the tab and toasts the result. Superadmin sets retention in Tenants → access modal. |
| Offline devices | `GET /sync/changes` answers `{ resetRequired: true }` when a restore started or finished after `since`; the client re-bootstraps (only with an empty outbox, otherwise on the next pull). |

## Collections

`shared/backup/collections.ts`: `BACKUP_MODELS` (restore order) and `EXCLUDED_MODELS`
(with reason). `backupCollections.test.ts` fails when a new model is in neither list.
Not backed up: users / refresh tokens (logins), tenant / billing / newsroom (global),
offline sync bookkeeping (`OfflineSyncState`, `SyncMutation` must not roll back),
derived snapshots, import drafts, per-user read state.

## Flows

- **Connect:** `POST /backup/connections/google_drive` → `{url}` → Google → `GET /backup/oauth/callback?code&state`
  (no bearer; `state` = 10-min JWT with tenantId+provider, aud `backup-oauth`) → tokens stored, provider becomes active →
  redirect `FRONTEND_URL/settings?backup=connected|cancelled|error`.
- **Switch provider:** `PATCH /backup {provider}` — must already be connected; `testConnection` first. Old backups untouched.
- **Backup now:** `POST /backup/run` → checks enabled + provider + connection test → PENDING job (returns in-flight job if one exists). Poll `GET /backup/history`.
- **Job:** read `dataVersion` → stream tenant data (asserts every doc's tenantId) → encrypt → upload → verify remote size → COMPLETED → `lastBackupVersion = max(…, version)` → retention (newest N COMPLETED kept; older deleted through *their* provider; undeletable ones kept and retried later). Failure → FAILED + `errorCode`, tenant stays eligible.
- **Restore:** `POST /backup/:backupId/restore` → 202. Tenant write lock (`tenants.backupRestoreStartedAt`; all writes → 423 `BACKUP_RESTORE_IN_PROGRESS`) → download via the backup's provider → decrypt (GCM tag = integrity) → validate manifest version + tenantId and **every** document's tenantId → safety backup (active provider, must succeed) → delete tenant docs in backed-up collections → insert from archive → `dataVersion+1`, Redis tenant keys dropped, lock released. Status in `GET /backup` → `restore`.
- Locks/jobs older than 2 h count as crashed (job → FAILED `WORKER_TIMEOUT`, lock ignored).

## Error codes (stored on job / restore; customers see code only)

`GOOGLE_AUTH_ERROR`, `GOOGLE_DRIVE_ACCESS_ERROR`, `PROVIDER_NOT_CONNECTED`, `MONGODB_ERROR`,
`BACKUP_SERIALIZATION_ERROR`, `ENCRYPTION_ERROR`, `UPLOAD_ERROR`, `DOWNLOAD_ERROR`,
`RESTORE_VALIDATION_ERROR`, `TENANT_VALIDATION_ERROR`, `SAFETY_BACKUP_FAILED`, `RESTORE_ERROR`,
`RESTORE_IN_PROGRESS`, `WORKER_TIMEOUT`. Technical message only in logs / `backups.errorMessage`.

## Env

`BACKUP_MASTER_KEY` (`openssl rand -base64 32`), `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`,
`DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`,
`BACKUP_OAUTH_REDIRECT_URI` (public API URL + `/api/data/backup/oauth/callback`; register the **same** URL in Google, Dropbox and Azure),
optional `BACKUP_WORKER_CONCURRENCY`, `BACKUP_SCHEDULE`. Google app in "Testing" → add test users. Dropbox: scoped app, App folder,
scopes `files.content.write`, `files.content.read`, `account_info.read`. Azure app: platform Web, delegated `Files.ReadWrite.AppFolder`, `User.Read`, `offline_access`, account types incl. personal.

## Known limits (`shortcut:` in code)

- Restore is not one transaction (Mongo 60 s / size limits); a mid-way failure leaves partial data → restore the safety backup.
- `dataVersion` bump is after commit, not in the business transaction; scripts/crons don't bump.
- Outbox items queued offline before a restore still replay onto the restored data (they are real user actions).
- No per-provider rate limit; one concurrency limit per API instance (replicas multiply it).
- Google upload is one PUT (no chunk resume); Dropbox single request ≤ 150 MB.
- FAILED records are pruned after 30 days (at the next successful backup).

## Not done yet

Dropbox and OneDrive are implemented and unit-tested with mocked HTTP but not yet run against real accounts. Next-run time is shown from the cron expression, not per tenant.
