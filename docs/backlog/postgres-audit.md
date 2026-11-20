# PostgreSQL audit — PG-AUDIT

A full technical audit of the Postgres layer written in PG-MIG-1/2, plus the intake list for
everything the smoke test ([smoke-test-plan.md](smoke-test-plan.md)) turns up. Roadmap:
runs as part of phase 3 (QA-REVIEW-1); Part A must be done before PG-MIG-3.

**Goal:** Postgres is reliable, secure, keeps the books balanced, and can carry the ERP plus
a later marketplace / webshop / omnichannel without a redesign. Improve step by step inside
the modular monolith. No rewrite, no microservices, no new stack without a written reason.

## Working rules

1. **No changes before approval.** Order: discover (PG-AUDIT-0) → report (checklists below
   filled in) → remediation plan → owner approves → fix.
2. Do not trust names: a feature counts only if the code path does it and a test or a run
   shows it.
3. Every checked item gets:
   - **Status:** ✅ done · ⚠️ partly / needs work · ❌ missing · 🔍 cannot confirm without a test or more info
   - **Evidence:** `file:line`, query, or test name
   - **Risk:** what goes wrong, with a concrete example
   - **Fix:** smallest change that solves it, and its impact on existing data/code
   - **Priority:** Critical / High / Medium / Low
4. Order of importance: data integrity → accounting correctness → security → performance → scale.
5. Fixes: keep existing data, never touch production data, safe migrations (expand → migrate
   → contract), a test that fails without the fix, update `docs/reference/*` and
   `documentation/openapi.yaml` when behavior changes.
6. Index or schema recommendations name the query or usage they serve. No "just in case".
7. Concepts that do not exist yet (general ledger, marketplace listings, reservations) are
   rated ❌ with a note "not needed now / needed for X", not reported as bugs.

## Part 0 — Smoke test findings (fix list)

Filled while the owner runs the smoke test. Fixing starts when the owner says so.
Each fix: root cause, fix, test, retest row.

**None of these come from the Postgres migration** — the same behavior exists on Mongo — so
none of them block PG-MIG-3. Each becomes its own ticket. Suggested order = priority.

| # | Smoke row | What happened / what is wrong | Type (bug / missing / UX) | Priority | Fix state |
| --- | --- | --- | --- | --- | --- |
| S-4 | 2.5 | Log out of all devices: other browser stays logged in. Likely cause: `logoutAll` deletes refresh tokens but does not bump `tokenVersion` (change password does), so the 15-min access token keeps working | bug (security) | High | fixed 2026-11-17: `logoutAll` bumps `tokenVersion` with the token delete in one transaction (`group4Writes.pg.test.ts`); retest smoke 2.5 after deploy |
| S-2 | 1.4 | Subscription payment image not displayed correctly. Need: what was shown (broken icon / too small) and the URL type (share link vs direct image) | bug | Medium | fixed 2026-11-20 |
| S-3 | 8.5 | Renewal success message shows on every login (should be first login after renewal, or first week) | bug | Medium | fixed 2026-11-20: banner shows once, and only if the approval is less than a week old (`shouldShowRenewalSuccess`). Same once-only rule for the backup restore success banner |
| S-1 | 1.3 | Allowed pages / offline toggle only apply after logout + login, not after reload; dashboard cannot be removed (confirm intended) | bug / UX | Low | later |
| S-5 | 3.1 | Same currency twice: not stored, but request is a fetch instead of a POST and no error is shown | bug / UX | Low | later |
| S-6 | 6.7 | Warehouse transfer delete not found in the app. API has it (`DELETE /inventory/warehouse-transfers/:referenceId`) and the invoice list offers it (`InvoiceTableSection.tsx`) — retest from there; if hard to find, it is UX | retest / UX | Medium | done 2026-11-20 (retested) |
| S-7 | 6.9 | Daily actions: edit (`QuickEntryModal`) and delete (invoice list, party activity) exist — retest from there. Expenses: edit/delete exist in the API only, no screen uses them | retest / missing UI | Medium | later: expense edit / delete screens to be added in the frontend |
| S-8 | 8.1 | Refuse a selling invoice when any item has no retail price | missing | Low | roadmap |

---

## Part A — must be done before PG-MIG-3

### PG-AUDIT-0 — Discover the current state (no proposals yet)

Answer each in a few lines with file references. **Done 2026-11-17** (read from code on
`pg-migration`; nothing run against a database).

