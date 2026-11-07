# ADR: MongoDB → PostgreSQL

Status: **Accepted** (2026-11-07) · Backlog: [`../backlog/postgres-migration.md`](../backlog/postgres-migration.md)

## Why

The roadmap is store platform → **marketplace + webshop** → **SAP** and **omnichannel**.
All of these are relational and transactional: orders over many tenants' catalogs,
stock reservations, money, and integration with an ERP that thinks in tables and
documents with line items. Postgres gives:

- real multi-row transactions (no replica-set requirement), `numeric` money, FK + unique constraints;
- one place for cross-tenant reads (marketplace catalog) and reporting joins (today 2 `aggregate` pipelines);
- the **transactional outbox** pattern for SAP / channel sync is one table in the same transaction.

Not a reason: the offline client. Dexie/outbox stays on the HTTP contract and does not change.

## Decisions

| Topic | Decision | Why (with the roadmap in mind) |
| --- | --- | --- |
| Database | PostgreSQL **18** (what Render provides; CI and local use the same), one database | One DB for store, marketplace and webshop; split later only if a context grows out of it. |
| Hosting | **Render Postgres**, same region as the API service (Frankfurt), connected over Render's internal URL. Staging/rehearsal = a second, small Render Postgres loaded from a prod dump, deleted afterwards. | API already runs on Render: private network, no cross-provider latency, one bill. EU region for GDPR (webshop end customers). SAP connects over APIs, never to our DB, so host choice does not limit it. |
| Driver / ORM | **Drizzle ORM + `pg` (node-postgres)**, migrations with `drizzle-kit` | SQL-first: marketplace search, reports and SAP export queries stay plain SQL. Interactive transactions for the ledger. `numeric` comes back as **string** → no float; money math stays in `store-domain` (house rule). No query engine binary, no codegen step. Prisma rejected: relation-first API, Decimal.js type, harder raw SQL. |
| Connection | `pg.Pool` (small pool, e.g. 10) on `DATABASE_URL` = Render internal URL. | We need interactive transactions (`ledgerService`, product import, `api.controller`); pool size stays under the plan's connection limit. |
| Schemas | Postgres schemas: `platform` (users, tenants, billing, newsroom), `store` (tenant business data). Later `market` / `shop` for the new bounded contexts. | Global vs tenant split; new contexts get a clean namespace without a second DB. |
| Tenant isolation | App-level, fail-closed: a `tenantDb(ctx)` helper that every repo uses and that throws without tenant context (same role as `withTenantScope`). `tenant_id text not null` + index on every `store.*` table. **No RLS now.** | Marketplace needs deliberate cross-tenant reads; RLS would fight that. RLS can be added later as a second layer. |
| Ids | Keep every public id unchanged. Mongo `_id` hex → `id text primary key`. Business ids (`productId`, invoice numbers, idempotency keys) stay as-is, with the same unique constraints. | API + Dexie identity must not change. |
| Money | Unconstrained `numeric` for every amount, rate and quantity; Drizzle returns it as a string. | `cash-accounts.md`: never float. No precision cap, so the ETL loads today's Mongo doubles without rounding and reconcile can compare exactly. |
| Nested objects | `createdBy` / `updatedBy` → columns (`created_by_id`, `created_by_name`). Line items → child tables. Truly free-form blobs (AI/report payloads) → `jsonb`. | One convention, queryable by SAP export later. |
| Arrays | Money-bearing arrays → child tables (invoice items / currency amounts / tenders, opening balances, salaries, payouts, currency setting items, cash balances). Plain string lists → `text[]`. UI/config blobs (label layout, column configs, role maps, import drafts) → `jsonb`. | Money stays `numeric` and summable; nothing else gets a table it doesn't need. |
| Uniques | Every business id unique per tenant `(tenant_id, x)`. A few Mongo indexes were global (`customerId`, `projectId`, `shelfId`, `invoiceId`, …); they are UUIDs, so per-tenant is what the app means. | Same rule everywhere. |
| Enums | Plain `text`; the app keeps validating values. | Adding a status needs no migration. |
| Cutover | **Single maintenance window, Postgres-only code.** No Mongo+Postgres dual repos, no per-tenant `dataStore` flag, no long shadow. Rehearse on a Neon branch with a prod dump, reconcile, then cut. Rollback = point the API back at the frozen Mongo (code on the last Mongo tag). | 2 active tenants. Dual implementations would double PG-MIG-2 for a flexibility we don't need. |
| Search (webshop) | Postgres full-text + `pg_trgm`. No Elasticsearch until it hurts. | Enough for a catalog of this size. |
| Integrations (SAP / channels) | **Not built in this epic.** Schema must not block it: stable ids, `updated_at` on every table. Later: `integration_outbox` table written in the same transaction, and `external_refs (tenant_id, system, entity, local_id, external_id)`. | Avoid speculative code; keep the door open. |
| Redis | Stays (cache, rate limit). | Unrelated to the store. |
| Backup | **Out of this epic.** The backup feature is parked in `git stash@{0}`, never shipped. When it is picked up again, it is built on Postgres directly (row export, no BSON). PG-MIG-5 is dropped. | Nothing in production to migrate. |
| Cash exchange | Already shipped; out of scope. Smoke-tested at cutover only. | Locked in planning. |

