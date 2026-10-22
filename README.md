# storePlatform

## Run with Docker

Prerequisites: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2).

```bash
cp .env.example .env
# Copy Mongo/JWT/Redis/AI from services/api-store-platform/.env (same Atlas DB as npm run dev)
docker compose up --build
```

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:3000 |
| API      | http://localhost:3001 |

The frontend nginx container proxies `/api/data` to the API (same pattern as Vercel → Render). Product import, invoice extract, newsroom, and invoice settings go through that proxy, up to 45 MB.

If `BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING` in the root `.env` is still the `.env.example` placeholder, the API prints that and exits once. It does not restart. Put a real URI in `.env`, or use the isolated stack below (the overlay replaces the URI).

### Environment (Docker)

| File                               | Used by                  | Purpose                                                                           |
| ---------------------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| `.env` (repo root)                 | `docker compose` → `api` | **Same vars as** `services/api-store-platform/.env` (Atlas Mongo, JWT, Redis, AI) |
| `services/api-store-platform/.env` | `npm run dev` only       | Not read by compose — keep root `.env` in sync                                    |

The API container uses whatever `BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING` is in root `.env` — typically **Atlas**, same as local dev.

### Isolated local Mongo (optional)

No Atlas — bundled Mongo + auto-seed (CI uses this too):

```bash
cp .env.example .env   # JWT + SUPER_ADMIN_* only; overlay replaces the example Mongo URI
docker compose -f docker-compose.yml -f docker-compose.ci.yml up --build
```

Mongo on host: `mongodb://127.0.0.1:27018`

### Login

With **Atlas** (shared DB): use your normal super-admin / tenant logins — all tenants from dev.

With **isolated Mongo** (ci overlay), first start auto-seeds:

| Account     | Email                         | Password               |
| ----------- | ----------------------------- | ---------------------- |
| Super admin | `SUPER_ADMIN_EMAIL` in `.env` | `SUPER_ADMIN_PASSWORD` |
| Demo tenant | `user@app.com`                | `W123-456z`            |

Reset isolated DB only: `docker compose -f docker-compose.yml -f docker-compose.ci.yml down -v`

### Manual seed (optional)

```bash
cd services/api-store-platform
npm ci
cp .env.example .env
SUPER_ADMIN_TENANT_ID=super-admin \
SUPER_ADMIN_EMAIL=admin@example.com SUPER_ADMIN_PASSWORD=admin1234 \
npm run seed:super-admin
npm run seed:app-tenant
```

### Without Docker

```bash
cd web/store-platform-frontend && cp .env.example .env && npm ci && npm run dev
cd services/api-store-platform && cp .env.example .env && npm ci && npm run dev
```

If you previously used `src/.env`, merge into `services/api-store-platform/.env`.

How warehouse ACL, working scope, operational vs combined mode, transfers, and dashboard filtering work: `docs/reference/warehouse.md` (local; `docs/` is gitignored). UI default after login is the first accessible warehouse (operational). Combined view is an explicit multi-select.

### Warehouse scope migration

Before deploying inventory/invoice/daily-action `warehouseId` required + unique `(tenantId, warehouseId, productId)`:

```bash
cd services/api-store-platform && npm run migrate:inventory-warehouse-scope
```

Run this **before** rolling out the API that enforces required `warehouseId`.
Daily-action cash rows that cannot be matched to an invoice number stay on the oldest warehouse.

---

### TO_DO

- update the login logic that the user login one time then he has only to writ the password
- later backlog / architecture notes: `docs/` (see `docs/README.md`; gitignored)

### Hot Fix
