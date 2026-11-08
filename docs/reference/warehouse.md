# Warehouse scope

This document describes how multi-warehouse works in store-platform: the business rules, the data model, and how the API and frontend enforce them.

A warehouse is a stock location inside one tenant. Products are shared across the tenant. Stock, invoices, daily entries, and transfers belong to exactly one warehouse.

---

## Two layers: ACL vs working scope

These are easy to mix up. They are not the same thing.

| Layer | What it is | Who sets it | Stored where |
| --- | --- | --- | --- |
| **ACL** | Warehouses the user is allowed to see or use | Owner, when inviting or editing a user | `User.warehouseIds` |
| **Working scope** | Warehouses the user is looking at right now | The user, in the TopBar picker | Browser memory + `localStorage`, sent as `x-warehouse-scope` |

- ACL answers: “may this person touch warehouse B at all?”
- Working scope answers: “which warehouse(s) is this request about?”

The picker can only offer warehouses from the ACL. The API never trusts the header as an ACL: it intersects the requested ids with the server-side user record.

---

## Modes

The number of selected warehouses decides the mode. The backend enforces this; the UI only mirrors it.

### Operational mode — exactly one warehouse selected

- Lists, search, and dashboard show that warehouse only.
- Selling invoices, buying invoices, and daily entries must use that `warehouseId`.
- Stock changes (create product with qty, inventory adjust, purchase, sale, transfer out) must use that warehouse.
- Warehouse transfer is allowed. Source is always this warehouse. Destination can be any other warehouse the user has ACL access to (even if it is not in the current working scope).

### Combined / management mode — two or more warehouses selected

- Lists and dashboard show the **combined** result of the selected warehouses.
- Viewing, searching, editing, and deleting existing records is allowed when the user’s permissions and the record status allow it.
- Posting a selling or buying invoice is **blocked**.
- Stock-changing operations are **blocked**.
- Creating a warehouse transfer is **blocked** (source must be the operational warehouse).

### No selection / empty scope

- A non-owner with no `warehouseIds` has no access: lists are empty and writes fail.
- An owner or `super_admin` with no `x-warehouse-scope` header is unrestricted on **reads** (all tenant warehouses). Writes still require exactly one selected warehouse.

The UI defaults a user to the first accessible warehouse so they land in operational mode. Combined view is an explicit multi-select.

---

## Who can access which warehouses

| Role | ACL |
| --- | --- |
| `owner` | Unrestricted. `User.warehouseIds` is ignored. |
| `super_admin` | Same as owner. |
| Any other role (`admin`, `cashier`, …) | Only `User.warehouseIds`. Missing or empty = no warehouse access. |

Only an **owner** can assign `warehouseIds` on an existing user.

Invite rules:

- Owner (or unrestricted role) inviting a non-owner: invitee gets every warehouse in the tenant. Owner can revoke later.
- Restricted user with invite permission: invitee gets **only the inviter’s ACL**. They cannot mint a user who can see more warehouses than they can.

A user cannot select or read a warehouse that is not in their ACL. Deleting or revoking a warehouse they had selected does not crash the API: the header is intersected with the ACL, and unauthorized ids are dropped.

---

## Data model

Documents that carry `warehouseId` (required after migration):

| Collection | Meaning of `warehouseId` | Unique key |
| --- | --- | --- |
| `Inventory` | Stock of one product in one warehouse | `(tenantId, warehouseId, productId)` |
| `Invoice` | Selling invoice posted in that warehouse | — |
| `BuyingInvoice` | Buying invoice posted in that warehouse | — |
| `StockMoving` | One stock movement leg in that warehouse | — |
| `DailyAction` | Receipt / payment / expense / entry in that warehouse | — |

Products, categories, customers, suppliers are tenant-wide. They are not copied per warehouse. A product is “visible” in a scope when it has inventory in at least one selected warehouse (buying-invoice search can ask for the full catalog).

`Warehouse` itself is master data (`warehouseId`, name, status, …). Listing warehouses for the picker uses the **ACL**, not the working scope, so a user in operational mode can still pick another warehouse they are allowed to use.

### Inventory identity

One product can exist in many warehouses. Each warehouse has its own `quantity`, `availableQuantity`, `reservedQuantity`, and `averageCost`. Moving stock does not merge rows; it decrements the source row and increments (or creates) the destination row.

