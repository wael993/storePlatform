# MongoDB → PostgreSQL migration

Move the API persistence layer from MongoDB/Mongoose to PostgreSQL so the
store platform matches the usual shape for inventory, invoices, cash ledger,
and future marketplace / online-shop work.

**Context (locked from planning chat)**

- Cash exchange is **already deployed**. Do **not** block this epic on it, and
  do not reopen CASH-EX-* for the migration.
- Production footprint today: **2 active tenants**; other tenants idle for
  months. Cutover risk is mostly those two; dormant tenants can migrate cold.
- Marketing / more tenants and later marketplace + shipping/email/notification
  (and maybe SAP) are reasons to **head toward Postgres**, not reasons to
  big-bang rewrite during a launch week.
- Frontend / Dexie offline stays on HTTP contracts. Do **not** “migrate
  IndexedDB because Postgres.”

**ADR (decisions override this file where they differ):**
[`../architecture/postgres-migration.md`](../architecture/postgres-migration.md):
Drizzle + `pg`, Render Postgres (Frankfurt), Postgres-only repos, single cutover
window, backup out of epic (PG-MIG-5 dropped).

**Approach:** phased. Keep OpenAPI + offline outbox contracts stable. Introduce
Postgres behind repositories, shadow/reconcile, per-tenant cutover, then rewrite
backup and remove Mongo.

**Order:** PG-MIG-0 → PG-MIG-1 → PG-MIG-2 → PG-MIG-3 → PG-MIG-4 → PG-MIG-5 →
PG-MIG-6. Do not start PG-MIG-4 until the go/no-go checklist in PG-MIG-3 passes.

**Keep visible while building**

1. Money and stock must reconcile exactly (cash ledger sums, inventory qty/cost,
   invoice totals) before any tenant flag flips.
2. Offline outbox during cutover — same discipline as restore: empty outbox or
   write lock + re-bootstrap (`docs/reference/backup.md`).
3. Tenant isolation — every query stays tenant-scoped (Postgres helper or RLS),
   same role as `withTenantScope` today.
4. Public business ids (`productId`, invoice numbers, idempotency keys) do not
   change during migration.

**Related shipped docs (constraints, not optional)**

- [`../reference/backup.md`](../reference/backup.md) — BSON/SPBK archives are
  Mongo-shaped; restore lock pattern to reuse.
- [`../reference/cash-accounts.md`](../reference/cash-accounts.md) — ledger +
  balances map; use `numeric`, not float.
- [`../architecture/product-inventory-offline.md`](../architecture/product-inventory-offline.md)
  — offline layers; server store can change, invariants must not.
- [`../architecture/implementation-guide.md`](../architecture/implementation-guide.md)

**Out of epic (separate later work)**

- Building marketplace / public shop (prefer Postgres for that bounded context
  when it starts; may share this DB after cutover).
- Shipping, email, notification, SAP as new services.
- Changing cash-exchange behavior.

---

## PG-MIG-0 — ADR + inventory of Mongo touchpoints

**Type:** Spike / Docs  
**Priority:** High  
**Labels:** postgres, migration, architecture  
**Blocks:** PG-MIG-1

### Summary

Write a short ADR and a complete inventory of what talks to Mongo so the epic
has a fixed scope and no “surprise” collections mid-cutover.

### Do

1. ADR under `docs/architecture/` (e.g. `postgres-migration.md`): why Postgres,
   phased plan, per-tenant `dataStore` flag, rollback = keep Mongo snapshot +
   flip flag back, backup format v2 after cutover, dormant-tenant policy.
2. Inventory checklist:
   - every model under `services/api-store-platform/src/models/`
   - `shared/mongodb/*` (`withTenantScope`, controllers, document actions)
   - every `startSession` / `withTransaction` call site
   - backup `BACKUP_MODELS` / `EXCLUDED_MODELS`
   - scripts (`migrate-*`, seeds, crons)
   - sync: `SyncMutation`, `OfflineSyncState`
3. Freeze rule: no schema-breaking Mongo-only features during the epic except
   production hotfixes.
4. List the 2 active tenants vs dormant (ops note; no secrets in git).

### Acceptance

- [x] ADR checked in and linked from this backlog file
- [x] Inventory lists every model in either “migrate” or “platform/excluded”
  with a one-line reason (mirror backup include/exclude thinking)
- [x] Explicit: cash exchange is out of scope / already shipped
- [x] Explicit: 2 active tenants are the cutover focus

### Out of scope

Writing SQL schema (PG-MIG-1). Coding repositories.

---

## PG-MIG-1 — PostgreSQL schema (business ids unchanged)

**Type:** Story  
**Priority:** High  
**Labels:** postgres, schema, api  
**Depends on:** PG-MIG-0

### Summary

Design and check in the Postgres schema that can hold one full tenant. Keep
string business ids so API and offline identity do not change. Money columns
are `numeric`.

### Hard designs (must decide in this ticket)

