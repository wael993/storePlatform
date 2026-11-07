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
| Database | PostgreSQL **17**, one database | One DB for store, marketplace and webshop; split later only if a context grows out of it. |
| Hosting | **Render Postgres**, same region as the API service (Frankfurt), connected over Render's internal URL. Staging/rehearsal = a second, small Render Postgres loaded from a prod dump, deleted afterwards. | API already runs on Render: private network, no cross-provider latency, one bill. EU region for GDPR (webshop end customers). SAP connects over APIs, never to our DB, so host choice does not limit it. |
| Driver / ORM | **Drizzle ORM + `pg` (node-postgres)**, migrations with `drizzle-kit` | SQL-first: marketplace search, reports and SAP export queries stay plain SQL. Interactive transactions for the ledger. `numeric` comes back as **string** → no float; money math stays in `store-domain` (house rule). No query engine binary, no codegen step. Prisma rejected: relation-first API, Decimal.js type, harder raw SQL. |
| Connection | `pg.Pool` (small pool, e.g. 10) on `DATABASE_URL` = Render internal URL. | We need interactive transactions (`ledgerService`, product import, `api.controller`); pool size stays under the plan's connection limit. |
| Schemas | Postgres schemas: `platform` (users, tenants, billing, newsroom), `store` (tenant business data). Later `market` / `shop` for the new bounded contexts. | Global vs tenant split; new contexts get a clean namespace without a second DB. |
| Tenant isolation | App-level, fail-closed: a `tenantDb(ctx)` helper that every repo uses and that throws without tenant context (same role as `withTenantScope`). `tenant_id text not null` + index on every `store.*` table. **No RLS now.** | Marketplace needs deliberate cross-tenant reads; RLS would fight that. RLS can be added later as a second layer. |
| Ids | Keep every public id unchanged. Mongo `_id` hex → `id text primary key`. Business ids (`productId`, invoice numbers, idempotency keys) stay as-is, with the same unique constraints. | API + Dexie identity must not change. |
| Money | `numeric(20,6)` for amounts and rates, `numeric(20,4)` for quantities (exact sizes chosen in PG-MIG-1 from current data) | `cash-accounts.md`: never float. |
| Nested objects | `createdBy` / `updatedBy` → columns (`created_by_id`, `created_by_name`). Line items → child tables. Truly free-form blobs (AI/report payloads) → `jsonb`. | One convention, queryable by SAP export later. |
| Cutover | **Single maintenance window, Postgres-only code.** No Mongo+Postgres dual repos, no per-tenant `dataStore` flag, no long shadow. Rehearse on a Neon branch with a prod dump, reconcile, then cut. Rollback = point the API back at the frozen Mongo (code on the last Mongo tag). | 2 active tenants. Dual implementations would double PG-MIG-2 for a flexibility we don't need. |
| Search (webshop) | Postgres full-text + `pg_trgm`. No Elasticsearch until it hurts. | Enough for a catalog of this size. |
| Integrations (SAP / channels) | **Not built in this epic.** Schema must not block it: stable ids, `updated_at` on every table. Later: `integration_outbox` table written in the same transaction, and `external_refs (tenant_id, system, entity, local_id, external_id)`. | Avoid speculative code; keep the door open. |
| Redis | Stays (cache, rate limit). | Unrelated to the store. |
| Backup | **Out of this epic.** The backup feature is parked in `git stash@{0}`, never shipped. When it is picked up again, it is built on Postgres directly (row export, no BSON). PG-MIG-5 is dropped. | Nothing in production to migrate. |
| Cash exchange | Already shipped; out of scope. Smoke-tested at cutover only. | Locked in planning. |

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

## Open questions

1. **Active vs dormant tenants:** ops note, kept outside git (no tenant ids here).
2. Confirm the API's Render region before creating the database (must match).