| # | Question | Answer / evidence |
| --- | --- | --- |
| 0.1 | How does the API connect (driver, pool, SSL, env vars)? | `pg` `Pool` + Drizzle (`src/db/client.ts`), env `DATABASE_URL` only (fails closed if missing). **Two pools** of `max: 10` each, 10 s connect timeout: `getDb()` for reads, a separate one for transactions so open transactions cannot starve each other (`src/db/index.ts`). So up to 20 connections per API instance. **SSL:** no option in code — depends on `sslmode` in the URL (🔍 check the Render URL). Pools are not closed on shutdown (`server.ts` `gracefulShutdown` does not call `closeDb`). |
| 0.2 | How are tables and relations designed? Which tables are real columns, which are Mongo-shaped `jsonb` documents? | 53 tables in two schemas: `platform` (10: tenants, users, roles, refresh_tokens, subscriptions, newsroom) and `store` (43). Mostly **real columns**; Mongo sub-arrays became child tables (invoice items / tenders / currency amounts, employee salaries / payouts, party opening balances, currency setting items, cash account balances). Every row keeps the Mongo `_id` as text primary key plus a `seq` for Mongo's natural order (`schema/columns.ts`). `docs.ts` maps rows back to the exact Mongo document shape so old API answers stay identical. **jsonb (13):** free-form or UI data only — role resources, payment methods, product `attributes`, label layout, column configs, report data, import-session files / mapping / results, one `items` list. **Constraints:** 37 + 15 unique indexes; only **6 foreign keys** (invoice / buying-invoice children → parent, `ON DELETE cascade`); **0 CHECK**; no row-level security. **Types:** money and quantities `numeric` without precision/scale (48 columns); times `timestamptz`; business days `date`. |
| 0.3 | How are migrations made, checked (drift) and run (boot? CI?) | Drizzle Kit generates SQL from the schema into `drizzle/` (3 files: `0000_init`, `0001_tenant_backup_retention`, `0002_natural_order`). **CI** (`.github/workflows/ci.yml`): Postgres 18 service, `npm run db:migrate`, then `db:generate` must leave `drizzle/` unchanged (drift check). **Deploy:** `src/scripts/db-migrate.ts` runs Drizzle's migrator before the server starts (`docker-entrypoint.sh`); a failed migration exits and the server does not start. |
| 0.4 | How do transactions run (helper, isolation, retry on `40P01`/`40001`)? | One helper `inTransaction(tx, work)` (`src/db/index.ts`): joins the caller's transaction or opens its own; an own transaction is retried up to **3 times** on `40P01` (deadlock) / `40001` (serialization). Isolation is the Postgres default **READ COMMITTED** everywhere (no `isolationLevel` set). Row locks: `SELECT … FOR UPDATE` in the generic update (`docs.ts`, `pgFindOneAndUpdate` with `lock: true`) and stock writes (`repos/inventory.ts`); cash debits use a guarded atomic `UPDATE … WHERE amount + x >= 0` (`ledgerService.ts`). Unique violation helper `isUniqueViolation` (23505). |
| 0.5 | How is tenant scope enforced (`withTenantScope`, fail-closed check, `ownership.ts`)? | All Postgres access goes through `pgFind` / `pgFindOne` / `pgUpdate*` / `pgDelete*` (`src/db/mongoQuery.ts`), which take a **required** `tenantId` argument and add `tenant_id = …`; a missing tenant throws (`requireTenantId`). Opting out needs the explicit `ALL_TENANTS` marker: 60 uses, mostly platform tables (newsroom 29, subscriptions 7, tenant admin 3, crons 3), plus 4 in `api.controller.ts` (e.g. refresh token by hash) — 🔍 each to be checked in PG-AUDIT-4. `withTenantScope` only guards the old **Mongo** branches, which no longer run. `ownership.ts` is the list of models already on Postgres (`isPgModel`), not a tenant check. Direct Drizzle queries in repos / ledger set the tenant filter by hand — 🔍 PG-AUDIT-4. |
| 0.6 | How do sales, purchases, stock and cash writes flow end to end? | Controller (`apis/selling-invoice`, `apis/buying-invoice`, `apis/api.controller.ts`) → one `inTransaction` → invoice number (`repos/invoices.ts`: `allocateInvoiceNumber`, `allocateOfflineBlock` for offline number blocks) → invoice row + child rows (generic `docs.ts`) → stock (`repos/inventory.ts`: `adjustInventoryQuantity`, `purchaseInventoryAdjustment`, `claimWarehouseTransferLegs`, row-locked) → cash (`shared/cashAccounts/ledgerService.ts`: `syncCashEffectsForReference` writes ledger entries and updates `cash_account_balances` with exact `numeric` sums; transfers / exchanges / opening balances have their own posts). Offline replay records the client id in `sync_mutations` (`repos/sync.ts`). Note: `ledgerService.pg.ts` named in older docs no longer exists — the file is `ledgerService.ts`. |
| 0.7 | What still talks to Mongo or Mongoose (validation only?) | **Runtime:** the server still **connects to Mongo at boot** and exits if it cannot (`server.ts:13` → `db/db.ts`), and `MongodbController` opens a second Mongo client (plus a change stream on Mongo if `enableChangeStream` is set). Every API model is on Postgres (`ownership.ts`); the Mongo branches in `documentActions.ts` / `api.controller.ts` are dead code. Mongoose models are still used for **schema validation** of writes. **Scripts on Mongo only:** `seed-roles.ts`, `init-collections.ts` (write `Roles` to Mongo — the `platform.roles` table is loaded by the ETL only), `run-negative-quantity-snapshot.ts`, `run-subscription-lifecycle.ts`, `drop-stale-indexes.ts`. The **crons** run on Postgres. |
| 0.8 | Where is Redis used, if at all? | Optional read cache (`shared/cache/redisCache.ts`, on only with `REDIS_ENABLED=true`): list results stored with a TTL, invalidated by explicit `del` / `delByPattern` after writes in the product, category, customer, supplier, partner, project, selling / buying invoice and settings controllers (~55 `del` calls). Not used for locks or sessions. The login rate limiter is **in-memory per process** (`middleware/rateLimiter.ts`), not Redis. |
| 0.9 | Map of business entities: Tenant / Organization / Store / Branch / Warehouse / Seller — which exist, how they relate | Only **Tenant → Warehouse**. A tenant is one shop (`platform.tenants`); it has many warehouses (`store.warehouses`); stock, cash accounts, invoices and movements carry `warehouse_id` (16 columns). Users belong to one tenant and may be limited to some warehouses (`users.warehouse_ids text[]`). **Organization, Store, Branch, Seller do not exist** (rate ❌ "not needed now" per rule 7). |

**Leads for PG-AUDIT-1 … 4 (from 0.1–0.9, not yet rated):**

- Only 6 foreign keys, 0 CHECK constraints, no precision on `numeric` → PG-AUDIT-1 (1.3, 1.6, 1.10).
- API cannot start without Mongo, though it no longer reads it (`server.ts` connect, and
  `docker-entrypoint.sh` still checks the Mongo URL first) → decide before PG-MIG-4 whether
  production keeps depending on two databases until PG-MIG-6 (0.7).
- `platform.roles` is never read at runtime (permissions come from code + `tenant_role_permissions`);
  `seed-roles` / `init-collections` still write roles to Mongo → leftovers for PG-MIG-6 (0.7).
- 60 `ALL_TENANTS` uses and hand-written tenant filters in repos / ledger → PG-AUDIT-4 (4.2).
- Redis cache relies on every write calling `del`; a missed one shows stale data → PG-AUDIT-6.
- SSL on the connection depends on the URL only (0.1) → PG-AUDIT-8.

### PG-AUDIT-1 — Schema and design (brief §4)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 1.1 | Postgres is the single source of truth (no reads/writes left in Mongo or cache) | ✅ | — | All API models on Postgres (PG-AUDIT-0 0.7). The server no longer connects to Mongo at start (H3, 2026-11-17; verified: built server runs and serves with Mongo unreachable). Before: role seed scripts write to Mongo only. Redis is an optional read cache invalidated by explicit `del` (0.8). |
| 1.2 | Tables and relations make sense; jsonb used only where structure is truly free | ✅ | — | 53 tables, Mongo arrays split into child tables; 13 jsonb columns hold free / UI data only (0.2). Relations use **business ids** scoped by tenant (`(tenant_id, product_id)` etc.), not the row `id` — confirmed on staging: every relation matches by business id, none by `id`. |
| 1.3 | Foreign keys on every real relation | ❌ | Medium | Only 6 FKs (invoice / buying-invoice child rows → parent). None for product, warehouse, customer, supplier, currency, cash account, employee, tenant links. Possible as composite FKs on `(tenant_id, <business id>)` since those are unique — but existing orphans (1.12) must be resolved first. |
| 1.4 | Unique constraints (tenant-scoped: invoice numbers, names, barcodes, client ids) | ❌ | **High** | 61 unique indexes cover every business id, `sync_mutations (tenant_id, client_mutation_id)`, ledger `idempotency_key`, inventory `(tenant, warehouse, product)`, user email. **Missing:** invoice number per tenant, product barcode, master-data names. **Proven on staging:** `cafeshop` has 5 selling invoices numbered `SI-104501`, created 2026-11-08 03:45:18–20 by one user (Postgres era): `allocateInvoiceNumber` (`db/repos/invoices.ts:80`) reads max + checks "taken" without a lock or constraint, so parallel creates get the same number. = INV-NUM-1 (`later-tickets.md`), found in practice. **Fixed 2026-11-17** (per-tenant transaction lock + tests); unique index not added (owner decision, H4). Also 1 duplicate barcode (`dev`, 2026-09, Mongo era) and 5 duplicate product names (names may be allowed). Buying invoices: no duplicates. |
| 1.5 | NOT NULL on required fields | ⚠️ | Low | Business ids, tenant, names NOT NULL. `invoices.invoice_id`, `invoice_number`, `warehouse_id`, `buying_invoices.buying_invoice_id` / `warehouse_id`, `daily_actions.action_id` / `warehouse_id` are nullable — staging has **0** null/empty values in all of them, so NOT NULL can be added safely after the production copy confirms the same. |
| 1.6 | CHECK constraints (qty/amount signs, enums, rate > 0) | ❌ | Medium | 0 CHECK constraints. Staging data is clean: 0 negative prices, 0 invoice items with qty ≤ 0, 0 exchange rates ≤ 0. 9 negative inventory rows — allowed when oversell is on, so no CHECK there. Cash "never below 0" is enforced by the guarded `UPDATE` in `ledgerService.ts`, not by the DB. |
| 1.7 | ON DELETE / ON UPDATE behavior fits soft/hard delete rules (`master-data-delete.md`) | ⚠️ | Medium | Rule: hard delete only when unused, checked in code (`deleteBlock.ts`, `find*DeleteBlocks`). Only invoice children cascade in the DB. Product delete removes its inventory (`deleteProductInventory`, `api.controller.ts:2046`). Warehouses have no delete route. Without FKs, a missed guard leaves orphans silently — staging has them (1.12). |
| 1.8 | No needless duplicated data; denormalized copies are snapshots on purpose | 🔍 | — | Invoices keep currency amounts / tenders as snapshot child rows (intended). Full check per flow in PG-AUDIT-3 (3.4–3.6). |
| 1.9 | Normalization where it matters | ✅ | — | Repeating groups are child tables; master data referenced by id. `users.warehouse_ids` is a `text[]` (fine at this size). |
| 1.10 | Data types (numeric precision/scale, timestamptz vs text, ids, enums) | ⚠️ | Medium | Money / quantity: 48 `numeric` columns **without precision/scale** (exact, but no rounding rule in the DB; `parseFloat` noise like `89940.1199999999998745` is stored as-is). Times `timestamptz`, days `date`, a few text dates (`tenants.subscription_notified_for_date`, `newsroom_release_notes.release_date`). Ids are text (Mongo ObjectId / UUID). Status / type fields are free `text`, no enum or CHECK. |
| 1.11 | Migrations ordered, idempotent, safe to apply on a live DB | ⚠️ | Low | 3 migrations, ordered by Drizzle journal, drift-checked in CI. Not idempotent per statement (no `IF NOT EXISTS`) — fine, the journal prevents re-runs. `0002` adds `bigserial` to 41 tables (table rewrite + exclusive lock): harmless on cutover (empty DB, ETL loads after), but this pattern would block a live production DB — see PG-AUDIT-10.7. |
| 1.12 | No orphan rows today (query per relation on staging data) | ⚠️ | Medium | Checked 38 relations on staging 2026-11-17 (read-only). **Clean:** invoice / buying items → products, everything → warehouses (except below), products → category / brand / unit / supplier, employees, partners, projects, expenses. **Orphans, all in two dev tenants and all from the Mongo era (2026-09 / 10):** `center`: 8,929 of 9,016 inventory rows point to products that no longer exist (4,916 with non-zero quantity; products were re-created 2026-09-22), 1 stock moving (`return_in`). `cafeshop`: 17 invoices + 12 daily actions → deleted customers, 15 buying invoices + 7 daily actions → deleted suppliers, 6 cash accounts → 2 deleted warehouses, 1 currency missing (ledger, balance, invoice, tender). `app`: 1 buying invoice → supplier `app-par-2`. **Run the same query on the production copy in PG-MIG-3** (`pg:etl --verify` does not check this). |