### Branch plan (decided 2026-11-07)

All porting happens on the long-lived branch `pg-migration`; staging (Render dev + Vercel `dev`) runs it on Postgres.
On `main`, API data-layer changes are frozen until cutover (UI work and hotfixes are fine); merge `main` into
`pg-migration` often. No dual Mongo/Postgres code paths.

Port by **transaction group**, because one transaction cannot span Mongo and Postgres. Each collection lives in
exactly one store at a time; reads across stores are fine.

1. Money + stock (one Mongo transaction today): invoices, buying invoices, inventories, stock movings,
   cash accounts + ledger, daily actions, sync mutations, offline sync state.
2. Catalog + parties + master data. 3. Settings, reports, notifications, import. 4. Platform (tenants, users, roles, newsroom).

Safety net before porting: a response-diff script that runs the Mongo and the Postgres build against the same
loaded data and fails on any JSON difference for the group's read endpoints.

### Effect on the backlog

- **PG-MIG-2:** repositories are Postgres-only. Controllers keep their HTTP shapes. No `DATA_STORE` flag.
- **PG-MIG-3:** no running shadow. It becomes: ETL script (Mongo dump → Postgres) + reconcile script (exits non-zero) + rehearsal on a Neon branch, repeated until green.
- **PG-MIG-4:** one window for all tenants (dormant ones included), not per tenant.
- **PG-MIG-5:** dropped (backup not shipped, see Decisions).

## Cutover runbook (outline)

1. Announce the window to the 2 active tenants; ask them to sync devices (empty outbox).
2. Maintenance mode: env flag `MAINTENANCE_MODE=1` → every non-GET request answers `503` (one middleware; there is no restore lock on `main` to reuse). Freeze Mongo, take a full dump.
3. ETL → Postgres. Reconcile must be exact (counts, ledger = balances, stock qty/cost, invoice totals, idempotency keys).
4. Deploy the Postgres build. Smoke: login, sell, buy, cash transfer, cash exchange, stock move, sync pull/push.
5. Release the lock; `/sync/changes` answers `resetRequired` so devices re-bootstrap.
6. Rollback window 14 days: Mongo stays frozen and untouched. Rollback = redeploy the last Mongo tag; writes made on Postgres during the window are lost (accepted, communicated).

## Inventory of Mongo touchpoints

### Models → target

`migrate → store` = tenant data (also in backup). `migrate → platform` = global.
Everything moves; nothing stays on Mongo.

