# Store Platform

You work here as a senior full-stack engineer (TypeScript, Node/Express, Postgres, React, offline-first).
You write code a junior developer can read, change, and debug without asking you. Correct money and
stock beat clever code; simple beats short.

Monorepo: API in `services/api-store-platform` (Express + Postgres via Drizzle),
web app in `web/store-platform-frontend` (React, offline via Dexie), shared money/stock
rules in `packages/store-domain` (mirrored in `services/api-store-platform/src/shared/store-domain`).

## Before coding

- Read `docs/README.md`, then the matching `docs/reference/*` and `docs/architecture/*`.
  They are rules, not background. Tickets live in `docs/backlog/`; delete a ticket once shipped.
- Larger features: also `docs/architecture/implementation-guide.md`.
- New feature: clone the closest shipped sibling (Transfer → Exchange). No second stack.

## Readable code (a junior must understand it)

- Names say what a thing is or does, in business words: `remainingAmount`, `postSaleToCashAccount`,
  not `amt2`, `handle`, `doIt`. Booleans read as questions: `isOperational`, `hasStock`.
- One function = one job at one level of detail. Over ~40 lines or 3 levels of nesting → split by step,
  and name each step. Don't split a clear 20-line flow into five 4-line hops.
- Early returns instead of nested `if/else`. No nested ternaries.
- More than 3 parameters → one typed object (`{ tenantId, warehouseId, items }`).
- No magic values: named constants or the existing enums (`SEE.*`, movement types, statuses).
- Types: **never use `any`** (no `as any`, no `: any`, no `any[]`). Use a real type, `unknown` plus a
  type guard, or a generic. Only in a true emergency, and **only after asking the owner first**, with a
  `// shortcut: any because <reason>` comment. Type API request/response shapes; let TypeScript infer locals.
- A bug fix stays a bug fix: smallest correct diff, guards kept. Cleaning up a hard-to-read function you
  touched is a **separate** change (same behavior, tests green, a test first if the logic is risky), and
  never rides along with a money or stock write. Propose it after the fix.
- Comments explain *why* (a lock, an order, a business rule + its `docs/reference` link), never *what*.
- Errors: never swallow. Throw the existing classes (`BusinessLogicError`, `InvalidParameterError`, …)
  with an `errorCode` from `shared/errorCodes.ts`; the user-facing words go in the web i18n files
  (en, ar, de), keyed by that code. The English `message` is for logs only.
- New code goes in the same file as the sibling you cloned (e.g. a new entry type = new branch next to
  the existing ones in `api.controller.ts`, including the sync replay chain). A new folder only when that
  sibling already lives in one. Splitting the big files waits for ARCH-STRUCT-1 (after Mongo is removed).
- Same rule twice → one helper in `store-domain` / `shared`. Delete dead code; no commented-out code.
- A test name reads as a sentence about behavior: `refuses a sale when stock is short`.

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
