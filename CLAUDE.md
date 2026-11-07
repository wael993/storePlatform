# Store Platform

Monorepo: API in `services/api-store-platform`, web app in `web/store-platform-frontend`.

## Before coding

- Read `docs/README.md`, then the matching `docs/reference/*` and `docs/architecture/*`.
  They are rules, not background. Ticket specs live in `docs/backlog/`.
- Larger features: also `docs/architecture/implementation-guide.md`.
- New feature: clone the closest shipped sibling (Transfer → Exchange). No second stack.

## Commands (done = all green)

- API (`services/api-store-platform`): `npm run typecheck` · `npm run lint:ci` · `npm test`
- Web (`web/store-platform-frontend`): `npm run typecheck` · `npm run lint:ci` ·
  `npm test` · `node scripts/checkTranslations.mjs`
- Newer-Node vs jsdom test gaps are patched in `web/store-platform-frontend/src/test/jsdomNodeCompat.ts`.

## Hard rules

- Every query is tenant-scoped (`withTenantScope`). Server enforces what the UI hides (`SEE.*`).
- Writes need an operational warehouse (`requireOperationalWarehouseId`); combined view never posts.
- Money: cash posts in the currency handed over; convert only via `currencyDisplay` /
  `store-domain` helpers. No private FX, cost, or quantity math.
- Snapshot rates/amounts at create. Sync replays never recalculate; live requests check today's settings.
- Retryable writes carry a client id minted once per form, not per click.
  A duplicate key inside a Mongo transaction aborts it: look up the existing record before starting.
- Multi-document writes use one transaction; that needs a replica set
  (Atlas and `docker-compose.ci.yml` both are).
- Offline-capable mutation = outbox entity + `isOfflineCapableEndpoint` + sync replay branch
  + local snapshot update + `outboxIdempotencyKey` identity.
- New UI text: en, ar, de.
- Shipped behavior change: update `docs/reference/*` and `documentation/openapi.yaml`.

## Known gaps

- No Mongo test setup: transactions and idempotency are checked by hand.
