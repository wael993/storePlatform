# Tenant backup (API, web Settings → Backup, Google Drive / Dropbox / OneDrive)

## Decisions

| Topic | Decision |
| --- | --- |
| Entitlement | Superadmin enables page `BACKUP` on the tenant (like `INVOICE_AI`) + `backupRetentionCount` (1–30, default 3) via `PATCH /tenants/:id`. Expired subscription → writes (incl. backup/restore) 403. |
| Who | Owner role only, every `/backup` endpoint (server-enforced; `admin`, `cashier`, `employee`, `super_admin` get 403, `backupAccess.test.ts`). Not a SEE flag: the owner cannot grant it to other roles, and other roles never see the tab. |
| Encryption | `BACKUP_MASTER_KEY` (env, base64 32 bytes) → HKDF per tenant + purpose. AES-256-GCM for archives and for stored provider refresh tokens. Key never in the archive. **Losing the env key = all backups and connections unreadable.** No key → backup feature off (cron not started, endpoints 422). |
| Change detection | `platform.tenant_backup_states.data_version` +1 once per mutating tenant request (`bumpTenantDataVersion` middleware, after response; 4xx and `/backup` paths excluded). `last_backup_version` only moves on COMPLETED (max). The version is read inside the backup's snapshot, so a write after it is backed up next run. |
| Queue | `platform.tenant_backups` is both job queue and history. Scheduler (cron `BACKUP_SCHEDULE`, default `0 3 * * *`, `CRON_TIMEZONE`) only inserts PENDING jobs; in-process worker polls every 10 s, claims with `FOR UPDATE SKIP LOCKED` (one job → one worker, also across instances), max `BACKUP_WORKER_CONCURRENCY` (default 2: each job holds one read connection for its snapshot) per instance. Partial unique index `tenant_backups_one_in_flight`: one scheduled / manual job in flight per tenant. |
| Format | v2 (Postgres). Lines: manifest JSON, then `<table>\t<row JSON>` per row → gzip → AES-256-GCM. File: `SPBK` + format byte `2` + IV … ciphertext … tag. Row JSON is Postgres' own `row_to_json` text and is restored with `json_populate_recordset` unchanged, so `numeric` digits, timestamps, arrays and jsonb round-trip exactly (no JS numbers). Read through one server-side cursor per table (1,000-row fetches) inside one `REPEATABLE READ READ ONLY` transaction = one consistent snapshot of the tenant. Streaming to a temp file. |
| Providers | Driver registry `shared/backup/drivers/index.ts` (shared OAuth/HTTP plumbing in `drivers/http.ts`). Only drivers with env credentials are offered (`configured`); old backups stay restorable via `getDriver`. Google Drive: scope `drive.file`. Dropbox: App-folder app, `token_access_type=offline`, refresh tokens don't rotate. OneDrive: `Files.ReadWrite.AppFolder` (approot), **refresh token rotates → driver saves it via `connection.save`**, chunked upload session (10 MiB, 320 KiB-aligned). Connections stored per provider, so backups made before a switch stay restorable and retention can delete them. |
| Web UI | Settings → Backup tab (`components/settings/BackupSettings.tsx`): owner + tenant page `BACKUP` only; online only. Toggle, per-provider connect / change account / use / disconnect, Backup now, history (polls every 4 s while a job or restore runs), restore with confirm + status banner + Reload. The success banner shows the first time that restore is seen, then not on later logins. OAuth returns to `/settings?backup=…`, which opens the tab and toasts the result. Superadmin sets retention in Tenants → access modal. |
| Offline devices | `GET /sync/changes` answers `{ resetRequired: true }` when a restore started or finished after `since`; the client re-bootstraps (only with an empty outbox, otherwise on the next pull). |

## Tables

`shared/backup/tables.ts`: every `store.*` table is backed up (restore order = declaration
order in `schema/store.ts`, parents before child tables; delete runs in reverse) except
`EXCLUDED_TABLES` (with reason): `offline_sync_states`, `sync_mutations` (must not roll back),
`negative_quantity_snapshots` (derived), `product_import_sessions` (drafts), `notification_reads`
(per-user UI state). A new store table is backed up by default. `backupTables.test.ts` checks the
exclude list, parent-before-child order and `tenant_id` on every backed-up table. Never in a backup:
`platform.*` (users, tokens, tenant, billing, newsroom, the backup tables).

**Schema fingerprint:** the manifest holds a hash of the backed-up tables and their columns
(`BACKUP_SCHEMA_FINGERPRINT`). A restore refuses a file with another fingerprint
(`RESTORE_VALIDATION_ERROR`). After a migration that changes a backed-up table, older files cannot
be restored until a converter exists; take a fresh backup after such a deploy.

## Flows

- **Connect:** `POST /backup/connections/google_drive` → `{url}` → Google → `GET /backup/oauth/callback?code&state`
  (no bearer; `state` = 10-min JWT with tenantId+provider+nonce, aud `backup-oauth`; the nonce is stored on `tenant_backup_states.oauth_nonce` at connect and consumed once by the callback, so a copied or replayed `state` is refused; login tokens without `userId` are refused) → tokens stored, provider becomes active →
  redirect `FRONTEND_URL/settings?backup=connected|cancelled|error`.