Combined view (two or more warehouses in scope) sums qty and qty-weights `averageCost`. That merged DTO blanks `inventoryId`, `warehouseId`, `shelfId`, and Mongo `_id` — it is not a write target. A product stocked in only one of the selected warehouses keeps that row’s identity.

One helper: `aggregateInventoryByProductId` in `packages/store-domain` (API product list/detail and offline `localHandlers` both import it). Do not keep a second aggregator.

---

## Request flow

```
Browser picker
    → localStorage key: store-platform-warehouse-scope:v2:{tenantId}:{userId}
    → every API call: header x-warehouse-scope: id1,id2
         ↓
Auth loads User from Mongo (warehouseIds from the document, not from the JWT)
         ↓
buildRequestContext → resolveWarehouseScope(ACL ∩ header)
         ↓
requestContext.warehouseScope   // string[] | null
         ↓
Reads:  warehouseMongoFilter on the query / loadAccessibleProductIds
Writes: requireOperationalWarehouseId + ensureWarehouseAccess
```

`resolveWarehouseScope` never throws. A stale or forged header can only **narrow** access. Throwing here would escape the route handler’s `try/catch` (Express 4) and kill the Node process.

### Backend helpers

| Helper | Use |
| --- | --- |
| `getAllowedWarehouseIds` | ACL. `null` = unrestricted. |
| `getEffectiveWarehouseIds` | Working scope if set, otherwise ACL. |
| `warehouseMongoFilter` | Mongo `{ warehouseId: { $in } }` from working scope. `null` = omit. `[]` = match nothing. |
| `warehouseAclMongoFilter` | Same, ACL only (party lists, transfer destinations). |
| `requireOperationalWarehouseId` | Writes. Throws unless the effective scope is exactly one id. |
| `ensureWarehouseAccess` | Document must sit in the working scope. |
| `ensureWarehouseAcl` | Document must sit in the ACL (picker, transfer destination). |
| `filterByWarehouseAccess` | In-memory filter by working scope. Prefer `warehouseMongoFilter` on the query. |
| `filterByWarehouseAcl` | Same, ACL only. Still used on `GET /warehouses` and customer/supplier/partner/project summaries. |
| `loadAccessibleProductIds` | Product ids that have stock in the working scope. |

List reads for invoices, inventory, daily actions, bootstrap, and `sync/since` put `warehouseMongoFilter` (or ACL for party lists on selling/buying invoice summaries) on the Mongo query. Do **not** cache a scoped list under a tenant-only Redis key (`cache:invoices:list:${tenantId}`, `dailyActions:${tenantId}`, `cache:products:list:…`). Unrestricted owner reads may still use that unscoped master cache. A tenant-cache **hit** is returned as-is (no in-memory scope pass) — scoped callers never read those keys.

Frontend operational rules live in `web/.../shared/warehouseScope.ts` (`getOperationalWarehouseId`, `requireOperationalWarehouseId`). `useWarehouseScope().isOperational` is `selectedIds.length === 1`. Do not add `warehousePolicy.ts`.

### Redis product cache

| Data | Cache key | May store stock / location? |
| --- | --- | --- |
| Product master (name, barcode, prices, category/brand/unit names) | `tenantId` only (`cache:products:list:…:v3`) | No |
| Product detail | `tenantId + productId` | No (stripped on write; inventory remapped on read) |
| Inventory / qty / averageCost / warehouseName | not in product cache | Load per request from Inventory + working scope |
| Invoice / daily-action lists | do not cache scoped lists under tenant-only keys | Unrestricted owner reads may use the unscoped master cache |

Catalog HTTP still remaps `averageCost` from scoped inventory on read (`mapProductCatalogItem`). It never falls back to a tenant-wide cached cost. Inventory adjust, purchase, sale, and transfer already call `invalidateEntityCache('inventory' | 'products')`.

### What still post-filters (and why)

| Path | Why it is still in memory |
| --- | --- |
| Redis tenant-list hit for invoices / inventory / daily actions | Cache is unscoped master; only unrestricted owners read/write it. Scoped requests query Mongo. Hit returns the blob as-is. |
| `GET /warehouses` | Tenant cache is master data for the picker; ACL is applied on read. |
| Warehouse transfer list | A row is in scope if **from or to** is in the working scope, not a single `warehouseId`. |
| Product catalog after Redis hit | Product **ids** with stock in scope (`loadAccessibleProductIds`); the blob itself has no qty. HTTP catalog DTO never sends qty. |
| Customer / supplier / partner / project invoice summaries | Still `filterByWarehouseAcl` after a tenant `Invoice.find`. Selling/buying **list** party summaries already query with `warehouseAclMongoFilter`. |