### PG-AUDIT-2 — Transactions and integrity (brief §5)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 2.1 | Every multi-table write runs in one transaction | ✅ | — | One `inTransaction` per flow (`db/index.ts`): sale / purchase create, edit, delete (`apis/selling-invoice`, `apis/buying-invoice`), product create / edit with opening stock, warehouse transfer create / edit / delete, daily action create / edit / delete (`apis/api.controller.ts`), cash transfer / exchange / opening balance (`ledgerService.ts`), employee, newsroom, tenant, import commit. After commit and outside the transaction only: Redis cache `del` and `recordSyncMutation` — safe, a replay finds the existing invoice by its `invoiceId` first. |
| 2.2 | All-or-nothing: a throw mid-way leaves nothing behind | ✅ | — | Follows from 2.1 (stock, cash, number and invoice row in the same transaction). Proven by test only for invoice delete (`documentActions.pg.test.ts` "keeps the invoice when the rest of its delete transaction fails"); other flows → 2.8. |
| 2.3 | Isolation level chosen on purpose per flow | ✅ | — | READ COMMITTED everywhere (default), on purpose: correctness comes from guarded single-statement updates and explicit locks (2.4), not from SERIALIZABLE. Fine as long as every read-modify-write takes a lock — 2.5 has the one gap. |
| 2.4 | Race conditions blocked (row locks, `FOR UPDATE`, atomic `UPDATE … WHERE`) | ✅ | — | Stock: one guarded `UPDATE … WHERE quantity − reserved >= n` / upsert per line (`repos/inventory.ts`), average cost in the same statement. Cash: guarded `UPDATE … WHERE amount + x >= 0` (`ledgerService.ts`). Invoice numbers: per-tenant advisory lock (INV-NUM-1, fixed). Offline blocks: one atomic upsert. Transfer edit / delete: `claimWarehouseTransferLegs` (`FOR UPDATE` + exact-legs check). Invoice delete: deletes the row first, so a second delete finds nothing. Generic updates lock the row (`docs.ts`). Stress on staging 2026-11-17: parallel sales, double delete, replay all pass. |
| 2.5 | No update based on a stale read (read-modify-write inside the lock) | ✅ | ~~High~~ | **Fixed 2026-11-17 (EDIT-RACE):** both edits now start their transaction with `lockUnchangedInvoice` (`db/repos/invoices.ts`): `SELECT … FOR UPDATE` on the invoice and refuse ("changed meanwhile. Reload and try again.") unless `updatedAt` is still the one the edit read. Tests: `invoices.pg.test.ts` (fails without the check) and `npm run stress` "parallel edits". Staging (deploy of `c02cc7e`, tenant `postgresql`): stress all 17 checks passed — parallel edits answered 204 + 422, stock 97 = invoice quantity 3. Original finding: **Sale and purchase invoice edit** read the existing invoice **before** the transaction without a lock (`selling-invoice/api.controller.ts:1302` `patchInvoice`, `buying-invoice/api.controller.ts` `patchBuyingInvoice`), then inside it reverse the *old* items and apply the new ones as stock deltas; the invoice row is locked only at the final save. Two edits of the same invoice at once (two tabs, two cashiers, double click on save) both reverse the same old items. Example: stock 10, sale of 2 → 8. Edit A (→ 3) and edit B (→ 1) run together, both from the old snapshot: A +2 −3 → 7, B +2 −1 → 8. Stock ends at 8 (= 2 sold), but the invoice says 3 or 1, whichever saved last. Cash is not affected (each edit rewrites the invoice's ledger to its final state). The stress "edits back and forth" ran edits one after another, so it did not catch this. Daily action edit (saves first, then reads), transfer edit (claim check) and all deletes are safe. Fix: lock and re-read the invoice inside the transaction (`SELECT … FOR UPDATE`) before reversing. |
| 2.6 | Key business rules also enforced in the database | ⚠️ | Medium | In the DB: uniqueness of business ids, `sync_mutations (tenant, client_mutation_id)`, ledger `idempotency_key`, inventory `(tenant, warehouse, product)`, one pending renewal per tenant, one default label template. Only in code: stock ≥ 0 when oversell is off, cash ≥ 0, invoice-number uniqueness, sign / rate rules (PG-AUDIT-1 1.4, 1.6). The code guards are atomic SQL, so they hold under concurrency; the gap is only a second safety net. |
| 2.7 | Deadlocks: lock order consistent; retry exists and is safe to repeat | ⚠️ | Low | Retry: an own transaction is re-run up to 3 times on `40P01` / `40001` (tested: `inventory.pg.test.ts` "retries a transaction that lost a deadlock"); the callbacks only write to the DB, so a re-run is clean. Lock order: invoice lines are locked in request order, not sorted by product — two edits with lines [A, B] and [B, A] can deadlock and get retried. Creates in one tenant no longer deadlock with each other (serialized by the INV-NUM-1 lock). Sorting lines by product id would remove the remaining case. |
| 2.8 | Failure injection tested (throw after step N) | ⚠️ | Medium | One test: invoice delete rolls back when a later step fails. None for sale / purchase create and edit, transfer, cash transfer / exchange. Root `CLAUDE.md`: no full Mongo/Postgres test setup — but the `*.pg.test.ts` files already run against a real Postgres (CI service), so these can be added there. |

Walk each flow and record the lock order, rows touched, and rollback result:

| Flow | Transaction? | Locks | Rollback tested | Note |
| --- | --- | --- | --- | --- |
| Create sales invoice | ✅ one | number lock (tenant) → invoice insert → stock row per line (guarded update) → cash balance (guarded) | ⚠️ not per flow | Duplicate request: unique `invoice_id` aborts the second one; replay finds it by id first |
| Create purchase invoice | ✅ one | number lock → insert → stock upsert with average cost → cash | ⚠️ | Same as sales |
| Edit / delete invoice (cancel) | ✅ one | Delete: invoice row first, then stock, cash. Edit: invoice row `FOR UPDATE` + version check first, then stock lines, cash, invoice save | Delete ✅ (test) · Edit ✅ (race test) | Edit race fixed 2026-11-17 — 2.5 |
| Returns | — | — | — | No separate return flow: a return is a sale edit or delete (`return_in` stock movements), so 2.5 applies |
| Stock update / transfer / exchange | ✅ one | Transfer: source rows (guarded), target rows; edit / delete claim legs `FOR UPDATE` first | ⚠️ | Double delete of a transfer: tested (`inventory.pg.test.ts`) |
| Cash account movement / transfer | ✅ one | Guarded `UPDATE` on the source balance, upsert on the target | ⚠️ | Overdraft refused atomically (tested in `ledgerService.pg.test.ts`) |
| Cash exchange (currency conversion) | ✅ one | Same as transfer, two currencies | ⚠️ | Rate / fee correctness → PG-AUDIT-3 |
| Ledger / accounting entries | ✅ inside each flow | Ledger rows + `cash_account_balances` in the caller's transaction; unique `idempotency_key` | ⚠️ | Balance = ledger sum: checked on staging (only the known `zobani-car` gap) |
| Offline sync replay | ✅ per entry | Each entry runs its normal create / edit transaction; `sync_mutations` recorded after | ✅ stress | Crash between commit and record: replay finds the existing record by its id. Replayed edits get the 2.5 check too |

### PG-AUDIT-3 — Money and multi-currency (brief §6)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 3.1 | Amounts in `numeric`, never float — in DB **and** in JS math | ⚠️ | Medium | DB: all money columns `numeric` (exact). JS: every amount is computed as a JS float (tender allocation, percent discounts, `roundPrimary` = `Math.round(x*1e8)/1e8` in 3 copies: `ledgerService.ts:50`, `cashImpact.ts:30`, `store-domain/primaryCost.ts:19`) and stored as-is. Staging: 47 primary invoice totals with >2 decimals, 12 with float noise (`50.846399999999996`); 68 ledger rows >2 decimals (66 Mongo era). `daily_actions.total_price` / `single_unit_price` are **text**, parsed with `parseFloat` (`api.controller.ts:4540`); all 101 rows numeric today. |
| 3.2 | Precision/scale fit every currency (incl. high-value currencies) | ⚠️ | Low | `numeric` has no precision limit, so any currency fits. No per-currency number of decimals exists (no column in `currencies` / `currency_setting_items`), so totals are never rounded to cents / whole units. JS limit: `amount*1e8` loses precision above ~90 million units per single post — reachable in LBP / SYP / IQD (largest staging invoice today 787,902). |
| 3.3 | Every amount stored with its currency | ✅ | — | Staging: 0 ledger rows, 0 invoice currency rows, 0 tenders without a currency. Cash is posted in the currency handed over, never converted (`cash-accounts.md`). |
| 3.4 | Original amount + original currency kept | ✅ | — | Invoices keep one `invoice_currency_amounts` row per currency (amount, paid, remaining, rate) and `tenders` with `tendered_amount` in the tender currency; ledger rows carry their own currency. |
| 3.5 | Rate used at create time is snapshotted | ⚠️ | **High** | Invoices: the rate is snapshotted on `invoice_currency_amounts.exchange_rate` (all 526 rows > 0, every invoice has exactly one primary at rate 1). But the server **takes rates and totals from the request without checking them** (`posting.ts` `storedInvoiceTenders`: rate `0` silently becomes `1`, a negative rate passes; no check of totals against item lines or of rates against settings). Cash exchanges are the only flow that checks live rates (`cashAccounts/types.ts:125-139`). Daily actions: rate stamped from today's settings when the request arrives, unknown currency → `1` — **fixed 2026-11-17, see 3.7**. Invoice part still open. |
| 3.6 | Converted amount + target currency stored | ✅ | — | Invoice rows store the amount in every currency of the invoice; exchanges store both legs and both rates (`from_/to_exchange_rate_to_primary`, all 12 staging exchanges have them). |
| 3.7 | History never recalculated with today's rates (sync replays included) | ⚠️ | ~~High~~ Low | **(a), (b) and the 1 : 1 fallback fixed 2026-11-17 (DAILY-RATE):** `resolveDailyActionRate` (`shared/dailyActionRate.ts`, tested in `dailyActionRate.test.ts`) — replay keeps the device-stamped rate (`offline/localHandlers.ts` stamps it), an edit with the same currency keeps the stored rate, an unknown currency is refused. Open: (c) legacy rows without a rate — data decision in PG-MIG-3. Original finding: Invoices ✅: 118 of 189 non-primary rate rows differ from today's settings, i.e. history kept. Exchanges ✅: replays skip the live-rate check. **Daily actions ❌:** (a) an offline entry synced later gets the rate of the sync day, not its create day (`postDailyAction` ignores any client rate); (b) every edit re-stamps today's rate (`patchDailyAction`, `api.controller.ts:4371`), so fixing a note on an old SYP payment revalues it; (c) 3 legacy SYP rows (2026-08/09) have no rate and are valued at the **live** rate every time (`amountToPrimaryWithSnapshot` fallback). |
| 3.8 | Conversion fees recorded | ❌ | Low | No fee field on exchanges or transfers. Not needed now unless the shop pays exchange fees; then a third ledger leg (EXPENSE) is the smallest addition. |
| 3.9 | Realized FX gain/loss | ❌ | — | No general ledger, so no realized FX gain / loss. Not needed now (rule 7); needed for real accounting / tax reports. |
| 3.10 | Unrealized FX gain/loss (needed? when?) | ❌ | — | Not needed now. Cash is held per currency and never revalued; party balances are shown in primary at snapshot rates. |
| 3.11 | Entries created by a conversion are correct and auditable | ✅ | — | Exchange = two ledger rows in one transaction, shared `transfer_group_id`, both rates stored, idempotency keys `cash_exchange:<id>:from|to`. Staging: 12 of 12 exchanges match `round2(round8(from / fromRate) * toRate)` within 0.01. |
| 3.12 | Balance proof: sum of ledger = account balances; debit = credit if a GL exists | ⚠️ | Medium | Balance = ledger sum for every tenant except the known `zobani-car` gap (1,600, Mongo era, decide in PG-MIG-3). Selling invoices: 50 of 50 (invoice, currency) pairs have net ledger = applied tenders; deleted invoices leave 0 net cash. No GL, so no debit = credit proof (3.9). |
| 3.13 | Corrections by reversing entries, not by editing posted rows | ✅ | — | Edits / deletes never change posted rows: `syncCashEffectsForReference` writes REVERSAL rows (`reverses_ledger_entry_id`, key `rev:<id>`) then the new posts. Staging: 51 reversals, all mirror their original exactly, none reversed twice. |
| 3.14 | Transfers between Cash / Online / Treasury | ✅ | — | `daily_cash` / `cash_reserve` / `online` per warehouse; transfer = same currency, two legs, guarded debit. Staging: 20 transfer groups, all net 0. |
| 3.15 | Available funds vs electronic funds pending settlement | ❌ | — | Not needed now: `online` is a plain account; card money counts as available at once. Needed for real card settlement (payout delays, fees). |
| 3.16 | All money writes atomic | ✅ | — | See PG-AUDIT-2 (2.1, 2.4): every money write is in its flow's transaction with guarded balance updates. |

Deliverable: a list of concrete wrong-books examples possible with today's design (input → wrong result).

**Wrong-books examples (2026-11-17, staging data + code):**

1. **Fractions of a cent in the drawer.** 1 % line discount on 1.50 USD → invoice 1.485; customer pays
   1.49 → ledger +1.485, change 0.005 (`cafeshop` SI-097502, SI-098001, Postgres era). Counted cash
   and the system drift apart by these fractions. Cause: no rounding to the currency's decimals (3.1, 3.2).
2. **Client decides the money.** A request with `currencyAmounts[0].amount` 1 for items worth 100, or
   `exchangeRate` 0 (becomes 1) / a wrong rate, is accepted → revenue, customer balance and cash posted
   from the request, not from the items (3.5). Not seen in staging data; possible via the API or a
   buggy / old client.
3. ~~**Offline payment revalued on sync.**~~ Fixed 2026-11-17 (3.7). Payment of 1,000,000 SYP entered offline on day 1 (rate
   13,000), synced on day 3 after the rate changed to 15,000 → stored rate 15,000 → supplier
   balance off by ~10 USD (3.7a).
4. ~~**Editing a note revalues an old payment.**~~ Fixed 2026-11-17 (3.7). Any edit of an old non-primary daily action stamps
   today's rate (3.7b).
5. ~~**Unknown currency counted 1 : 1.**~~ Fixed 2026-11-17 (refused now); legacy rows without a rate still open. A daily action in a currency missing from currency settings gets
   rate 1 → 1,000,000 SYP counted as 1,000,000 primary (3.5). 3 legacy SYP rows without a rate are
   valued at the live rate every time (3.7c).
6. **Huge amounts round wrongly.** A single post above ~90 million units (LBP / SYP) loses precision in
   `Math.round(x * 1e8)` (3.2). Not seen in staging data.

### PG-AUDIT-4 — Multi-tenancy and isolation (brief §7)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 4.1 | `tenant_id` on every tenant-owned table | ✅ | — | Every `store.*` table and the tenant-owned platform tables (tenants, users, refresh tokens, renewal requests) have `tenant_id`, NOT NULL except `refresh_tokens` (super admin). Without it, by design: `newsroom_*`, `roles`, `subscription_payment_settings` (global platform data). Staging: 0 rows in an unknown tenant; 0 child rows (invoice items / tenders / amounts, buying equivalents, cash balances, payouts) whose tenant differs from their parent. |
| 4.2 | Every query scoped (grep all raw SQL / repos / `pgFind` paths) | ✅ | — | Generic helpers (`pgFind` / `pgFindOne` / `pgUpdate*` / `pgDelete*`, `docs.ts`) require a tenant and fail closed. All 34 hand-written Drizzle queries (`repos/*`, `ledgerService.ts`, `invoiceAi/usage.ts`, `productImport/service.ts`, crons) filter by tenant — the ledger list via `buildCashLedgerListWhere` (`ledgerService.ts:878`); the two cron deletes are global on purpose (expired rows by date). `ALL_TENANTS` outside newsroom: login by email domain, refresh token by hash, tenant admin, renewal requests / payment settings (all behind `ensureSuperAdmin`), crons looping over tenants. Create / update always overwrite `tenantId` from the login (`documentActions.ts`), so a request body cannot redirect a write. |
| 4.3 | One tenant cannot read or write another's data (test with two tenants) | ⚠️ | Medium | The tenant always comes from the JWT (`api.authorize.ts` → `validateUser`); no route reads a tenant id from body, query, params or headers. Staging: references by business id never resolve only in another tenant (38 relations), **except** 6 `cafeshop` cash accounts pointing at warehouses of `app` and `zobani-car` (2026-10-23 and 2026-11-08, no ledger rows): an owner's `x-warehouse-scope` header was accepted as sent. **Fixed 2026-11-17 (TENANT-WH):** the auth middleware loads the tenant's warehouse ids when an owner / super admin sends the header, and `resolveWarehouseScope` drops foreign ids (`warehouseAccess.test.ts`). Staging (`d90b3ea`): owner of `postgresql` calling `GET /cash-accounts/balances` with a `zobani-car` warehouse in the header → `accounts: []`, 0 accounts created; own warehouse → 3 accounts. That read path (`getCashBalancesForWarehouses` creates accounts per scoped warehouse) is how the 6 `cafeshop` rows were made. No leak was possible (reads and writes stay in the caller's tenant), but foreign-warehouse rows could be written. Open: P1 (two-tenant test per resource) not written; the 6 rows are dev data to delete in PG-MIG-3. |
| 4.4 | Relations cannot link rows of two tenants (composite FK `(tenant_id, id)`?) | ⚠️ | Low | Relations use `(tenant_id, business id)` in every query, and child rows carry the parent's tenant (staging: 0 mismatches). The DB does not enforce it: no composite FKs (PG-AUDIT-1 1.3). Composite FKs on `(tenant_id, <business id>)` are possible once orphans are cleaned. |
| 4.5 | Row-level security: worth it as a second net? cost? (never replaces backend checks) | ❌ | — | No RLS. Not worth it now: every query already goes through tenant-requiring helpers (4.2), and RLS on Render needs a per-request `SET app.tenant_id` on pooled connections (two pools, transactions) — real cost and a new failure mode. Revisit when raw SQL spreads or a second service reads the DB. |
| 4.6 | Server enforces what the UI hides (`SEE.*`) | ⚠️ | High | Write methods guard with `ensureSeeIds`, `ensureTenantAccess` (via `createDocument`), `ensureSuperAdmin`, `ensureNewsroomManage` or `requireAccess`. **Found and fixed 2026-11-17 (SETTINGS-SEE):** currency settings and invoice settings (incl. `allowOversell`) could be changed by any role through the API or sync replay — only "online" was checked. Now `applyCurrencySettingsUpdate` / `applyInvoiceSettingsUpdate` require `settings.currencies` / `settings.invoice`, the same ids the Settings tabs use (`settingsSee.test.ts`). Not yet checked on staging with a real cashier login (no cashier credentials used). Smoke row 4.3 (SEE per action) is still open. |
| 4.7 | Cron jobs and workers run per tenant and stay scoped | ✅ | — | Crons (`cron/*`): subscription lifecycle, invoice-AI roll and negative-quantity snapshot load active tenants with `ALL_TENANTS` and then work per tenant with that tenant id; token / import-draft cleanup is global by date on purpose. |
| 4.8 | Warehouse scope: writes need an operational warehouse; combined view never posts | ✅ | — | Invoice, purchase, daily action, transfer, inventory and cash writes call `requireOperationalWarehouseId` (exactly one warehouse) and `ensureWarehouseAccess`; a combined view is refused. Non-owner roles are bounded by `user.warehouseIds`; owners now by the tenant's warehouses (4.3). |
| 4.9 | Entity model: Tenant / Organization / Store / Branch / Warehouse / Seller — what a marketplace needs that `tenant_id` alone cannot express | ❌ | — | Only Tenant → Warehouse exists (PG-AUDIT-0 0.9). A marketplace / webshop would need what `tenant_id` cannot express: a **channel** (where a sale comes from), **listings** (which product, stock and price is offered where), **stock reservations** per order, and possibly **sellers** below a tenant. All can be added as new tables keyed by `(tenant_id, …)` without changing existing ones — design note for P10. |

