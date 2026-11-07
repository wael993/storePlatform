# Local docs (gitignored)

Single place for notes, tickets, and architecture drafts. Not for the remote.
Package `README.md` files stay run/scripts only.

**Ponytail:** before each implementation, read matching files under
[`architecture/`](architecture/) and [`reference/`](reference/) (start here for
the index). Treat them as constraints, not optional background.

| Folder | What goes here |
| --- | --- |
| [`backlog/`](backlog/) | Work still to do |
| [`reference/`](reference/) | How a shipped feature works |
| [`architecture/`](architecture/) | Invariants and review rules |

---

## Still open (backlog index)

| Area | File | Open work (short) |
| --- | --- | --- |
| Warehouse | [warehouse-tickets.md](backlog/warehouse-tickets.md) | WH-REL-1 migration cutover; later: WH-ARCH-7/3/9/10 (examples, rename, last price, transfer page) |
| Product / nav | [product.md](backlog/product.md) | Rename nav to Daily; unit exchange; bulk edit; optimistic UI; return/replace; import follow-ups; profit follow-ups |
| FE / offline | [later-tickets.md](backlog/later-tickets.md) | FE-NUM-1 amount parse; FE-MONEY-1 `Fee` + EU format / default-currency display; FE-OFF-1 pending outbox review; INV-SET-1 logo/QR storage; INV-NUM-1 unique invoice numbers (race) |
| Cash / FX | [cash-exchange.md](backlog/cash-exchange.md) | CASH-EX-1 API/ledger/offline; CASH-EX-2 Quick Entry tab; CASH-EX-3 Cash History (order: 1 → 2∥3) |
| Dashboard | [dashboard.md](backlog/dashboard.md) | Charts, activity, trends, DASH-029/030 move summaries, Owner dashboard, SEC-001…003 |
| Newsroom | [newsroom.md](backlog/newsroom.md) | Full Newsroom / Release Notes epic |
| Permissions | [permissions-refactor.md](backlog/permissions-refactor.md) | Session capabilities refactor (PERM-1) |
| Auth | [rate-limit.md](backlog/rate-limit.md) | AUTH-RATE-1 login rate limit (Redis, real client IP, per email) |
| Auth | [reset-pass.md](backlog/reset-pass.md) | Password reset via Superadmin |
| RIVO | [report-ai.md](backlog/report-ai.md) | RA-BUG-1…7 + future tools (detail in reference) |
| Backup | [backup.md](backlog/backup.md) | Shipped: API, web UI, Drive/Dropbox/OneDrive. Open: live test of Dropbox + OneDrive |
| Postgres | [postgres-migration.md](backlog/postgres-migration.md) | PG-MIG-0…6: ADR → schema → repos → shadow → cutover (2 active) → backup v2 → remove Mongo |

---

## Reference (shipped — read before changing)

| File | Content |
| --- | --- |
| [warehouse.md](reference/warehouse.md) | ACL, working scope, combined inventory identity, catalog Redis, transfers, migration, smoke |
| [total-profit.md](reference/total-profit.md) | Total Profit / COGS / `profitReliable` |
| [product-import.md](reference/product-import.md) | Excel product import |
| [report-ai.md](reference/report-ai.md) | RIVO: what it can / will add / bugs + how to fix |
| [cash-accounts.md](reference/cash-accounts.md) | Cash ledger, tenders, offline balances, transfers |
| [party-activity.md](reference/party-activity.md) | Party modal, FX summaries, opening balance, activity |
| [dashboard.md](reference/dashboard.md) | Tenant Dashboard shell + live overview / cash / profit |
| [web-app-update.md](reference/web-app-update.md) | Stale client after deploy (nginx + shell reload) |
| [master-data-delete.md](reference/master-data-delete.md) | Hard delete + block reasons (online) |
| [backup.md](reference/backup.md) | Tenant backup: dataVersion, queue/worker, archive format, Drive driver, restore |

## Architecture

| File | Content |
| --- | --- |
| [product-inventory-offline.md](architecture/product-inventory-offline.md) | Offline product/inventory invariants + mutation wiring |
| [implementation-guide.md](architecture/implementation-guide.md) | Impact checklist, failure scenarios, ticket template (long form of root `CLAUDE.md`) |