| Area | Direction |
| --- | --- |
| Invoice line items | Normalized tables (selling/buying), not only JSONB |
| Cash `balances` map | `cash_account_balances (account_id, currency_id, amount)` + append-only ledger |
| Inventory uniqueness | `UNIQUE (tenant_id, product_id, warehouse_id)` matching current rule |
| Nested `createdBy` / `updatedBy` | One convention (columns **or** small JSONB) for the whole schema |
| Tenant isolation | `tenant_id` on every tenant-owned table |
| Global vs tenant | Same split as backup: users/tokens/tenant/billing/newsroom = platform; business data = tenant |
| Sync | Tables for `sync_mutations` / `offline_sync_states` with same uniqueness/idempotency |

### Do

1. Pick one stack and stick to it: Drizzle **or** Prisma + `pg` (document choice in ADR).
2. Migrations in repo; CI applies them on a throwaway Postgres.
3. Map every migrate-list model from PG-MIG-0 → table(s).
4. One dry-run load of a staging/dormant tenant dump into the schema (manual OK).

### Acceptance

- [ ] Schema checked in; empty migrate up/down works in CI or documented local cmd
- [ ] Money fields are `numeric` (not float/double)
- [ ] Inventory unique constraint matches `(tenantId, warehouseId, productId)`
- [ ] Dry-run can insert one tenant’s worth of rows without inventing new public ids

### Out of scope

Wiring controllers to Postgres. Dual-write. Backup format rewrite.

---

## PG-MIG-2 — Repository boundary + first domains on Postgres

**Type:** Story  
**Priority:** High  
**Labels:** postgres, api, architecture  
**Depends on:** PG-MIG-1

### Summary

Introduce repository ports so controllers stop talking to Mongoose directly over
time. Ship Mongo + Postgres implementations behind a flag
(`DATA_STORE` and/or `tenants.dataStore`). Port the highest-risk domains first.

### Port order

1. Cash accounts + ledger  
2. Inventory + stock movings  
3. Products / catalog  
4. Selling + buying invoices  
5. Parties (customer / supplier / partner) + activity reads that those need  
6. Settings / master data  
7. Sync mutation + offline sync state  
8. Remaining tenant-owned models from the inventory  

Platform globals (Tenant, User, RefreshToken, billing, newsroom) can stay Mongo
until a later ticket inside this epic or until PG-MIG-4 if the inventory says
they must move together — decide in PG-MIG-0 and follow that list.

### Do

1. Thin ports: `controllers/services → repo interface → mongo | postgres`.
2. Per-tenant flag preferred for 2 active tenants (`tenants.dataStore`).
3. Staging: cash + inventory + invoices runnable with flag = postgres for a
   test tenant; API contract unchanged.
4. Keep `withTenantScope` behavior: Postgres path must refuse queries without
   tenant context.

### Acceptance

- [ ] At least cash + inventory + invoices work on Postgres in staging with the
  same HTTP shapes
- [ ] Flag switches implementation without frontend changes
- [ ] Missing tenant context fails closed on the Postgres path
- [ ] One automated check per ported domain that fails if ledger/stock invariants break

### Out of scope

Production cutover. Deleting Mongoose. Backup BSON rewrite.

---

## PG-MIG-3 — Shadow copy + reconcile (go/no-go gate)

**Type:** Story  
**Priority:** High  
**Labels:** postgres, migration, ops  
**Depends on:** PG-MIG-2  
**Blocks:** PG-MIG-4

### Summary

Keep Mongo as source of truth. Copy into Postgres (async or sync). Nightly (or
on-demand) reconcile until numbers match for the pilot and both active tenants.

Prefer **shadow then switch** over long dual-write, given tenant count.

### Reconcile must cover

- Row counts per collection/table (tenant-scoped)
- Cash: ledger sum per account/currency == balances
- Inventory: qty (and average cost where used) match
- Invoice header totals match; line counts match
- `SyncMutation` idempotency key sets match

### Do

1. ETL/copier from Mongo → Postgres for tenant-owned data.
2. Reconcile report (script or admin-only endpoint; no secrets in logs).
3. Run green for **≥ 7 days** on a pilot (dormant or staging clone), then on
   both active tenants’ shadows.
4. Write go/no-go checklist (copy into ops runbook section of ADR or this file).

### Go / no-go before PG-MIG-4

- [ ] Schema covers every migrate-list model  
- [ ] Cash + inventory + invoices green on staging Postgres  
- [ ] Reconcile green for pilot ≥ 7 days  
- [ ] Cutover rehearsal once on staging clone (lock → dump → load → flip → smoke → rollback)  
- [ ] Rollback rehearsal: flag back to mongo + Mongo snapshot still valid  
- [ ] Customer comms plan for the 2 active tenants’ short window  

### Acceptance

- [ ] Reconcile script exits non-zero on mismatch
- [ ] Both active tenants shadow-reconcile green for the agreed window
- [ ] Go/no-go checklist filled and signed off (even if only by you)

### Out of scope

Flipping production flags (PG-MIG-4).

---

## PG-MIG-4 — Per-tenant cutover (2 active + dormant batch)

**Type:** Release / Ops  
**Priority:** High  
**Labels:** postgres, production, migration  
**Depends on:** PG-MIG-3 go/no-go green

### Summary

