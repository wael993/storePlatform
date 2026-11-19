# Roadmap — after the Postgres switch

What comes next, in order, and when each part counts as done. Detail for the Postgres
steps lives in [postgres-migration.md](postgres-migration.md); the full test checklist in
[smoke-test-plan.md](smoke-test-plan.md); the Postgres audit and the smoke-test fix list in
[postgres-audit.md](postgres-audit.md) (part of phase 3; its Part A blocks PG-MIG-3).

**Why this order:** first make the database switch safe (test, review, rehearse, switch),
then delete the old Mongo code (less code to restructure), then restructure, then clean
up the code, then rewrite the docs to match. Restructuring before the switch would mix two
big changes in one release and make a rollback impossible to reason about.

| # | Phase | Ticket | Depends on |
| --- | --- | --- | --- |
| 1 | Test the new database on staging | QA-STAGING-1 | — |
| 2 | Full smoke test from zero | QA-SMOKE-1 | — (runs in 1, again in 4 and 5) |
| 3 | Hard review per flow | QA-REVIEW-1 | 1 |
| 4 | Rehearsal on a production copy | PG-MIG-3 | 1, 2, 3 |
| 5 | Switch production to Postgres | PG-MIG-4 | 4 says go |
| 6 | Remove Mongo | PG-MIG-6 | 5 + rollback window over |
| 7 | Project structure for growth | ARCH-STRUCT-1 | 6 |
| 8 | Simplify the code | CODE-CLEAN-1 | 7 (per module, as it moves) |
| 9 | Comments + docs to current state | DOCS-1 | 8 (per module) |
| 10 | _Open point from the owner: "we need to update the code so …"_ | TBD | — |

Rules for the whole roadmap:

- Production is not touched before PG-MIG-4. `main` stays frozen for API changes until then.
- Every bug found gets a fix **and** a test that fails without the fix.
- One phase at a time on the risky path (1 → 5). Phases 7–9 move module by module, each
  module shipped and smoke-tested before the next one starts.

---

## QA-STAGING-1 — Use staging as the real shop (about 1 week)

**Goal:** find what tests cannot: real habits, real data, real screens.

- Use staging for daily work: sell, buy, transfer, return, offline selling + sync, import,
  every role (owner, admin, cashier, employee).
- Read the Render logs daily for Postgres errors (`23505`, `40P01`, timeouts, `Failed query`).
- Run `npm run stress` against staging after big days (see `src/scripts/stress.ts`).
- At the end: database checks on staging (cash = ledger, no orphan stock movements,
  no duplicate names/aliases).

**Done when:** one week of use with no open bug, stress green, database checks clean.

## QA-SMOKE-1 — Smoke test from zero to everything

**Goal:** one checklist that walks the whole app, from an empty tenant to every feature,
so nothing is forgotten. See [smoke-test-plan.md](smoke-test-plan.md).

- Run it fully on staging (now), on the production copy (PG-MIG-3) and right after the
  switch (PG-MIG-4, shortened "critical path" version).
- Later: automate the critical path as browser tests (Playwright) so it runs on every deploy.

**Done when:** every row is ticked on staging, failures have a ticket.

## QA-REVIEW-1 — Hard review per process, group and flow

**Goal:** a reviewer reads each flow end to end — screen → API → database → back — and
compares it with the old Mongo code, without the author's conclusions.

Review units (one review each, smallest first):

| Group | Flows to review end to end |
| --- | --- |
| Money | sale (cash, card, credit, multi-currency, partial), buy, edit, delete, cash transfer, cash exchange, opening balances, daily actions, expenses |
| Stock | opening stock, purchase, sale, edit, delete, warehouse transfer (+ delete), oversell, average cost |
| Offline | outbox, sync push / replay, number blocks, local snapshots, conflict on reconnect |
| Catalog | products (create, edit, bulk edit, barcode, delete blocks), import wizard, categories, brands, units, shelves, warehouses, currencies |
| Parties | customers, suppliers, partners, projects, employees (salaries, payouts) |
| Settings | invoice settings, label templates, user settings, role permissions (SEE), notifications, reports / RIVO |
| Platform | login, refresh, logout, change password, users, tenants, subscriptions, newsroom, crons |

For every flow the reviewer answers the same questions:

1. **Correct:** same result as before for normal, empty, zero, last-item and edited inputs?
2. **Money exact:** no float math where exact numeric was meant, rounding unchanged?
3. **Atomic:** all writes of one action in one transaction? Row locked before read-modify-write?
4. **Parallel:** what happens with two requests at once (double click, two tabs, two cashiers)?
5. **Retry:** what happens when the same request comes twice (offline replay, client id)?
6. **Tenant + permission:** tenant filter on every query, server checks what the UI hides?
7. **Tested:** is there a test that fails when this flow breaks?

