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
| S-4 | 2.5 | Log out of all devices: other browser stays logged in. Likely cause: `logoutAll` deletes refresh tokens but does not bump `tokenVersion` (change password does), so the 15-min access token keeps working | bug (security) | High | open |
| S-2 | 1.4 | Subscription payment image not displayed correctly. Need: what was shown (broken icon / too small) and the URL type (share link vs direct image) | bug | Medium | open |
| S-3 | 8.5 | Renewal success message shows on every login (should be first login after renewal, or first week) | bug | Medium | open |
| S-1 | 1.3 | Allowed pages / offline toggle only apply after logout + login, not after reload; dashboard cannot be removed (confirm intended) | bug / UX | Low | open |
| S-5 | 3.1 | Same currency twice: not stored, but request is a fetch instead of a POST and no error is shown | bug / UX | Low | open |
| S-6 | 6.7 | Warehouse transfer has no delete | missing | Low | roadmap |
| S-7 | 6.9 | Daily actions and expenses have no edit / delete | missing | Low | roadmap |
| S-8 | 8.1 | Refuse a selling invoice when any item has no retail price | missing | Low | roadmap |

---

## Part A — must be done before PG-MIG-3

### PG-AUDIT-0 — Discover the current state (no proposals yet)

Answer each in a few lines with file references:

| # | Question | Answer / evidence |
| --- | --- | --- |
| 0.1 | How does the API connect (driver, pool, SSL, env vars)? | `src/db/client.ts` |
| 0.2 | How are tables and relations designed? Which tables are real columns, which are Mongo-shaped `jsonb` documents? | `src/db/schema/*`, `src/db/docs.ts` |
| 0.3 | How are migrations made, checked (drift) and run (boot? CI?) | `drizzle/`, `drizzle.config.ts` |
| 0.4 | How do transactions run (helper, isolation, retry on `40P01`/`40001`)? | |
| 0.5 | How is tenant scope enforced (`withTenantScope`, fail-closed check, `ownership.ts`)? | |
| 0.6 | How do sales, purchases, stock and cash writes flow end to end? | `db/repos/*`, `ledgerService.pg.ts` |
| 0.7 | What still talks to Mongo or Mongoose (validation only?) | |
| 0.8 | Where is Redis used, if at all? | `middleware/rateLimiter.ts` |
| 0.9 | Map of business entities: Tenant / Organization / Store / Branch / Warehouse / Seller — which exist, how they relate | |

**First-glance leads (unverified, 2026-11-11):** 6 foreign keys and 0 CHECK constraints in
`0000_init.sql`; no row-level security; 13 `jsonb` columns; money columns use `numeric`;
only one `timestamp(` in schema (dates may be stored as text — check).

### PG-AUDIT-1 — Schema and design (brief §4)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 1.1 | Postgres is the single source of truth (no reads/writes left in Mongo or cache) | | | |
| 1.2 | Tables and relations make sense; jsonb used only where structure is truly free | | | |
| 1.3 | Foreign keys on every real relation | | | |
| 1.4 | Unique constraints (tenant-scoped: invoice numbers, names, barcodes, client ids) | | | |
| 1.5 | NOT NULL on required fields | | | |
| 1.6 | CHECK constraints (qty/amount signs, enums, rate > 0) | | | |
| 1.7 | ON DELETE / ON UPDATE behavior fits soft/hard delete rules (`master-data-delete.md`) | | | |
| 1.8 | No needless duplicated data; denormalized copies are snapshots on purpose | | | |
| 1.9 | Normalization where it matters | | | |
| 1.10 | Data types (numeric precision/scale, timestamptz vs text, ids, enums) | | | |
| 1.11 | Migrations ordered, idempotent, safe to apply on a live DB | | | |
| 1.12 | No orphan rows today (query per relation on staging data) | | | |

### PG-AUDIT-2 — Transactions and integrity (brief §5)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 2.1 | Every multi-table write runs in one transaction | | | |
| 2.2 | All-or-nothing: a throw mid-way leaves nothing behind | | | |
| 2.3 | Isolation level chosen on purpose per flow | | | |
| 2.4 | Race conditions blocked (row locks, `FOR UPDATE`, atomic `UPDATE … WHERE`) | | | |
| 2.5 | No update based on a stale read (read-modify-write inside the lock) | | | |
| 2.6 | Key business rules also enforced in the database | | | |
| 2.7 | Deadlocks: lock order consistent; retry exists and is safe to repeat | | | |
| 2.8 | Failure injection tested (throw after step N) | | | |

Walk each flow and record the lock order, rows touched, and rollback result:

