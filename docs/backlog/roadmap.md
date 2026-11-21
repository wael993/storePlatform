# Roadmap — after the Postgres switch

Production runs on Postgres since 2026-11-20 (one window, all tenants). Rollback to Mongo is
possible until 2026-12-04; after that, Mongo goes. Test checklist:
[smoke-test-plan.md](smoke-test-plan.md); open audit items: [postgres-audit.md](postgres-audit.md).

**Order:** close the switch (watch, clean up, remove Mongo) → restructure → clean code.
Restructuring before Mongo is gone means moving code that is about to be deleted.

| # | Phase | Ticket | Depends on |
| --- | --- | --- | --- |
| 1 | After-window tasks | PG-MIG-4-AFTER | — |
| 2 | Finish smoke test | QA-SMOKE-1 | — |
| 3 | Tenant backup on real providers | BACKUP-LIVE-1 | — |
| 4 | Remove Mongo | PG-MIG-6 | 1 + 2026-12-04 passed with no rollback |
| 5 | Project structure for growth | ARCH-STRUCT-1 | 4 |
| 6 | Simplify the code | CODE-CLEAN-1 | 5 (per module, as it moves) |

Rules: every bug found gets a fix **and** a test that fails without the fix. Phases 5–6 move
module by module, each shipped and smoke-tested before the next.

---

## PG-MIG-4-AFTER — Close the switch

- Delete the production copies from staging (GDPR; audit 10.10).
- Retest smoke 2.5 on production (S-4, log out of all devices).
- Watch Render logs daily until 2026-12-04 for `23505`, `40P01`, timeouts; watch DB CPU / RAM.
- Audit 9.3 / 9.8: copy outside Render (check `scripts/backup-db.sh`) + one real restore test.

## QA-SMOKE-1 — Finish the smoke test

Finish the unticked rows in [smoke-test-plan.md](smoke-test-plan.md). Later: automate the critical path (Playwright).

## BACKUP-LIVE-1 — Tenant backup against real accounts

Shipped on Postgres (`reference/backup.md`), tested locally only. Run backup + restore on
staging against real Google Drive / Dropbox / OneDrive accounts, then your own all-tenant copy.

## PG-MIG-6 — Remove MongoDB

1. Remove Mongoose models (`src/models/*`), `shared/mongodb/*`, dead `withTenantScope`
   branches, Mongo-only scripts (`seed-roles`, `init-collections`, `drop-stale-indexes`).
   Model names are still used as keys in `PG_MODELS` (`db/ownership.ts`): replace, don't break.
2. `src/config/config.ts` stops requiring `BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING`.
3. Drop `mongoose` from `package.json`; CI (`mongoQuery.pg.test.ts`, `MONGO_TEST_URL`) and
   `docker-compose.ci.yml` stop starting Mongo.
4. Remove the `tenants.dataStore` mongo option.
5. Ops: archive / delete the frozen Mongo cluster.

**Done when:** API typecheck, lint, tests green without mongoose; API boots without a Mongo URI.

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

## Open point

The owner's list had one more line, cut off: _"we need to update the code so …"_.
Fill in here and turn it into a ticket.
