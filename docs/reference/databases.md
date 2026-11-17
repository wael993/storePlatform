# Databases

Three Postgres databases, each with one job. Production Postgres comes with PG-MIG-4.

| Database | Where | Used by | URL |
| --- | --- | --- | --- |
| Local | Docker `store-local-pg`, port 5434, volume `store-local-pgdata` | `npm run dev` | `DATABASE_URL` in `services/api-store-platform/.env` |
| Test | Docker `store-test-pg`, port 5433 | `npm test` (`*.pg.test.ts`), `npm run stress:local` | `TEST_DATABASE_URL` (shell, e.g. `~/.zshrc`) |
| Staging | Render (Frankfurt) | staging API, production-copy rehearsal | `STAGING_DATABASE_URL` in `.env` (never `DATABASE_URL`) |

Tests ignore `.env`'s `DATABASE_URL` (`src/test/setup.ts`), so they can never reach staging.

## Set up the local and test databases (once)

```bash
docker run -d --name store-local-pg --restart unless-stopped -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=store_platform -v store-local-pgdata:/var/lib/postgresql -p 127.0.0.1:5434:5432 postgres:18
docker run -d --name store-test-pg --restart unless-stopped -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=store_platform -p 127.0.0.1:5433:5432 postgres:18

cd services/api-store-platform
npm run db:migrate                                                       # local (.env)
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/store_platform npm run db:migrate   # test
npm run build && node -r dotenv/config dist/scripts/seed-if-empty.js     # local: super admin + demo tenant
```

Demo tenant login: `user@app.com` / `W123-456z`. Super admin: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from `.env`.

## Keep them current

- `drizzle/` changed (pull, branch switch, `db:generate`) → run both `db:migrate` lines again.
- Reset one: `docker rm -f store-test-pg` (or `store-local-pg` + `docker volume rm store-local-pgdata`), then set up again.

## Copy a production tenant

Production Mongo is only read. The tenant's rows in the target are replaced in one transaction.

```bash
cd services/api-store-platform
PROD_MONGO_URL='mongodb+srv://user:pass@…' PROD_MONGO_DB='<db name>' \
  sh scripts/copy-prod-tenant.sh local <tenantId>      # then: staging <tenantId>
```

- `local` also copies global data (roles, newsroom, payment settings); `staging` copies the tenant only
  and asks you to type the tenant id to confirm.
- The URL must contain the user and password (the script does not use `.env`'s Mongo credentials).
- Stops with "Mongo fields with no Postgres column" or "documents that cannot be loaded": that is a
  PG-MIG-3 finding, not a setup error — do not add `--allow-unmapped` without a decision.
- Real customer data on staging (GDPR): delete it again after the rehearsal.

## Stress

- Local, no staging touched: `npm run stress:local` (API on :3002 against the test database).
- Staging, after a deploy: `STRESS_BASE=https://storeplatform-1.onrender.com STRESS_EMAIL=… STRESS_PASSWORD=… npm run stress`.