---

## Part B — after the switch (PG-MIG-4), before marketplace work

### PG-AUDIT-5 — Inventory and commerce readiness (brief §8)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 5.1 | Product vs variant separated | | | |
| 5.2 | Product vs listing (per channel) separated | | | |
| 5.3 | Inventory vs listing separated | | | |
| 5.4 | Stock per warehouse and location (shelf) | | | |
| 5.5 | On-hand / reserved / available-to-sell | | | |
| 5.6 | Stock movements recorded (who, why, before/after) | | | |
| 5.7 | Concurrent stock updates safe | | | |
| 5.8 | Overselling prevented (or allowed on purpose: negative stock policy) | | | |
| 5.9 | Checkout reservation policy | | | |
| 5.10 | Release on failed payment / expiry | | | |
| 5.11 | Cancel and return put stock back correctly | | | |
| 5.12 | Shared stock across channels | | | |

Scenario test: last unit sold by two channels at the same moment → exactly one succeeds.

### PG-AUDIT-6 — Indexes and query speed (brief §9)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 6.1 | Indexes match real WHERE / JOIN / ORDER BY of the top queries | | | |
| 6.2 | `tenant_id` leads composite indexes where queries filter by it | | | |
| 6.3 | FK columns indexed where joined or deleted by | | | |
| 6.4 | `EXPLAIN ANALYZE` on the top 10 queries (list, invoice create, reports, sync) | | | |
| 6.5 | Slow queries found (`pg_stat_statements`) | | | |
| 6.6 | N+1 patterns | | | |
| 6.7 | Over-fetching (`SELECT *`, whole jsonb docs) | | | |
| 6.8 | Unused / duplicate indexes (write cost) | | | |
| 6.9 | Table and index growth | | | |