Cut over tenants one at a time. Reuse the restore write-lock idea
(`backupRestoreStartedAt` / 423) as “migration in progress.” Pilot a dormant
tenant first, then each active tenant, then batch the rest of the idle tenants.

### Per-tenant steps

1. Enable write lock (migration in progress).
2. Drain offline: empty outbox (or block new outbox until done); same spirit as
   restore + `resetRequired` in backup reference.
3. Final Mongo dump → Postgres load.
4. Reconcile must be exact.
5. Flip `tenants.dataStore = postgres`.
6. Smoke: login, sell, buy, cash transfer, cash exchange (already shipped — smoke
   only), stock move, sync pull/push, backup run if enabled.
7. Keep Mongo snapshot frozen for rollback window (**7–14 days**).

### Deploy / ops order

```
1. Backup Mongo (full)
2. Pilot: one dormant tenant end-to-end
3. Active tenant A (maintenance window)
4. Active tenant B (maintenance window)
5. Batch remaining dormant tenants
6. Monitor rollback window; do not delete Mongo yet
```

### Acceptance

- [ ] Dormant pilot cut over and smoke OK
- [ ] Both active tenants on Postgres with reconcile exact at flip
- [ ] Offline devices for active tenants re-bootstrap cleanly if restore/migration signaled reset
- [ ] Rollback path documented and still possible during the window
- [ ] All intended tenants listed as postgres (or explicitly archived)

### Out of scope

Deleting Mongo drivers. New backup format (PG-MIG-5). Marketplace work.

---

## PG-MIG-5 — Backup / restore format v2 for Postgres

**Type:** Story  
**Priority:** High  
**Labels:** postgres, backup, api  
**Depends on:** PG-MIG-4 (at least active tenants on Postgres)

### Summary

Current archives are BSON frames (`SPBK` + gzip + AES) — Mongo-specific. Ship
archive format v2 for SQL/row export, keep encryption envelope where possible,
and force a fresh backup per tenant after Postgres cutover.

### Do

1. Define format v2 (row JSON or `COPY`-friendly), versioned in the archive
   manifest.
2. Rewrite backup worker + restore against Postgres tables; keep
   “every model/table in include **or** exclude list or test fails.”
3. After cutover: mandatory successful backup for every live tenant.
4. Document: pre-cutover SPBK = Mongo-only cold restore (or “not supported on
   Postgres API”). Prefer re-backup over building a BSON→SQL converter unless
   product requires old archives.
5. Update [`../reference/backup.md`](../reference/backup.md) when shipped.

### Acceptance

- [ ] Backup + restore round-trip on Postgres staging tenant
- [ ] Tenant write lock + safety backup behavior preserved
- [ ] Live tenants have at least one COMPLETED v2 backup
- [ ] Reference doc updated; OpenAPI touched if endpoints/fields change
- [ ] Include/exclude inventory test still fails closed when a table is forgotten

### Out of scope

Deleting Mongoose (PG-MIG-6). Changing cloud providers.

---

## PG-MIG-6 — Remove MongoDB dependency

**Type:** Chore  
**Priority:** Medium  
**Labels:** postgres, cleanup  
**Depends on:** PG-MIG-5 + rollback window elapsed with no rollback

### Summary

After all tenants are on Postgres, backups are v2, and the rollback window
passed with no flip-back, delete the Mongo path.

### Do

1. Remove Mongoose models, `shared/mongodb`, Mongo connection, Mongo scripts
   that only serve the old store.
2. Drop `mongoose` from `package.json`; CI/docker no longer needs Mongo for the
   API (keep only if something platform-global intentionally remains — otherwise
   none).
3. Remove `tenants.dataStore` mongo option or hard-code postgres.
4. Update `CLAUDE.md` / implementation-guide layer map: Mongo → Postgres.
5. Archive or delete frozen Mongo snapshots per ops policy (not in app code).

### Acceptance

- [ ] API typecheck, lint, tests green without mongoose
- [ ] No Mongo URI required to boot the API in the default path
- [ ] Docs/architecture no longer describe Mongo as source of truth
- [ ] Production config updated; Mongo cluster can be decommissioned by ops

### Out of scope

Building marketplace, shipping, email, notification, or SAP services.

---

## Suggested Jira epic shape (copy/paste)

| Key | Summary | Depends |
| --- | --- | --- |
| PG-MIG-0 | ADR + Mongo touchpoint inventory | — |
| PG-MIG-1 | PostgreSQL schema (ids unchanged, numeric money) | PG-MIG-0 |
| PG-MIG-2 | Repository boundary; cash/inventory/invoices on Postgres | PG-MIG-1 |
| PG-MIG-3 | Shadow copy + reconcile (go/no-go) | PG-MIG-2 |
| PG-MIG-4 | Per-tenant cutover (2 active + dormant batch) | PG-MIG-3 |
| PG-MIG-5 | Backup/restore format v2 for Postgres | PG-MIG-4 |
| PG-MIG-6 | Remove MongoDB dependency | PG-MIG-5 |

**Labels:** `postgres`, `migration`, `api`  
**Component:** `api-store-platform`  
**Note on tickets:** Cash exchange = smoke only in PG-MIG-4; no CASH-EX child tickets.
