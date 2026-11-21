# Docs

Tracked in git. Package `README.md` files stay run/scripts only.

Before each implementation, read the matching files under [`architecture/`](architecture/) and
[`reference/`](reference/). They are constraints, not background.

| Folder | What goes here |
| --- | --- |
| [`backlog/`](backlog/) | Work still to do. Delete a ticket once shipped (git keeps the history). |
| [`reference/`](reference/) | How a shipped feature works |
| [`architecture/`](architecture/) | Invariants and review rules |
| [`elearning/`](elearning/) | End-user operating guide, **Arabic**, one file per section (source for the PDFs) |

---

## Backlog (still open)

| Area | File | Open work (short) |
| --- | --- | --- |
| Roadmap | [roadmap.md](backlog/roadmap.md) | Close the Postgres switch → remove Mongo (after 2026-12-04) → structure → clean code |
| Postgres | [postgres-audit.md](backlog/postgres-audit.md) | Smoke findings S-1/5/7/8 + S-4 retest (row 2.5); Part B checks (indexes, security, backup 9.3/9.8, monitoring); proofs P1, P3–P10 |
| QA | [smoke-test-plan.md](backlog/smoke-test-plan.md) | Smoke test from zero (★ = critical path) |
| eLearning | [elearning-onboarding.md](backlog/elearning-onboarding.md) | EL-1 Welcome-page card linking to the PDF folder |
| Warehouse | [warehouse-tickets.md](backlog/warehouse-tickets.md) | Polish only: WH-ARCH-1/3/7/9/10 |
| Product / nav | [product.md](backlog/product.md) | Daily rename, unit exchange, optimistic UI, return/replace, import + profit follow-ups |
| FE / offline | [later-tickets.md](backlog/later-tickets.md) | FE-NUM-1, FE-MONEY-1, FE-OFF-1, INV-SET-1, PROD-BARCODE-1 |
| Dashboard | [dashboard.md](backlog/dashboard.md) | RIVO nav rename, charts, activity, trends, DASH-030, Owner dashboard, SEC-001…003 |
| RIVO | [reference/report-ai.md](reference/report-ai.md) | RA-BUG-1…7 + build-next list (kept in the reference) |
| Permissions | [permissions-refactor.md](backlog/permissions-refactor.md) | PERM-1 session capabilities |
| Auth | [rate-limit.md](backlog/rate-limit.md) | AUTH-RATE-1 login rate limit (Redis, real client IP) |
| Auth | [reset-pass.md](backlog/reset-pass.md) | Password reset via Superadmin |
| Demo | [demo-tenant.md](backlog/demo-tenant.md) | Self-service demo tenants (not started; spec predates Postgres) |

## Reference (shipped — read before changing)

| File | Content |
| --- | --- |
| [databases.md](reference/databases.md) | Local / test / staging databases, migrations, stress |
| [warehouse.md](reference/warehouse.md) | ACL, working scope, combined inventory, catalog Redis, transfers, smoke |
| [total-profit.md](reference/total-profit.md) | Total Profit / COGS / `profitReliable` / WAC |
| [cash-accounts.md](reference/cash-accounts.md) | Cash ledger, tenders, offline balances, transfers, exchange |
| [party-activity.md](reference/party-activity.md) | Party modal, FX summaries, opening balance, activity |
| [dashboard.md](reference/dashboard.md) | Tenant Dashboard shell + live KPIs |
| [product-import.md](reference/product-import.md) | Excel product import |
| [report-ai.md](reference/report-ai.md) | RIVO: what it can / will add / bugs + how to fix |
| [master-data-delete.md](reference/master-data-delete.md) | Hard delete + block reasons (online) |
| [backup.md](reference/backup.md) | Tenant backup: dataVersion, queue/worker, archive v2, drivers, restore |
| [web-app-update.md](reference/web-app-update.md) | Stale client after deploy (nginx + shell reload) |

## Architecture

| File | Content |
| --- | --- |
| [implementation-guide.md](architecture/implementation-guide.md) | Impact checklist, failure scenarios, ticket template (long form of root `CLAUDE.md`) |
| [product-inventory-offline.md](architecture/product-inventory-offline.md) | Offline product/inventory invariants + mutation wiring |
| [postgres-migration.md](architecture/postgres-migration.md) | ADR Mongo → Postgres (done 2026-11-20): why the schema looks the way it does |
