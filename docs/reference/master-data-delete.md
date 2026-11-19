# Master-data delete

Hard delete for unused product, customer, supplier, partner, category (and
related settings entities). Server is authoritative. Confirm buttons stay
usable online only.

Code: `services/api-store-platform/src/shared/deleteBlock.ts`,
`findProductDeleteBlocks` in `shared/productImport/service.ts`, per-entity
`find*DeleteBlocks` in controllers, FE `web/.../shared/deleteBlock.ts`
(`useMasterDelete` / `useMasterBulkDelete`).

---

## Policy

| Rule | Behaviour |
| --- | --- |
| Unused | Hard delete allowed |
| Referenced | Blocked; row unchanged |
| Bulk | Partial success `{ deleted, blocked }` |
| Offline | Delete disabled in UI (`deleteBlock.offline`); no Dexie delete for master data from the confirm path |
| Server | Revalidate every DELETE (REST and sync where wired) |

Do not invent soft-delete / `deletedAt` for these masters.

---

## Block reasons

API list/detail rows carry `isDeletable` and `deleteBlockReason`. FE maps codes
to i18n `deleteBlock.*`.

| Code | Meaning (examples) |
| --- | --- |
| `invoice` / `buyingInvoice` | Selling or buying invoice reference |
| `dailyAction` | Daily action / cash entry reference |
| `stockMoving` / `project` / `products` | Stock or product links |
| `cashLedger` / `employee` / `primaryCurrency` | Cash or settings refs |
| `offline` | FE-only: no network |

Product guards include invoices, buying invoices, stock movings, and
`DailyAction.productId`. Customer / supplier guards include invoices and daily
actions. Expense catalog delete is blocked when a daily action references the
expense.

---

## UI

`useMasterDelete` / `useMasterBulkDelete`:

- Offline → button disabled, offline tooltip.
- Online and `isDeletable !== true` → disabled with the block reason.
- Partner delete was already enabled; product / customer / supplier / category
  use the same helpers.

---

## Outbox

Outbox status remains `pending | processing | failed | completed`. There is no
`restore_pending` / rejected-delete recovery machine: master delete is not
offered offline, so a rejected offline delete cannot orphan a local row through
this path.