| Model (file) | Target | Note |
| --- | --- | --- |
| Currency, CurrencySettings | store | master data |
| Unit, Category, Brand, Shelf | store | master data |
| Warehouse (`Warehaus.ts`) | store | |
| Supplier, Customer, Partner, Project, Employee | store | parties |
| Expense | store | money |
| Product (`Products.ts`) | store | `productId` unique per tenant |
| Inventory | store | `UNIQUE (tenant_id, warehouse_id, product_id)` |
| StockMoving (`StockMovings.ts`) | store | |
| CashAccount, CashLedgerEntry | store | `balances` map → `cash_account_balances` + append-only ledger |
| BuyingInvoice (`BuyingInvoices.ts`) | store | header + line table |
| SellingInvoiceItem (`SellingInvoices.ts`), Invoice | store | header + line table |
| InvoiceSettings, LabelTemplate, UserSettings | store | settings |
| TenantRolePermission | store | |
| DailyAction | store | activity |
| Report | store | AI payload → `jsonb` |
| NegativeQuantitySnapshot | store | derived; rebuilt by cron, no ETL needed |
| ProductImportSession | store | transient; drain before cutover, no ETL |
| NotificationRead | store | per-user read state |
| OfflineSyncState, SyncMutation | store | ETL **required**: idempotency must survive cutover |
| Tenant | platform | write lock column lives here |
| User, RefreshToken | platform | refresh tokens may be dropped at cutover (forces re-login), simpler than migrating |
| Role (`Role.ts`) | platform | global roles |
| SubscriptionPaymentSettings, SubscriptionRenewalRequest | platform | billing |
| NewsroomTopic, NewsroomReleaseNote, NewsroomChange, NewsroomUserState (`Newsroom.ts`) | platform | |

### Code that talks to Mongo