**Done when:** every unit reviewed, findings fixed with tests or written down as tickets.

## PG-MIG-3 / PG-MIG-4 / PG-MIG-6

See [postgres-migration.md](postgres-migration.md). Short version: PG-MIG-3 runs the
existing tools on a production copy (no new feature code, small ETL fixes if production
data has shapes dev data did not have); PG-MIG-4 is operations only (freeze, final load,
checks, switch `DATABASE_URL`, smoke, reopen) plus a written runbook and the rollback rule;
PG-MIG-6 deletes Mongo code (keep Mongoose as validation-only library unless there is a
reason to replace it).

## ARCH-STRUCT-1 — Project structure that can grow

**Goal:** a new developer finds any feature in one place, and a new feature (marketplace,
webshop, SAP, omnichannel) is added as a new module, not by growing a big file.

Today (API): `apis/api.controller.ts` has ~6,900 lines and `apis/api.routes.ts` ~1,900;
logic is split between `apis/*`, `shared/*` (40+ files of mixed purpose) and `db/*`.
Web: `api/apiStore.ts` ~3,000 lines, `offline/localHandlers.ts` ~2,700, several screens
over 1,400 lines.

Target (API), one folder per business area:

```
src/
  modules/
    sales/        routes.ts  controller.ts  service.ts  repository.ts  types.ts  *.test.ts
    purchasing/
    inventory/
    cash/
    catalog/
    parties/
    settings/
    platform/     (auth, tenants, users, subscriptions)
    newsroom/
    sync/
  db/             client, transactions, schema, migrations
  shared/         only truly shared helpers (errors, logger, money, dates)
```

Layer rules, one direction only: **routes** (HTTP in/out, validation) → **controller**
(permissions, request context) → **service** (business rules, transaction boundary) →
**repository** (SQL only). Modules talk to each other through services, never through
another module's repository.

Web, same idea: `features/<area>/` holding its screens, API calls, offline handlers and
tests; `apiStore.ts` and `localHandlers.ts` split per area.

Steps:

1. Write the target structure + layer rules into `docs/architecture/` (ADR).
2. Move one small module first (newsroom) to prove the pattern; then one per release,
   biggest risk last (sales, cash, sync).
3. Each move is a pure move + import fix: no behavior change, tests and `api:diff` equal.

**Done when:** no file over ~800 lines, `api.controller.ts` gone, every module follows the
layer rules (checked by an import-boundary lint rule).

## CODE-CLEAN-1 — Simple code any developer can change

**Goal:** a junior developer can read a flow and change it safely; a senior can review it fast.

Rules (added to `CLAUDE.md` / implementation guide):

- One function = one job, named after what it does; no function over ~60 lines.
- No duplicated logic: one helper per rule (money, stock, currency, permissions).
- No dead code, no commented-out code, no unused options.
- Errors: one error type per kind, clear message, never swallowed.
- Types: no `any` in new code; shared request/response types between API and web.

Steps per module (done together with its ARCH-STRUCT-1 move):

1. Delete dead code (Mongo branches, unused helpers, old scripts).
2. Split long functions by job; merge near-copies.
3. Add the missing tests for the module's risky paths before changing them.

**Done when:** every module passes the rules above, coverage of risky paths has a test each.

## DOCS-1 — Comments and docs that match the code

**Goal:** the docs describe the code as it is, and every non-obvious function says why it
exists.

Code comments:

- Every exported function / class: one-line summary of what it does and when to use it
  (JSDoc), plus the "why" when the code cannot show it (e.g. why a lock, why an order).
- No comments that repeat the code. Business rules link to their `docs/reference` page.

Docs refresh:

- `docs/README.md`: still says "Local docs (gitignored)" — docs are tracked now; fix and
  re-index.
- `docs/reference/*`: re-check each page against the code after its module moved; remove
  Mongo wording (`$set`, collections, `__v`, 11000).
- `docs/architecture/implementation-guide.md` and root `CLAUDE.md`: new layer map, Postgres
  rules (transactions, row locks, `ALL_TENANTS`, `isUniqueViolation`), test commands.
- New: `docs/onboarding.md` — how to run, test, and ship a change in the first day.
- `documentation/openapi.yaml`: check every endpoint against the routes.

**Done when:** a new developer sets up, finds a flow and ships a small change using only the
docs; no page mentions code that no longer exists.

## Open point

The owner's list had one more line, cut off: _"we need to update the code so …"_.
Fill in here and turn it into a ticket.
