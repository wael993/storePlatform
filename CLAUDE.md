# Store Platform

Monorepo: API in `services/api-store-platform` (Express + Postgres via Drizzle),
web app in `web/store-platform-frontend` (React, offline via Dexie), shared money/stock
rules in `packages/store-domain` (mirrored in `services/api-store-platform/src/shared/store-domain`).

## Before coding

- Read `docs/README.md`, then the matching `docs/reference/*` and `docs/architecture/*`.
  They are rules, not background. Tickets live in `docs/backlog/`; delete a ticket once shipped.
- Larger features: also `docs/architecture/implementation-guide.md`.
- New feature: clone the closest shipped sibling (Transfer → Exchange). No second stack.

## Commands (done = all green)

- API (`services/api-store-platform`): `npm run typecheck` · `npm run lint:ci` · `npm test`
  - `*.pg.test.ts` run only with `TEST_DATABASE_URL` (local / CI Postgres, never staging);
    without it they skip. `.env`'s `DATABASE_URL` is ignored by tests (`src/test/setup.ts`).
- Web (`web/store-platform-frontend`): `npm run typecheck` · `npm run lint:ci` ·
  `npm test` · `node scripts/checkTranslations.mjs`
- Databases (local :5434, test :5433, staging), remote migrations, stress: `docs/reference/databases.md`.
- Newer-Node vs jsdom test gaps are patched in `web/store-platform-frontend/src/test/jsdomNodeCompat.ts`.

## Hard rules

- Every query is tenant-scoped (`requireTenantId` / `tenantWhere` in `src/db`; `ALL_TENANTS`
  only for deliberate platform reads). Server enforces what the UI hides (`SEE.*`).
- Writes need an operational warehouse (`requireOperationalWarehouseId`); combined view never posts.
- Money: cash posts in the currency handed over; convert only via `currencyDisplay` /
  `store-domain` helpers. No private FX, cost, or quantity math. Amounts are `numeric` (strings), never float columns.
- Snapshot rates/amounts at create. Sync replays never recalculate; live requests check today's settings.
- Multi-row writes run in one `inTransaction()` (`src/db/index.ts`); lock rows before read-modify-write.
- Retryable writes carry a client id minted once per form, not per click.
  A unique violation (`23505`) aborts the whole transaction: look up the existing record before starting.
- Offline-capable mutation = outbox entity + `isOfflineCapableEndpoint` + sync replay branch
  + local snapshot update + `outboxIdempotencyKey` identity.
- New UI text: en, ar, de.
- Shipped behavior change: update `docs/reference/*` and `documentation/openapi.yaml`;
  user-visible change: also the matching `docs/elearning/*` file (Arabic).

## Known gaps

- Production on Postgres since 2026-11-20. Mongo code (`src/models`, `src/shared/mongodb`,
  `mongoose`) is dead but still present until PG-MIG-6 (after 2026-12-04); `config.ts` still
  requires a Mongo URI. Don't add new code on it.
- Concurrency end to end: `npm run stress` against staging.