### PG-AUDIT-7 — Pagination and reports (brief §10)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 7.1 | Large lists paginated | | | |
| 7.2 | Keyset instead of OFFSET where lists are deep | | | |
| 7.3 | Report queries (GROUP BY / JOIN cost) | | | |
| 7.4 | Materialized views — needed? refresh plan? | | | |
| 7.5 | Reports respect tenant, warehouse and permissions | | | |
| 7.6 | Multi-currency reports (no silent currency mixing) | | | |

### PG-AUDIT-8 — Security (brief §11)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 8.1 | App does not connect as superuser / owner | | | |
| 8.2 | Least-privilege app role | | | |
| 8.3 | Separate migration role | | | |
| 8.4 | Credentials only in env/secret store, not in repo (`src/.env` tracked?) | | | |
| 8.5 | TLS to the database | | | |
| 8.6 | Network access to Postgres restricted (Render allow-list) | | | |
| 8.7 | All queries parameterized; no string-built SQL (`mongoQuery.ts`, sort/filter keys) | | | |
| 8.8 | Schema / table grants reviewed | | | |
| 8.9 | No passwords, tokens or connection strings in logs | | | |

### PG-AUDIT-9 — Backup and recovery (brief §12)

Backup v2 was dropped from the migration epic (see [backup.md](backup.md)). Rate what Render gives today.

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 9.1 | Automatic backups | ✅ | — | Render Point-in-Time Recovery on `store-platform-prod-db` ($6 plan, owner 2026-11-18). |
| 9.2 | Retention policy | ⚠️ | High | Only **3 days** back. A problem found on day 4 cannot be undone. Fix: 9.3. |
| 9.3 | Copy stored outside the production provider | ❌ | High | None. Fix: daily `pg_dump` to storage outside Render, kept longer than 3 days. Start in the first days after PG-MIG-4. |
| 9.4 | Backups encrypted | 🔍 | | |
| 9.5 | Who can access backups | 🔍 | | |
| 9.6 | Point-in-time recovery | ⚠️ | Medium | Yes, but **whole database only**: the restore creates a new database at a chosen time (🔍 confirm it never overwrites the live one). No per-tenant restore: the tenant backup feature (`reference/backup.md`) is Mongo-only and never shipped; PG-MIG-5 dropped. One tenant = restore into a separate database, then copy that tenant's rows into production in one transaction (all rows carry `tenant_id`). That script does not exist; build it when first needed (`copy-prod-tenant.sh` reads Mongo only). |
| 9.7 | RPO / RTO written down | | | |
| 9.8 | Real restore test done, app runs on it | ❌ | High | Never done. Fix: restore to a new database, start staging against it, smoke, delete it (P7). In the first days after the switch. |
| 9.9 | Recovery runbook | | | |

