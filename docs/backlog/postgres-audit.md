# PostgreSQL audit — PG-AUDIT

Open part of the Postgres audit. Part A (PG-AUDIT-0…4) and its report were done before the
switch (2026-11-17, commits `8fd71e4` `d90b3ea` `1413643` `c02cc7e` `7eb0f20`) and removed
from this file; see git history. Smoke rows: [smoke-test-plan.md](smoke-test-plan.md).

**Goal:** Postgres is reliable, secure, keeps the books balanced, and can carry the ERP plus
a later marketplace / webshop / omnichannel without a redesign. Improve step by step inside
the modular monolith. No rewrite, no microservices, no new stack without a written reason.

## Working rules

1. **No changes before approval.** Fill the checklist → owner approves the fix → fix.
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

None of these came from the Postgres migration. Fixed rows (S-2, S-3, S-6) removed.

| # | Smoke row | What happened / what is wrong | Type (bug / missing / UX) | Priority | Fix state |
| --- | --- | --- | --- | --- | --- |
| S-4 | 2.5 | Log out of all devices: other browser stays logged in. Likely cause: `logoutAll` deletes refresh tokens but does not bump `tokenVersion` (change password does), so the 15-min access token keeps working | bug (security) | High | fixed 2026-11-17: `logoutAll` bumps `tokenVersion` with the token delete in one transaction (`group4Writes.pg.test.ts`); retest smoke 2.5 after deploy |
| S-1 | 1.3 | Allowed pages / offline toggle only apply after logout + login, not after reload; dashboard cannot be removed (confirm intended) | bug / UX | Low | later |
| S-5 | 3.1 | Same currency twice: not stored, but request is a fetch instead of a POST and no error is shown | bug / UX | Low | later |
| S-7 | 6.9 | Daily actions: edit (`QuickEntryModal`) and delete (invoice list, party activity) exist — retest from there. Expenses: edit/delete exist in the API only, no screen uses them | retest / missing UI | Medium | later: expense edit / delete screens to be added in the frontend |
| S-8 | 8.1 | Refuse a selling invoice when any item has no retail price | missing | Low | roadmap |

---

## Part B — after the switch, before marketplace work

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

Tenant backup runs on Postgres (`reference/backup.md`); this section rates the whole-database backup.

| # | Check | Status | Priority | Evidence / note |
| --- | --- | --- | --- | --- |
| 9.1 | Automatic backups | ✅ | — | Render Point-in-Time Recovery on `store-platform-prod-db` ($6 plan, owner 2026-11-18). |
| 9.2 | Retention policy | ⚠️ | High | Only **3 days** back. A problem found on day 4 cannot be undone. Fix: 9.3. |
| 9.3 | Copy stored outside the production provider | ❌ | High | None. Fix: daily `pg_dump` to storage outside Render, kept longer than 3 days. Start in the first days after PG-MIG-4. |
| 9.4 | Backups encrypted | 🔍 | | |
| 9.5 | Who can access backups | 🔍 | | |
| 9.6 | Point-in-time recovery | ⚠️ | Medium | Yes, but **whole database only**: the restore creates a new database at a chosen time (🔍 confirm it never overwrites the live one). Per-tenant restore exists via the tenant backup feature (`reference/backup.md`, Postgres, format v2). |
| 9.7 | RPO / RTO written down | | | |
| 9.8 | Real restore test done, app runs on it | ❌ | High | Never done. Fix: restore to a new database, start staging against it, smoke, delete it (P7). In the first days after the switch. |
| 9.9 | Recovery runbook | | | |

**Mongo is not a backup.** Since the switch (2026-11-20) only Postgres receives writes; rolling back to Mongo (possible until 2026-12-04) loses every write since. Check whether `scripts/backup-db.sh` covers 9.3.

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
| 10.10 | Staging never gets unmasked production data | ❌ | Medium | The G6b dry run loaded all 12 production tenants unmasked into staging Fix: delete the copies ([roadmap.md](roadmap.md) PG-MIG-4-AFTER, GDPR); later rehearsals use the same delete step. |

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

## Still open from the Part A report

- **M1 Currency rounding.** Decimals setting per currency (default 2); round invoice totals and
  posted cash to it. 268 ledger rows already have > 2 decimals. New column + rounding in
  `packages/store-domain/src/invoiceTotals.ts` / `shared/cashAccounts/ledgerService.ts`; old rows unchanged.
- **M2 Database constraints.** NOT NULL on the filled key columns; CHECK prices ≥ 0, rates > 0,
  line quantities > 0; composite FKs `(tenant_id, business id)`. Migrations in `drizzle/`; run on
  a production copy first.
- **Invoice-number lock scan (PG-AUDIT-6).** `latestInvoiceSequence` (`db/repos/invoices.ts`) reads
  every number of the tenant while holding the lock. Move max/parse into SQL before tenants reach
  tens of thousands of invoices.

---

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

Proofs that need a real database run against a local Postgres or staging and are written down
here with the date.