- `src/shared/mongodb/*`: `tenantScopedModel` (`withTenantScope`), `mongodbController`, `documentActions`, `tenantUserActions`. Used by 14 files; the repository layer replaces these.
- 66 files import `mongoose`; 55 files outside `models/` import models.
- Transactions: `apis/api.controller.ts`, `shared/cashAccounts/ledgerService.ts`, `shared/productImport/service.ts`.
- Aggregations: `apis/api.controller.ts` (selling + buying invoice pipelines, ~L1398 / L1439).
- About 13 Mongo update/query operators (`$inc`, `$push`, …): each needs a SQL equivalent.
- Scripts (`src/scripts/`): `init-collections`, `drop-stale-indexes`, `migrate-*` (4, one-off history, **delete, don't port**), seeds (`seed-*`, `create-*`: port), crons `run-negative-quantity-snapshot`, `run-subscription-lifecycle` (port).
- Infra: `docker-compose.ci.yml` (Mongo replica set), `.env` `BUSINESS_PLATFORM_MONGO_DB_*`.

### Freeze rule

Until cutover: no new Mongo-only features (new aggregation pipelines, new embedded maps).
New models are fine if they are flat and tenant-scoped. Production hotfixes are exempt.

## Schema (PG-MIG-1, shipped on branch `pg-mig-1-schema`)

- Code: `services/api-store-platform/src/db/schema/` (`platform.ts`, `store.ts`, `columns.ts`); config `drizzle.config.ts`; migrations `drizzle/`.
- Commands (`DATABASE_URL`, default `postgres://postgres:postgres@127.0.0.1:5433/store_platform`):
  `npm run db:generate` after a schema change · `npm run db:migrate` to apply.
- Local throwaway DB: `docker run -d --rm --name pgmig -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=store_platform -p 127.0.0.1:5433:5432 postgres:18`.
- Down (empty DB only): `drop schema store cascade; drop schema platform cascade; drop schema drizzle cascade;`. Drizzle has no down migrations; forward-fix after cutover.
- CI (backend job): Postgres 17 service → `db:migrate` → `db:generate` must produce no new file.
- `src/test/pgSchemaCoverage.test.ts`: fails when a Mongoose model has no table, a `store` table lacks `tenant_id`, or a column is float.
- `tsconfig.build.json` no longer sets `skipLibCheck: false`: Drizzle ships `.d.ts` for MySQL/Gel that don't compile without those drivers.
- Child rows of invoices reference the parent's `id` (Mongo `_id`), because `invoiceId` is optional in Mongo.
- Legacy `SellingInvoiceItem` → `store.legacy_selling_invoices` (items as `jsonb`, `shortcut:` comment in schema).
- ETL: `npm run pg:etl -- --tenant <id> [--global]` (`src/scripts/pg-etl.ts`, mapping in `src/db/etl/mongoToPg.ts`).
  Reads Mongo raw, replaces the tenant's rows in one Postgres transaction (rerun-safe), compares row counts.
  Writes nothing when a doc can't be loaded (missing required value, non-number money) or a field would be dropped.
  Fields Mongoose already strips on read are dropped on purpose via `dropped` per spec, each with a reason.
- Dry run 2026-11-07, dev Atlas → local Postgres 17: 11 of 12 tenants load with equal counts
  (incl. zobani-car: 2,810 products, 147 invoices).

### Data findings (dev DB; check production before cutover)

| Finding | Decision |
| --- | --- |
| `zobani-sy`: 1 unit without `unitId`, 6 products without `price.retailPrice` (pre-refactor shape, also `stock` / `unit`) | Test tenant: left out of dev rehearsals, no data change. ETL refuses to invent ids; production is checked in the PG-MIG-3 rehearsal. |
| `customers.isDeleted` (zobani-car, 8 docs, some `true`) | Dropped. Today's app ignores it and lists those customers; behavior unchanged. Test tenant: kept as is. |
| `tenants.rolePermissions` | Dropped: superseded by `TenantRolePermission`. |
| `tenants.backupRetentionCount` | Kept (column added) for the parked backup feature. |
| `tenants.backupRestoreStartedAt`, `currencySettings.roundConvertedCurrencyAmounts` | Dropped: parked lock / orphan field. |

## Group 1 switched (money + stock) — 2026-11-07, branch `pg-migration`

Postgres owns: invoices, buying invoices, inventories, stock movings, cash accounts + ledger, daily
actions, sync mutations, offline sync state (`src/db/ownership.ts`). Everything else is still Mongo.

How the code reaches Postgres:

- Generic layer (`shared/mongodb/documentActions.ts`) routes by model owner; `insertDoc` / `updateDoc`
  keep Mongoose validation, casting and defaults (Mongoose = validation-only library until PG-MIG-6).
- Direct queries: `pgFind` / `pgFindOne` / `pgDeleteMany` / `pgUpdateMany` (`src/db/mongoQuery.ts`) take
  the same Mongo filter objects; semantics are checked against a real Mongo in
  `mongoQuery.pg.test.ts` (CI runs a throwaway mongod). Unsupported operators throw.
- Atomic writes: `db/repos/inventory.ts`, `db/repos/invoices.ts`, `db/repos/sync.ts`,
  `shared/cashAccounts/ledgerService.pg.ts`.
- Startup: `docker-entrypoint.sh` requires `DATABASE_URL` and runs `dist/scripts/db-migrate.js`.
- Seeds write group-1 data to Postgres (and the demo seed's daily actions got the `warehouseId` they
  were missing since 2026-09-13; seeding an empty DB failed before this).

**Proof:** `api:diff` Mongo build vs Postgres build on the same data (tenant `app`): all 28 group-1 read
calls equal, after these documented rules:

| Difference | Why accepted |
| --- | --- |
| `__v` gone | Mongoose version counter; nothing reads it |
| Sums differ in the 12th digit | Postgres sums exactly, Mongo summed doubles |
| Rows Mongo upserted without timestamps now have `createdAt` | Filled from ObjectId time; lists sorted by `createdAt` show them at their real date instead of last |
| Array order in `/sync/changes` | Client applies the whole set |

**Temporary cross-store writes** (`shortcut:` comments; fixed when group 2 moves): product create (Mongo
product + Postgres inventory row), product purchase-price edit (Mongo product + Postgres cost sync) and
product import (Mongo products + Postgres inventory). The Mongo write always runs last inside the Postgres
transaction, so its failure rolls back the Postgres part.

**Transactions:** an own transaction is retried up to 3 times on deadlock / serialization failure
(`40P01` / `40001`, `db/index.ts` `inTransaction`), as Mongo's `withTransaction` retried transient
errors. `IN` lists go as one array parameter (`anyOf`): Postgres allows at most 65,535 parameters.

**Ledger:** one file, `shared/cashAccounts/ledgerService.ts` (Postgres). The Mongo ledger and the
one-off `scripts/migrate-cash-accounts.ts` are deleted.

**Findings kept as-is (no behavior change in the port):** invoice numbers have no unique index
(INV-NUM-1, `docs/backlog/later-tickets.md`); online buying numbers ignore the offline floor, so an
offline-reserved buying number can be taken online and the offline invoice is renumbered on sync.

## Open questions

1. **Active vs dormant tenants:** ops note, kept outside git (no tenant ids here).
2. Confirm the API's Render region before creating the database (must match).