**Mongo is not a backup after opening.** After PG-MIG-4 only Postgres receives writes; Mongo stays frozen at the switch. Redeploying `mongo-final` (14-day rollback window) loses every write made on Postgres since opening. From opening on, Point-in-Time Recovery (9.1) is the only backup of current data — hence 9.3 and 9.8 right after the switch.

### PG-AUDIT-10 — Migrations and deployment (brief §13)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 10.1 | Migrations in Git, ordered | | | |
| 10.2 | Run on staging before production | | | |
| 10.3 | No schema drift between environments (CI drift check) | | | |
| 10.4 | Old and new API both work during deploy | | | |
| 10.5 | No surprise breaking changes | | | |
| 10.6 | Expand-and-contract for big changes | | | |
| 10.7 | Lock time on big tables (`CREATE INDEX CONCURRENTLY`, `lock_timeout`) | | | |
| 10.8 | Rollback / recovery plan per migration | | | |
| 10.9 | Two instances cannot migrate at once (advisory lock at boot) | ⚠️ | Low | `src/scripts/db-migrate.ts` calls Drizzle's `migrate` without a lock of its own. Safe with one instance (same rule as 11.8). |
| 10.10 | Staging never gets unmasked production data | ❌ | Medium | The G6b dry run loaded all 12 production tenants unmasked into staging (runbook section 4). Fix: delete the copies after the switch (runbook section 5, GDPR); later rehearsals use the same delete step. |

### PG-AUDIT-11 — Background jobs and events (brief §14)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 11.1 | Transactional outbox (event row in the same transaction) — needed now? | | | |
| 11.2 | Worker processes events | | | |
| 11.3 | Idempotency keys on retryable writes (client id per form) | | | |
| 11.4 | Duplicate webhooks blocked | | | |
| 11.5 | Retries with limits | | | |
| 11.6 | Failure state recorded | | | |
| 11.7 | Stuck jobs visible | | | |
| 11.8 | Cron cannot run twice at once (multiple instances) | ⚠️ | Low | Crons run inside the API process (`node-cron`, `src/cron/*.ts`) with no lock. Safe while the API runs as **one instance**; a second instance runs every job twice (e.g. subscription notices). Fix when scaling out: advisory lock per job. |
| 11.9 | No lost events if the API dies after commit | | | |

### PG-AUDIT-12 — Monitoring and maintenance (brief §15)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 12.1 | Connection count watched | | | |
| 12.2 | Pool size / timeouts fit Render plan limits | ✅ | — | 2 pools × `max: 10` = 20 per API instance (`db/client.ts:14`); during a deploy old + new instance overlap → ~40, plus a few for migrations / `psql`. Plan limit 100 (owner 2026-11-18). The tighter limit is the plan's **0.1 CPU / 256 MB RAM**: watch the database Metrics page during the rollback window; upgrade the plan if CPU or memory stays high (no code change). |
| 12.3 | Slow query log | | | |
| 12.4 | CPU / memory / disk | | | |
| 12.5 | Deadlocks | | | |
| 12.6 | Lock waits | | | |
| 12.7 | Autovacuum / ANALYZE healthy | | | |
| 12.8 | Table / index growth | | | |
| 12.9 | Error alerts (`23505`, `40P01`, timeouts) | | | |
| 12.10 | Regular health review | | | |