| Flow | Transaction? | Locks | Rollback tested | Note |
| --- | --- | --- | --- | --- |
| Create sales invoice | | | | |
| Create purchase invoice | | | | |
| Edit / delete invoice (cancel) | | | | |
| Returns | | | | |
| Stock update / transfer / exchange | | | | |
| Cash account movement / transfer | | | | |
| Cash exchange (currency conversion) | | | | |
| Ledger / accounting entries | | | | |
| Offline sync replay | | | | |

### PG-AUDIT-3 — Money and multi-currency (brief §6)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 3.1 | Amounts in `numeric`, never float — in DB **and** in JS math | | | |
| 3.2 | Precision/scale fit every currency (incl. high-value currencies) | | | |
| 3.3 | Every amount stored with its currency | | | |
| 3.4 | Original amount + original currency kept | | | |
| 3.5 | Rate used at create time is snapshotted | | | |
| 3.6 | Converted amount + target currency stored | | | |
| 3.7 | History never recalculated with today's rates (sync replays included) | | | |
| 3.8 | Conversion fees recorded | | | |
| 3.9 | Realized FX gain/loss | | | |
| 3.10 | Unrealized FX gain/loss (needed? when?) | | | |
| 3.11 | Entries created by a conversion are correct and auditable | | | |
| 3.12 | Balance proof: sum of ledger = account balances; debit = credit if a GL exists | | | |
| 3.13 | Corrections by reversing entries, not by editing posted rows | | | |
| 3.14 | Transfers between Cash / Online / Treasury | | | |
| 3.15 | Available funds vs electronic funds pending settlement | | | |
| 3.16 | All money writes atomic | | | |

Deliverable: a list of concrete wrong-books examples possible with today's design (input → wrong result).

### PG-AUDIT-4 — Multi-tenancy and isolation (brief §7)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 4.1 | `tenant_id` on every tenant-owned table | | | |
| 4.2 | Every query scoped (grep all raw SQL / repos / `pgFind` paths) | | | |
| 4.3 | One tenant cannot read or write another's data (test with two tenants) | | | |
| 4.4 | Relations cannot link rows of two tenants (composite FK `(tenant_id, id)`?) | | | |
| 4.5 | Row-level security: worth it as a second net? cost? (never replaces backend checks) | | | |
| 4.6 | Server enforces what the UI hides (`SEE.*`) | | | |
| 4.7 | Cron jobs and workers run per tenant and stay scoped | | | |
| 4.8 | Warehouse scope: writes need an operational warehouse; combined view never posts | | | |
| 4.9 | Entity model: Tenant / Organization / Store / Branch / Warehouse / Seller — what a marketplace needs that `tenant_id` alone cannot express | | | |

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
| 9.1 | Automatic backups | | | |
| 9.2 | Retention policy | | | |
| 9.3 | Copy stored outside the production provider | | | |
| 9.4 | Backups encrypted | | | |
| 9.5 | Who can access backups | | | |
| 9.6 | Point-in-time recovery | | | |
| 9.7 | RPO / RTO written down | | | |
| 9.8 | Real restore test done, app runs on it | | | |
| 9.9 | Recovery runbook | | | |

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
| 10.9 | Two instances cannot migrate at once (advisory lock at boot) | | | |
| 10.10 | Staging never gets unmasked production data | | | |

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
| 11.8 | Cron cannot run twice at once (multiple instances) | | | |
| 11.9 | No lost events if the API dies after commit | | | |

### PG-AUDIT-12 — Monitoring and maintenance (brief §15)

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 12.1 | Connection count watched | | | |
| 12.2 | Pool size / timeouts fit Render plan limits | | | |
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

## Done when — proven by tests

| # | Proof | How | ✓ |
| --- | --- | --- | --- |
| P1 | One tenant cannot reach another tenant's data | API + repo tests with two tenants, every resource | |
| P2 | One stock unit cannot be sold twice concurrently | Parallel sale test (`npm run stress` extended) | |
| P3 | All money flows keep the books balanced | Invariant query: ledger sum = balances (and debit = credit if a GL is added) after each flow | |
| P4 | Currency conversions create correct, auditable entries | Exchange tests with snapshot rates and fees | |
| P5 | Failure inside a transaction rolls back everything | Failure-injection test per flow | |
| P6 | Retries / resends do not duplicate | Same client id twice → one record | |
| P7 | A backup restores and the app runs on it | Restore drill on a fresh instance + smoke critical path | |
| P8 | Migrations deploy without data loss or long downtime | Migrate a production copy, time it, verify | |
| P9 | Core queries and reports are fast enough | `EXPLAIN ANALYZE` numbers on a production-sized copy | |
| P10 | A new sales channel needs no foundation rebuild | Design note: listing / reservation / channel tables fit the schema as additions | |

Note: there is no Mongo/Postgres test DB setup in CI for every case yet (see root
`CLAUDE.md`); proofs that need a real database run against a local Postgres or staging and
are written down here with the date.
