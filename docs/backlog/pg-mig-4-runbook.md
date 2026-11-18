# PG-MIG-4 — Switch production to Postgres (runbook)

**Window:** night Thursday → **Friday 2026-11-20, 02:00** (Europe/Berlin). All 12 production tenants
keep using Mongo until then. Replaces the per-tenant steps in
[postgres-migration.md](postgres-migration.md) (PG-MIG-4): the ADR decided **one maintenance window
for all tenants** ([../architecture/postgres-migration.md](../architecture/postgres-migration.md),
"Cutover").

**Who:** the owner runs every step (production access stays with the owner). Claude prepares scripts
and checks results it is given, read-only. All commands run in `services/api-store-platform`.

> ⚠️ **Do not merge `pg-migration` into `main` before step 7.** If Render auto-deploys `main`, the
> merge alone deploys the Postgres build to production without a database → production down. Either
> merge only in step 7, or switch **Auto-Deploy off** on the production API service first.

---

## 1. Before the window (all must be ✅ — this is the go / no-go)

| # | Item | State |
| --- | --- | --- |
| G1 | Rehearsal green: biggest tenant (`oneDollar`) and a small one copied to staging, checked, cleaned | ✅ 2026-11-17 |
| G2 | Missing customers in `oneDollar` (#4) understood and handled in the load | ⏳ owner: Mongo check |
| G3 | Owner clicked through `oneDollar` on staging (sales, invoice, cash, parties, reports) | ✅ 2026-11-18 |
| G4 | All 12 production tenants listed (ids + names) | ⏳ owner |
| G5 | Production Postgres created on Render (same region as the API, Frankfurt), empty, migrations applied | ✅ 2026-11-17: `store-platform-prod-db`, PG 18.6, 53 tables, 3 migrations, inbound IP restricted to the owner's Mac |
| G6 | `load-all-tenants.sh` + `reconcile.sql` in the repo and tested | ✅ 2026-11-17: load tested end to end on throw-away DBs (confirm prompt, stop on error, safe rerun); reconcile GREEN on staging with only the accepted findings |
| G6b | **Full dry run of all 12 tenants on staging** (section 4) — every tenant loads, reconcile GREEN, duration noted | ⏳ owner |
| G7 | PR `pg-migration` → `main` open and reviewed, CI green — **merge only in step 7** | ✅ 2026-11-18 reviewed; findings fixed (offline-block lock, rate 0, reconcile purchases, pool close) |
| G8 | Last Mongo build tagged and pushed: `git tag mongo-final origin/main && git push origin mongo-final` | ✅ 2026-11-18 |
| G9 | Device check on staging: a device that used staging before a data reload keeps working without reinstall (ids are unchanged by the migration, so no `resetRequired` is expected to be needed) | ✅ 2026-11-18 |
| G10 | Window announced to the active tenants | — not needed (owner, 2026-11-18) |

## 2. The window (plan ~1–2 h; order matters)

Before starting: `curl -s https://ifconfig.me` — your IP must match the database's inbound rule.

1. **Devices synced.** Every device of the active tenants online until "pending changes" is 0.
2. **Stop writes:** suspend the production API service on Render (the app shows offline). Note the time.
3. **Backup Mongo:** `mongodump --uri '<prod mongo url>' --out ~/backups/mongo-2026-11-20` — keep it
   until the rollback window (step 9) ends.
4. **Load:**
   ```bash
   PROD_MONGO_URL='<prod mongo url>' PROD_MONGO_DB='<prod db name>' \
   TARGET_DATABASE_URL='<prod postgres external url>?sslmode=require' \
   sh scripts/load-all-tenants.sh production        # type LOAD to confirm
   ```
   Must end with `[load-all] done: 12 tenants loaded`. Any refusal (unmapped field, document that
   cannot be loaded, count mismatch) → stop → section 3. A rerun after a fix is safe.
5. **Cleanup:**
   ```bash
   psql '<prod postgres external url>?sslmode=require' -X -f scripts/cutover-cleanup.sql            # read counts
   psql '<prod postgres external url>?sslmode=require' -X -v apply=1 -f scripts/cutover-cleanup.sql
   ```
6. **Reconcile:**
   ```bash
   psql '<prod postgres external url>?sslmode=require' -X -f scripts/reconcile.sql
   ```
   Last row must be `VERDICT … GREEN`. INFO rows must match the dry run (G6b). RED → section 3.
7. **Deploy the Postgres build:** on the production API service set `DATABASE_URL` = the **internal**
   URL of `store-platform-prod-db`; keep `BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING` (still
   required by config until PG-MIG-6). Merge the PR into `main`, deploy, resume the service.
   Migrations run at start (`docker-entrypoint.sh`); the log must show `[db-migrate] done`.
8. **Smoke on production** (owner account): login, one sale (cash), one purchase, a cash transfer,
   a cash exchange, a warehouse transfer, an offline sale + sync; then delete the test records.
   Critical-path rows ★ of [smoke-test-plan.md](smoke-test-plan.md).
9. **Open:** tell the tenants. **Rollback window 14 days:** Mongo and the dump stay untouched.

## 3. Rollback rule

- **Before step 9 (not opened yet):** redeploy the `mongo-final` tag with the old env (no
  `DATABASE_URL` needed), resume the service. Mongo was frozen and is untouched — nothing is lost.
  Production Postgres can be emptied and the window repeated another night.
- **After step 9:** rollback is still possible for 14 days (redeploy `mongo-final`), but every write
  made on Postgres since opening is lost. Only for a blocking defect; decide with the tenants.
- Decision maker: the owner. Rule of thumb: if steps 4–8 fail and the cause is not fixed within 30
  minutes, roll back and reschedule.

## 4. Full dry run on staging (G6b, before Thursday)

Loads all 12 tenants into staging exactly like step 4 (tenants only — staging keeps its own roles,
newsroom and payment settings), then cleanup + reconcile:

```bash
PROD_MONGO_URL='<prod mongo url>' PROD_MONGO_DB='<prod db name>' sh scripts/load-all-tenants.sh staging   # type LOAD
S='<staging external url>?sslmode=require'      # STAGING_DATABASE_URL from .env
psql "$S" -X -f scripts/cutover-cleanup.sql && psql "$S" -X -v apply=1 -f scripts/cutover-cleanup.sql
psql "$S" -X -f scripts/reconcile.sql
```

Send Claude the output (no URLs). Note how long the load took — that sets the window length.
Staging then holds real customer data of all tenants, and the production super-admin and demo
tenants replace staging's (same tenant ids): staging logs in with the production super-admin
password from then on. Delete the copies after the switch (GDPR).

## 5. Decided / after the window

- **Refresh tokens:** the load copies them, so users stay logged in.
- **After the window:** delete the production copies from staging (GDPR); retest smoke 2.5 (S-4,
  log out of all devices); watch the Render logs daily during the rollback window for Postgres
  errors (`23505`, `40P01`, timeouts).
