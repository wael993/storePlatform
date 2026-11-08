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

## Status (2026-11-07)

Branch `pg-migration` (not pushed). Staging = Render dev service + Vercel `dev`, running on Mongo today.

| Ticket | State | Notes |
| --- | --- | --- |
| PG-MIG-0 ADR + inventory | **Done** | ADR in `../architecture/postgres-migration.md` |
| PG-MIG-1 Schema | **Done** | 53 tables, CI migrate + drift check, ETL `pg:etl`, dry run: 11 of 12 dev tenants load equal |
| PG-MIG-2 Repositories | **Done** | Groups 1–4 live on staging (2026-11-08); the API no longer queries Mongo |
| PG-MIG-3 Reconcile / go-no-go | Partly prepared | `pg:etl --verify` (field-by-field) and `api:diff` exist; rehearsal not started |
| PG-MIG-4 Cutover | Open | Single window for all tenants (ADR), not per tenant |
| PG-MIG-5 Backup v2 | **Dropped** | Backup never shipped (parked in stash); rebuild on Postgres later |
| PG-MIG-6 Remove Mongo | Open | Also: replace Mongoose as validation-only library |

**PG-MIG-2, group 1 (money + stock)**

| Part | State |
| --- | --- |
| Shared Postgres layer (client, transactions, fail-closed tenant check) | Done |
| Document store: rows ↔ exact Mongo shape, insert/update/delete, Mongoose validation kept | Done, verified on all loadable dev tenants |
| Cash ledger (`ledgerService.pg.ts`) | Done, tested (ledger = balances, overdraft, replay, exchange) |
| Stock writes (`db/repos/inventory.ts`) | Done, tested incl. concurrent sale + double transfer delete |
| Generic update/delete (`$set` semantics, row lock, changed-paths validation) | Done, tested incl. lost update |
| Invoice numbers, offline blocks (atomic), last prices (`db/repos/invoices.ts`) | Done, tested |
| Sync mutations + changes-since (`db/repos/sync.ts`) | Done, tested |
| Switch: controllers → Postgres (generic layer, `pgFind`, repos), seeds, migrate at boot | Done |
| `api:diff` Mongo vs Postgres build on the same data | Done: equal (4 documented differences, see ADR) |
| Staging Render Postgres (PG 18) created, migrated, all 11 dev tenants loaded + verified | Done |
| Review fixes (write order, deadlock retry, atomic delete, 65k-param limit, tests, −1,600 lines) | Done |
| Staging: Render dev on `pg-migration` (b9affd9), 8-step app smoke + database invariants | **Done** 2026-11-07 |
| Group 2 (catalog, parties, master data) switched; 3 cross-store shortcuts removed; `api:diff` equal (accepted differences in ADR) | Done, live on staging |
| Staging smoke group 2 (2026-11-08): opening balances, employees, currencies, sell online/offline OK | Done |
| Fix: RegExp filter values matched every row (barcode + 13 "name already exists" checks) | Fixed, tested vs Mongo, retested on staging 2026-11-08 (create product, alias/barcode, cost follows catalog price, duplicate names refused) |
| TO-DO: smoke product import on a new tenant without products | Open (owner, later) |
| Group 3 (settings, reports, notifications, import drafts) switched; `api:diff` equal; write tests | Done, live on staging |
| Staging smoke group 3 (2026-11-08): invoice settings + print, label templates + default, user settings, notifications mark-as-read, AI report OK | Done |
| TO-DO: as owner change a cashier role's SEE list, log in as the cashier and check what they see | Open (owner, later) |
| Group 4 (platform: tenants, users, tokens, subscriptions, newsroom) + legacy invoice reads switched; `api:diff` equal (shop user + super admin); write tests | Done, live on staging |
| Staging smoke group 4 (2026-11-08): login, wrong password, stay logged in (refresh), logout + logout-all, change password, invite/edit/delete user, super admin tenants (list, edit, create + owner login), renewal request approve/reject, payment info, newsroom, Invoice AI credit OK | Done |

**Staging smoke (2026-11-07):** sell, buy, cash transfer, cash exchange, stock transfer + delete,
offline sale + sync, edit + delete invoice: all OK in the app. Database afterwards: transfers paired,
deleted invoices leave no active cash effect (only intended `return_in` history), no duplicate invoice
numbers, offline sale recorded once, API = Postgres within the user's warehouse scope.

**Rehearsal must check (found in dev data, already in Mongo before the switch):**
1. Cash balance vs ledger sum: float noise (e.g. `0.00714286` vs `0.007142860000000084`) and one real
   gap (test tenant `zobani-car`: ledger −1,278.50 vs balance 321.50). Reconcile with tolerance 1e-6;
   noise: recompute balances from the ledger once; real gaps: decide per account before cutover.
2. A `sale` stock movement whose invoice no longer exists (1 in `zobani-car`). `return_in` rows for
   deleted invoices are intended history, not leftovers.

**Checkboxes that no longer apply as written (ADR: Postgres-only, single cutover):**
"Flag switches implementation", "≥ 7 days shadow reconcile", "rollback = flag back to mongo",
per-tenant cutover order. Rollback is instead: redeploy the last Mongo build on the frozen Mongo data.

**Dev data findings resolved:** `zobani-sy` and `zobani-car` are test tenants. `zobani-sy` is left out of
dev rehearsals (legacy records, no change); `zobani-car` is copied as is. Real check: run `pg:etl --verify`
on a production copy in the PG-MIG-3 rehearsal and decide any finding there.

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

- [x] Schema checked in; empty migrate up/down works in CI or documented local cmd
- [x] Money fields are `numeric` (not float/double)
- [x] Inventory unique constraint matches `(tenantId, warehouseId, productId)`
- [x] Dry-run can insert one tenant’s worth of rows without inventing new public ids

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

- [x] At least cash + inventory + invoices work on Postgres in staging with the
  same HTTP shapes
- [ ] Flag switches implementation without frontend changes
- [x] Missing tenant context fails closed on the Postgres path
- [x] One automated check per ported domain that fails if ledger/stock invariants break

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

- [x] Schema covers every migrate-list model  
- [x] Cash + inventory + invoices green on staging Postgres  
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
   that only serve the old store (`seed-roles`, `init-collections`, `drop-stale-indexes`;
   the `Roles` model and `platform.roles` table are write-only).
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