---

## PG-AUDIT-R — Report and remediation plan

Written after the checklists are filled. Nothing is fixed before the owner approves this.

1. **Summary** of the current state (half a page).
2. **Strengths.**
3. **Problems** with file references, ranked.
4. **Plan** in five buckets, each item with cause, fix, impact on existing data and code:
   - Critical
   - High
   - Medium
   - Low
   - Future marketplace readiness

### Report — 2026-11-17 (Part A: PG-AUDIT-0 … 4)

**Summary.** The Postgres layer is sound for the switch. Every money and stock flow runs in one
transaction with guarded single-statement updates; tenant scope is enforced by helpers that fail
closed; history keeps its rates. The audit found five real bugs, all fixed, tested and verified on
staging the same day: duplicate invoice numbers under parallel sales (INV-NUM-1, 5 × `SI-104501`
seen on staging), two edits of one invoice corrupting stock (EDIT-RACE), daily actions revalued on
sync / edit and unknown currencies counted 1 : 1 (DAILY-RATE), an owner's warehouse header naming
another tenant's warehouse (TENANT-WH, 6 rows on staging), and currency / invoice settings writable
by any role (SETTINGS-SEE). `npm run stress` now covers them (21 checks, green on staging for
`d90b3ea`). What is left is mostly a second safety net in the database (constraints), money
validation on the server, and decisions about old dev data before the production rehearsal. Part B
(PG-AUDIT-5 … 12: indexes, reports, security, backup, deploy, jobs, monitoring) runs after the
switch, as planned.

**Strengths.**

- One transaction per flow, READ COMMITTED with explicit locks; stock and cash guards are atomic
  SQL, proven by parallel tests (2.1–2.4).
- Corrections are reversing rows, never edits of posted cash (3.13); cash = ledger in every tenant
  except one known Mongo-era gap (3.12).
- Rates are snapshotted on invoices and exchanges; history is not recalculated (3.5–3.7, 3.11).
- Tenant always from the login; all 34 hand-written queries scoped; writes overwrite `tenantId`
  from the context (4.2, 4.3).
- Migrations drift-checked in CI and applied before start (0.3).

**Problems, ranked** (open only; fixed items are in the checklists above).