- **Switch provider:** `PATCH /backup {provider}` — must already be connected; `testConnection` first. Old backups untouched.
- **Backup now:** `POST /backup/run` → checks enabled + provider + connection test → PENDING job (returns in-flight job if one exists). Poll `GET /backup/history`.
- **Job:** snapshot transaction → read `dataVersion` → stream the tenant's rows (`tenant_id` filter per table) → encrypt → upload → verify remote size → COMPLETED → `lastBackupVersion = max(…, version)` → retention, not after a safety backup and not while a restore holds the lock (newest N COMPLETED regular and, separately, newest N safety backups kept; older deleted through *their* provider; undeletable ones kept and retried later). Failure → FAILED + `errorCode`, tenant stays eligible.
- **Restore:** `POST /backup/:backupId/restore` → tenant write lock + restore status `RUNNING` stored → 202. Lock = `tenants.backupRestoreStartedAt` (owner token) + `backupRestoreHeartbeatAt` (refreshed every 30 s); while the heartbeat is fresh all writes → 423 `BACKUP_RESTORE_IN_PROGRESS` and scheduled backups of the tenant are not queued → download via the backup's provider → decrypt (GCM tag = integrity) → validate format version, tenantId, schema fingerprint, and **every** row's table + `tenant_id` → safety backup (active provider, must succeed) → **one transaction:** raise the selling and buying number floors and next offline-block starts to today's highest number + 1 (no printed SI/BI number is issued again), delete the tenant's `sync_mutations` processed at or after the archive's `snapshotAt` (DB start time of the backup's snapshot transaction; older archives: `createdAt`) so a device retrying work the restore undid runs it again, delete the tenant's rows (children first), insert from the archive, check inserted = rows in file, check the lock is still this restore's and live (else roll back); any error rolls back and the tenant keeps its data → `dataVersion+1`, Redis tenant keys and this instance's SEE cache dropped, lock released (only if still this restore's). Status writes only touch this restore's record (`restore.startedAt` = lock token). Status in `GET /backup` → `restore`.
- **Heartbeat:** a running job (`tenant_backups.updated_at`) or restore (`backupRestoreHeartbeatAt`) beats every 30 s. No beat for 5 min = crashed (process killed, deploy): job → FAILED `WORKER_TIMEOUT`, restore lock free, `GET /backup` shows the restore as FAILED. Beating stops after 2 h, so a hung run goes stale too; a restore that lost its lock rolls back at commit. Job status updates only apply while the row is in flight: a hung worker can never complete a stale-failed job (its uploaded file is removed, `lastBackupStatus` is not touched). A failed restore leaves `dataVersion` and the Redis cache untouched. Enabling backups tests the provider connection first.
- **Offline device after a restore:** with waiting or failed outbox items it does not re-download (that would drop them) and shows a banner (`offline.restoreResetPending`) until they are synced or removed.

## Error codes (stored on job / restore; customers see code only)

`GOOGLE_AUTH_ERROR`, `GOOGLE_DRIVE_ACCESS_ERROR`, `PROVIDER_NOT_CONNECTED`, `DATABASE_ERROR`,
`BACKUP_SERIALIZATION_ERROR`, `ENCRYPTION_ERROR`, `UPLOAD_ERROR`, `DOWNLOAD_ERROR`,
`RESTORE_VALIDATION_ERROR`, `TENANT_VALIDATION_ERROR`, `SAFETY_BACKUP_FAILED`, `RESTORE_ERROR`,
`RESTORE_IN_PROGRESS`, `WORKER_TIMEOUT`. Technical message only in logs / `tenant_backups.error_message`.

## Env

`BACKUP_MASTER_KEY` (`openssl rand -base64 32`), `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`,
`DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`,
`BACKUP_OAUTH_REDIRECT_URI` (public API URL + `/api/data/backup/oauth/callback`; register the **same** URL in Google, Dropbox and Azure),
optional `BACKUP_WORKER_CONCURRENCY`, `BACKUP_SCHEDULE`. Google app in "Testing" → add test users. Dropbox: scoped app, App folder,
scopes `files.content.write`, `files.content.read`, `account_info.read`. Azure app: platform Web, delegated `Files.ReadWrite.AppFolder`, `User.Read`, `offline_access`, account types incl. personal.

## Known limits (`shortcut:` in code)

- No converter for files made before a migration that changed a backed-up table (fingerprint refuses them).
- A write request already past the lock check when a restore starts can still commit before or after the restore transaction. No other writer bypasses the lock: crons only write `negative_quantity_snapshots` (not backed up) and platform tables.
- A deploy or crash during a restore keeps tenant writes blocked for up to 5 min (heartbeat timeout); the restore itself rolls back.
- OAuth `state` is bound to tenant + nonce, not to the browser: whoever opens the consent URL within 10 min connects their account. Archives stay encrypted with the server key, so that account only receives ciphertext.
- Safety backups are kept apart: N regular plus up to N safety backups. With retention 1, the next scheduled backup after a restore removes the restored-from backup, not the safety one.
- `dataVersion` bump is after commit, not in the business transaction; scripts/crons don't bump.
- Outbox items queued offline before a restore still replay onto the restored data (they are real user actions).
- No per-provider rate limit; one concurrency limit per API instance (replicas multiply it).
- Google upload is one PUT (no chunk resume); Dropbox single request ≤ 150 MB.
- FAILED records are pruned after 30 days (at the next successful backup).
