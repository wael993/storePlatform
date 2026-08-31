# storePlatform

## Run with Docker

Prerequisites: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2).

```bash
cp .env.example .env
# Copy Mongo/JWT/Redis/AI from services/api-store-platform/.env (same Atlas DB as npm run dev)
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |

The frontend nginx container proxies `/api/data` to the API (same pattern as Vercel → Render).

### Environment (Docker)

| File | Used by | Purpose |
|------|---------|---------|
| `.env` (repo root) | `docker compose` → `api` | **Same vars as** `services/api-store-platform/.env` (Atlas Mongo, JWT, Redis, AI) |
| `services/api-store-platform/.env` | `npm run dev` only | Not read by compose — keep root `.env` in sync |

The API container uses whatever `BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING` is in root `.env` — typically **Atlas**, same as local dev.

### Isolated local Mongo (optional)

No Atlas — bundled Mongo + auto-seed (CI uses this too):

```bash
cp .env.example .env   # JWT + SUPER_ADMIN_* only; Mongo URI comes from overlay
docker compose -f docker-compose.yml -f docker-compose.ci.yml up --build
```

Mongo on host: `mongodb://127.0.0.1:27018`

### Login

With **Atlas** (shared DB): use your normal super-admin / tenant logins — all tenants from dev.

With **isolated Mongo** (ci overlay), first start auto-seeds:

| Account | Email | Password |
|---------|-------|----------|
| Super admin | `SUPER_ADMIN_EMAIL` in `.env` | `SUPER_ADMIN_PASSWORD` |
| Demo tenant | `user@app.com` | `W123-456z` |

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

---

### TO_DO

- update the login logic that the user login one time then he has only to writ the password
- user get popup about new updates (releases) (by click on 'understand' not show again)
- user can bulk update in product table
- use Optimistic