| # | Problem | Where | Bucket |
| --- | --- | --- | --- |
| 1 | Data decisions before PG-MIG-3: `zobani-car` cash gap 1,600; 8,930 orphan inventory / movement rows (`center`); 62 orphan links and 6 foreign-warehouse cash accounts (`cafeshop`); 3 rate-less SYP daily actions; 5 × `SI-104501` (owner: ignore) | staging data, 1.12, 3.7c, 4.3 | Critical |
| 2 | Plain `npm test` loads `.env` (staging `DATABASE_URL`) and runs the `*.pg.test.ts` files against staging — proven by an import probe; no test data found on staging yet | `config/config.ts:4`, `src/test/*.pg.test.ts` | High |
| 3 | Server takes invoice totals, paid amounts and rates from the request; rate 0 becomes 1, negative passes | `shared/cashAccounts/posting.ts` `storedInvoiceTenders`, 3.5 | High |
| 4 | API needs Mongo to start although it no longer reads it | `server.ts:13`, `docker-entrypoint.sh`, 0.7 | High |
| 5 | No unique index on `(tenant_id, invoice_number)` (race fixed in code; DB net missing) | 1.4, INV-NUM-1 | High |
| 6 | Totals not rounded to the currency (fractions of a cent in cash, float noise stored); no per-currency decimals | 3.1, 3.2 | Medium |
| 7 | Only 6 FKs, 0 CHECK; 6 nullable key columns (all filled) | 1.3, 1.5, 1.6 | Medium |
| 8 | No failure-injection test per flow; no two-tenant test per resource (P1, P5) | 2.8, 4.3 | Medium |
| 9 | Permission (SEE) not yet checked action by action (smoke 4.3) | 4.6 | Medium |
| 10 | Small: line lock order unsorted (2.7), `numeric` without scale / daily-action money as text (1.10), SSL only via URL (0.1; runbook commands use `sslmode=verify-full`, API's internal URL 🔍), ~~pools not closed on shutdown~~ (fixed, PR review), Redis cache relies on every write calling `del`, role seed scripts write Mongo only, `Math.round(x*1e8)` limit above ~90 M units | 0.1, 0.7, 0.8, 1.10, 2.7, 3.2 | Low |

**Plan.** Nothing below is started before the owner approves it.

*Critical — before PG-MIG-3 go / no-go*

- ✅ **Staging done 2026-11-17 (owner decision: delete):** all dev tenants removed except `postgresql` and the super admin (10 tenants, 13 users, 25,164 store rows; backup taken first; dry run, then one transaction). After: 0 orphans, 0 duplicates, cash = ledger, `zobani-car` gap gone with its tenant. **Production copy:** run the same read-only checks in PG-MIG-3 and decide there — real shop data is not deleted wholesale. **First production tenant (2026-11-17):** `rivo testing` (`e630302b-…`) copied to staging with `scripts/copy-prod-tenant.sh` (`--verify` passed, no unmapped fields). Checks: 0 duplicates, cash = ledger, rates / totals valid, cash per invoice = paid amount (18 / 18, all historical invoices without tenders), no foreign warehouses. Findings: 2 purchase invoices (BI-000002, BI-000003) point to suppliers deleted in production on Mongo (names kept on the invoice); 1 negative stock (oversell allowed); 1 ledger row 7.14285714 (M1 rounding). Owner decision: keep the 2 orphans as they are (a).
  **Biggest production tenant (2026-11-17):** `oneDollar` (`93b80634-…`: 4 users, 2,696 products,
  1,016 sales, 1,476 ledger rows) copied to staging, `--verify` passed. Clean: 0 duplicate invoice
  numbers, cash = ledger, rates / totals valid, reversals mirror, transfers net 0, daily actions all
  rated; cash per invoice correct for 1,007 / 1,016 — the other 9 are 7 Mongo-era invoices whose stored
  `paidAmount` is a few cents above the total while the ledger got exactly the total, and 2 drafts
  (no cash, correct). Findings for the cutover decision:
  1. 16,430 inventory rows (10,996 with quantity) for products that no longer exist — import of
     2026-09-21/22, same pattern as dev tenant `center`.
  2. 414 products share 175 barcodes (same names), all created by the 2026-09-22 import.
  3. 3 empty cash accounts on a warehouse that is not this tenant's, created 2026-11-16 (the
     TENANT-WH bug in production; fixed in `d90b3ea`).
  4. ~~Not an error (2026-11-18):~~ 3 of the 4 invoices are sales to the **partner** OSAMA ALHOMSI —
     the app stores a partner id in `customer_id` and the partner view shows them; the 4th (SI-129787,
     ابو قاسم) is a draft the owner ignores. Reconcile now accepts partner ids. Original text:
     4 invoices point to 2 customers that are not in the copy (OSAMA ALHOMSI, ابو قاسم); 3 are credit
     with 1,458 open (one a draft). Delete guard exists since 2026-10-14; no sync error found — check
     production Mongo whether the customers exist there without `tenantId`.
  5. 268 ledger rows with > 2 decimals (M1 rounding).
  **Decisions (owner, 2026-11-17):** #1 and #3 deleted at cutover by `scripts/cutover-cleanup.sql`
  (dry run + apply rehearsed on this copy: 16,430 stock rows, 3 cash accounts; afterwards 2,696
  stock rows for 2,696 products, cash = ledger). Cause of #1: the same ~2,660-row file imported ~7×
  on 2026-09-21/22; earlier runs left stock without products — cannot recur (import commit is one
  transaction; product delete removes stock). #2 → ticket PROD-BARCODE-1. #5 → M1. #4 waits for
  the production Mongo check. — **C1 Old data decisions (#1).** Cause: Mongo-era deletes without guards, a stale warehouse
  header, legacy imports. Fix: run the read-only checks (`orph.sql`, per-tenant checks) on the
  production copy; per item decide keep / delete / repair; script the chosen repairs in the
  rehearsal, never by hand. Impact: data only; no code. For dev-only tenants (`center`, `cafeshop`,
  `app`): delete or ignore.

*High — before PG-MIG-4*

- ✅ **Done 2026-11-17** — **H1 Tests must never reach a shared database (#2).** Cause: `config.ts` loads `.env` at import,
  and `.env` points at staging. Fix: Postgres tests read a separate `TEST_DATABASE_URL` (CI sets
  it), never `DATABASE_URL`; one line in `CLAUDE.md`. Impact: test setup only; CI env change.
- ✅ **Done 2026-11-17 (INV-MONEY-1), verified on staging (`8fd71e4`):** stress 21/21; online sale SI-011505 and offline-synced sale SI-011005 paid in ليرة (1,680 / 315 = total × 140, ledger equal); all 11 invoices since the deploy: total = lines, secondary = primary × rate, rates = today's — **H2 Server-side invoice money checks (#3).** Cause: offline-first design trusted the client.
  Fix: on create / edit, refuse rate ≤ 0 or not finite; recompute the primary total from the lines
  (± 0.01) and refuse a mismatch; live requests check rates against today's settings, sync
  replays keep their snapshot (same rule as cash exchanges). Impact: API only; old invoices
  untouched; a buggy client gets a clear error instead of wrong books. Needs a short design note
  for offline drafts.
- ✅ **Done 2026-11-17** — **H3 Start without Mongo (#4).** Cause: migration kept the Mongo connection. Fix: drop
  `connectDB()` and the Mongo check from `server.ts` / `docker-entrypoint.sh`; keep Mongoose only
  as validation (it needs no connection). Impact: production depends on one database from the
  switch on; rollback to Mongo still possible by redeploying the old image.
- ⏭️ **Owner decision 2026-11-17: not done.** The per-tenant allocation lock (INV-NUM-1) stays the only protection; staging stress proves no duplicates. — **H4 Unique invoice number index (#5).** Fix: after C1 confirms production has no duplicates,
  add `UNIQUE (tenant_id, invoice_number)` for selling and buying (staging: a partial index or
  clean the 5 dev rows first). Impact: one migration; the code already never produces duplicates.

- **H5 Backups after the switch (9.2, 9.3, 9.8)** — first days after PG-MIG-4. Cause: from opening,
  Point-in-Time Recovery (3 days, whole database) is the only backup; Mongo is frozen. Fix: one
  restore test (new database → staging → smoke → delete) and a daily `pg_dump` outside Render.
  Impact: ops only; no code. Per-tenant restore script only when first needed (9.6).

*Medium — after the switch, before new features*

- **M1 Currency rounding (#6).** Add a decimals setting per currency (default 2); round invoice
  totals and posted cash to it. Impact: new column + rounding in totals; old rows unchanged.
- **M2 Database constraints (#7).** NOT NULL on the 6 filled key columns; CHECK on prices ≥ 0,
  rates > 0, quantities > 0 on lines; composite FKs `(tenant_id, business id)` once C1 removed the
  orphans. Impact: migrations; each fails fast if production data breaks the rule (run on the
  copy first).
- **M3 Proof tests (#8).** Failure-injection test per flow (create / edit sale and purchase,
  transfer, cash exchange) and a two-tenant test per resource (P1, P5). Impact: tests only.
- **M4 SEE per action (#9).** Finish smoke row 4.3 with a script that calls each write with a
  role lacking the permission. Impact: tests; fixes where a gap shows up.

*Low — when touched*

- **L1** Sort invoice lines by product before locking; close pools in `gracefulShutdown`; set
  `ssl` explicitly in `client.ts`; move role seeding to Postgres or delete it (PG-MIG-6);
  `numeric(18, 6)` / text money only together with M1.

*Future marketplace readiness*

- **F1** New tables keyed by `(tenant_id, …)`: channel, listing (product × channel, own price /
  stock share), stock reservation per order; optional seller below tenant (4.9). Existing tables
  stay as they are.
- **F2** General ledger only when accounting / tax reports need it: then FX gain / loss (3.9,
  3.10) and card settlement (3.15).
- **F3** Revisit row-level security when a second service reads the database (4.5).

**Suggested order:** C1 is part of PG-MIG-3. H1 first (a minute of work, removes a real risk), then
H3 and H4 with the rehearsal, H2 as its own ticket before PG-MIG-4.

## Done when — proven by tests

| # | Proof | How | ✓ |
| --- | --- | --- | --- |
| P1 | One tenant cannot reach another tenant's data | API + repo tests with two tenants, every resource | |
| P2 | One stock unit cannot be sold twice concurrently | Parallel sale test (`npm run stress` extended) | ✓ 2026-11-17 staging: 12 buyers, 5 in stock → 5 sold, stock 0 |
| P3 | All money flows keep the books balanced | Invariant query: ledger sum = balances (and debit = credit if a GL is added) after each flow | |
| P4 | Currency conversions create correct, auditable entries | Exchange tests with snapshot rates and fees | |
| P5 | Failure inside a transaction rolls back everything | Failure-injection test per flow | |
| P6 | Retries / resends do not duplicate | Same client id twice → one record | ✓ 2026-11-17 staging: offline batch sent 4× → each sale once |
| P7 | A backup restores and the app runs on it | Restore drill on a fresh instance + smoke critical path | |
| P8 | Migrations deploy without data loss or long downtime | Migrate a production copy, time it, verify | |
| P9 | Core queries and reports are fast enough | `EXPLAIN ANALYZE` numbers on a production-sized copy | |
| P10 | A new sales channel needs no foundation rebuild | Design note: listing / reservation / channel tables fit the schema as additions | |

Note: there is no Mongo/Postgres test DB setup in CI for every case yet (see root
`CLAUDE.md`); proofs that need a real database run against a local Postgres or staging and
are written down here with the date.

## PR review findings (2026-11-18, before PG-MIG-4)

| Finding | Decision |
| --- | --- |
| 🔴 `allocateOfflineBlock` without the INV-NUM lock: a block could cover an uncommitted online number | **Fixed:** both share `lockInvoiceNumbers`; the block reserves in its own short transaction (`invoices.pg.test.ts`, fails without the lock) |
| 🟡 `posting.ts` turned rate 0 into 1 for every caller | **Fixed:** non-positive rates refused (`storedInvoiceTenders.test.ts`) |
| 🟡 reconcile only checked selling | **Fixed:** duplicate buying numbers, purchase cash ≠ paid, buying rates, buying child tenant |
| 🟡 `gracefulShutdown` did not close the pools | **Fixed:** `closeDb()` before exit (SIGTERM tested) |
| 🟡 `latestInvoiceSequence` scans all numbers under the lock (O(n)) | **After the switch** (PG-AUDIT-6): ~1,000 invoices per tenant today, so the lock window stays small; move max/parse into SQL before tenants reach tens of thousands |
| 🟡 `parseLedgerDateBound` uses the process time zone | **Not migration-related:** Render runs in UTC, so production behaves the same as on Mongo; a per-tenant time zone is a feature ticket |
| ✅ buying online numbers ignore the offline floor | **Changed 2026-11-19 (branch `tenant-backup`, owner decision):** buying respects its floor like selling, so a backup restore can raise it and never reissue printed BI numbers |
| 🔵 H4 unique index | Owner decision 2026-11-17: not done; the lock is the protection |