---

## What each screen does

### TopBar picker

- Shows warehouses from `GET /warehouses` (ACL-filtered).
- One checkbox / chip = operational. Several = combined.
- Changing the selection invalidates RTK Query tags (`products`, `inventory`, invoices, daily-actions, …) and re-syncs the offline product catalog for the new scope.

### Products / inventory

- Quantities are the selected warehouse(s). Combined mode sums qty across the selection and qty-weights `averageCost`. The merged row has no usable `inventoryId` / `warehouseId`; qty edit stays disabled (`isOperational` + `requireInventoryTarget`).
- Creating a product with stock, or editing quantity, requires operational mode and writes that warehouse.
- **Movement** on a single row, or on 2+ selected products in the action bar, opens the transfer modal (online + operational + user can edit quantity + more than one accessible warehouse).

### Selling and buying invoices

- Create/post: operational warehouse is stamped on the invoice and on every stock moving.
- The body `warehouseId` must match the selected operational warehouse. It cannot be changed later.
- Combined mode: list and dashboard work; the New Invoice buttons are disabled; the API rejects a post.
- Editing an existing invoice keeps its original warehouse even if the picker changes.

### Today’s Actions / dashboard

Scoped to the working scope:

| Card | Source |
| --- | --- |
| Period Sales | Selling invoices in scope |
| Total Profit | Same invoices + their sale stock movings |
| Best Seller | Same |
| Top Profit Product | Same |
| Total Receivable | Outstanding amounts on scoped invoices |
| Cash Balance | `GET cash-accounts/balances` for the working scope, per currency. Pending offline creates and cash transfers adjust the last snapshot. |

Standalone receipts, payments, and expenses are daily actions with their own `warehouseId`.

### Warehouse transfers (movements)

A transfer is not a separate collection. It is a pair of `StockMoving` rows that share one `referenceId`:

| Leg | `type` | `warehouseId` | Qty |
| --- | --- | --- | --- |
| Out | `transfer_out` | source | N |
| In | `transfer_in` | destination | N |

Grouped movement (several products) uses the **same** `referenceId` for every product’s in/out pair.

Rules:

- Source = currently selected operational warehouse. The body cannot override it to something else.
- Destination ≠ source.
- User must have **ACL** access to both warehouses.
- User must have `SEE.productsEditQuantity`.
- Every selected product must have enough **available** stock at the source (`quantity - reservedQuantity`).
- The whole group is one Mongo transaction: all products move or none do.
- Transfer-in seeds destination `averageCost` from the source only when source cost is present and greater than zero (so an uncosted source does not zero the destination’s COGS).
- Edit and delete require operational mode on the **source**, ACL on both sides, and enough stock at the destination to reverse. Concurrent edit/delete is rejected if the live legs no longer match the snapshot (`productId`, type, warehouse, qty).

Today’s Actions shows each grouped transfer as one row. Under Customer it shows `from → to`. Eye opens the detail modal (products, quantities, warehouses, date/time, user). Print and download are available. Edit/delete icons show when the transfer is editable.

### Users page

Owner can assign a subset of tenant warehouses to a non-owner. That writes `User.warehouseIds`. The next request that user makes uses the new ACL (the JWT is not the source of truth).

---

## API surface

Header on every authenticated request from the web app:

```
x-warehouse-scope: <uuid>[,<uuid>…]
```

Warehouse master data (ACL, not working scope):

- `GET /warehouses`
- `POST /warehouses`, `PATCH /warehouses/:id`, `DELETE /warehouses/:id`

Stock and transfers:

- `GET /inventory`
- `GET /inventory/by-product/:productId` — ACL-wide rows for one product (used by the transfer modal destination column)
- `POST /inventory/warehouse-transfer`
- `GET /inventory/warehouse-transfers`
- `GET|PATCH|DELETE /inventory/warehouse-transfers/:referenceId`

Invoices and entries require operational mode on create. List/get filter by working scope.

Offline sync:

- `GET /sync/bootstrap` and `GET /sync/since` filter inventory, invoices, buying invoices, and daily actions by working scope. Warehouses in the payload are ACL-filtered.
- `POST /sync/push` does **not** use the device’s current header as the operational warehouse. Each queued entry is replayed in the warehouse stored on that entry’s payload (checked against the user’s ACL). One push can drain work from several warehouses.

---

## Offline

- Scope is persisted per `tenantId + userId`. Logout clears the in-memory scope and that user’s stored key.
- Dexie inventory / invoices / daily actions are filtered by the current scope (`filterByWarehouseScope` in `localHandlers`: empty scope → `[]`, missing `warehouseId` dropped). Version 5 of the offline DB clears sync timestamps so the next online session re-bootstraps with warehouse ids.
- Offline product hydrate uses the same `aggregateInventoryByProductId` as the API (combined blanks identity).
- The product catalog cache is keyed by warehouse scope. Switching warehouse while offline does not keep showing the previous warehouse’s catalog.
- Offline posting still requires operational mode and stamps `warehouseId` on the local invoice.

---

## Migration and deploy

Script: `npm run migrate:inventory-warehouse-scope` in `services/api-store-platform`.

**Run it before** shipping the API that requires `warehouseId` and the new unique inventory index.

What it does, per tenant:

1. Ensures a default warehouse exists (oldest by `_id`, or creates `Main`).
2. Sets missing `warehouseId` on inventory, selling invoices, buying invoices, stock movings, and daily actions.
3. Invoice/daily-action rows prefer a warehouse already stored on a related stock moving or invoice number when one exists.
4. Sets `User.warehouseIds` to every tenant warehouse for non-owner users that do not have the field yet (keeps the pre-warehouse “see everything” behaviour).
5. Drops the old unique index `{ tenantId, productId }` and creates `{ tenantId, warehouseId, productId }`.

The script is safe to re-run: it only touches rows that still have a missing/empty `warehouseId`.

If the API starts **before** the migration:

- The old unique index still forbids one product in two warehouses (transfers and second-warehouse purchases fail).
- Legacy rows without `warehouseId` disappear from every scoped list (dashboard/cash look empty).

Daily-action cash rows that cannot be matched to an invoice number stay on the oldest warehouse. Combined-view cash is complete; a tenant that already had several warehouses may see that leftover cash only on Main.

---

## Rule card (acceptance)

1. Users can select one or more warehouses they have access to.
2. One warehouse = operational mode: sell, buy, and change stock for that warehouse only.
3. Several warehouses = combined view: data and dashboard are summed; posting and stock changes are blocked.
4. Dashboard cards respect the selected scope.
5. Users cannot select or read unauthorized warehouses.
6. The backend enforces all of the above. The frontend cannot be the only gate.
7. Grouped movement uses one `referenceId` for all products. Partial movement is not possible.
8. Today’s Actions can open, print, download, and (when allowed) edit a movement.

---

## Production smoke checklist (shipped)

Use after WH-REL-1 migration + deploy. UI stays as today.

| Actor | Setup |
| --- | --- |
| Owner | Access to warehouses `W1` (Main) and `W2` |
| Cashier A | ACL = `[W1]` only |
| Cashier B | ACL = `[W2]` only |
| Product P | Stock 10 in W1, 3 in W2, known `averageCost` on W1 |

1. **Operational post** — Owner on W1 only, sell 2 × P → W1 qty 8, W2 still 3, invoice.warehouseId = W1. Combined W1+W2 shows qty 11.
2. **Combined post blocked** — Owner selects W1+W2; new invoice disabled. `POST` with `x-warehouse-scope: W1,W2` → 4xx; stock unchanged.
3. **ACL isolation** — Cashier A cannot see W2 stock/invoices; header intersected; `GET /warehouses` omits W2.
4. **Grouped transfer** — Owner on W1 → W2 for 2 products; one `referenceId`; transfer_out/in; Today’s Actions one row; Eye / Print / Download work.
5. **Transfer all-or-nothing** — One product qty 0 → whole request fails.
6. **Dashboard** — Period sales / profit / best seller / receivable / cash change with picker.
7. **Invite** — Cashier invite → new user ACL = `[W1]` (not all). Owner may grant all.
8. **Offline** — Sale queued on W1 still posts to W1 after picker moves to W2 (`sync/push` uses payload warehouse).

Also: no Node crash on `x-warehouse-scope: <random-uuid>`; frontend `tsc` clean for the merged set.
