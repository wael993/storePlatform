# Warehouse: still open

Shipped warehouse scope, ACL, transfers, migration script, and production smoke
are documented in [`../reference/warehouse.md`](../reference/warehouse.md).
Do not re-open those as tickets.

How to read what remains:

- **Merge-blocking** = before production if the migration has not run yet.
- **After merge** = hardening / scale. Next sprint, not a reason to hold the feature.
- **Later / nice** = polish. Do not schedule as “must”.

Money-formatting (`Fee`) and return/replace live in [`later-tickets.md`](later-tickets.md)
and [`product.md`](product.md).

---

# A. Merge-blocking (before production)

## WH-REL-1 — Production cutover: run warehouse migration before the new API

**Type:** Release / Ops  
**Priority:** Blocker  
**Labels:** warehouse, production, migration  
**Blocks:** shipping the warehouse-requiring API to production

### Summary

The new API requires `warehouseId` on inventory, invoices, stock movings, and daily actions, and it uses a new unique inventory index `(tenantId, warehouseId, productId)`. The **only** thing that drops the old unique index `{ tenantId, productId }` is the migration script. Mongoose `autoIndex` adds the new index; it never removes the old one.

### What happens if you skip this

1. Second-warehouse stock and every transfer-in upsert hit Mongo `E11000` duplicate key.
2. Legacy rows without `warehouseId` vanish from every scoped list (`filterByWarehouseAccess` drops them). Dashboard, cash, invoices, and inventory look empty.
3. Existing non-owners have no `User.warehouseIds` → empty ACL → they see nothing and cannot post.

### What the script does (per tenant)

Script: `services/api-store-platform/src/scripts/migrate-inventory-warehouse-scope.ts`  
Command: `cd services/api-store-platform && npm run migrate:inventory-warehouse-scope`

1. Pick default warehouse: oldest Warehouse `_id` for that tenant, or create `Main`.
2. Backfill missing/empty `warehouseId` on Inventory, Invoice, BuyingInvoice, StockMoving, DailyAction.
3. For every non-owner / non-`super_admin` user with missing `warehouseIds`, set `warehouseIds` to **all** warehouses of that tenant.
4. Drop old unique inventory index `{ tenantId, productId }`.
5. Create `{ tenantId, warehouseId, productId }` unique + supporting indexes.
6. Assert zero remaining documents with missing `warehouseId`, and zero staff users still missing ACL.

Safe to re-run: filters are “warehouseId missing/empty” only.

### Deploy order (do not invert)

```
1. Backup Mongo
2. Run npm run migrate:inventory-warehouse-scope  (must exit 0)
3. Confirm asserts in the log: remaining* = 0, userAclBackfill printed
4. Deploy API + frontend together
5. Smoke test (checklist in docs/reference/warehouse.md)
```

### Acceptance

- [ ] Script run against production (or a prod copy) exits 0
- [ ] One product can exist in two warehouses without `E11000`
- [ ] A pre-existing cashier (no `warehouseIds` before migrate) can open products and post a sale after login
- [ ] Historical invoices still appear under the default / inferred warehouse
- [ ] Ops followed [`../reference/warehouse.md`](../reference/warehouse.md) cutover + smoke sections

### Out of scope

Changing default-warehouse selection UI. Leftover daily-action cash that cannot be matched to an invoice number stays on the oldest warehouse.

---

# B. After merge (next refactor / hardening)

After-merge hardening is shipped. Remaining work is later/nice. Do not change TopBar multi-select behaviour.

WH-ARCH-2 (query-level `warehouseMongoFilter` / `warehouseAclMongoFilter`),
WH-ARCH-4 (`aggregateInventoryByProductId` in store-domain; combined DTO blanks
`inventoryId` / `warehouseId` / `shelfId` / `_id`), and WH-ARCH-5 (catalog Redis
`…:v3` is product master only) are shipped — see
[`../reference/warehouse.md`](../reference/warehouse.md).

WH-ARCH-6 skipped: `getOperationalWarehouseId` / `requireOperationalWarehouseId`
already live in `warehouseScope.ts`; the hook wraps `isOperational`. Do not add
`warehousePolicy.ts`. WH-ARCH-8 was a stale JSDoc (fixed).

---

# C. Later / nice (do not block a sprint)

---

## WH-ARCH-1 — Move warehouse scope into Redux

**Type:** Tech Debt  
**Priority:** Medium (skip until the singleton actually causes a bug)  
**Labels:** warehouse, frontend, architecture  
**Recommendation:** skip until the singleton actually causes a bug.

### Summary

`warehouseScope.ts` is a module singleton (`selectedWarehouseIds`, listeners, `localStorage`). The rest of the app is Redux + RTK Query. `prepareHeaders` hydrates and reads the module, not `getState()`.

### Why this is not merge-blocking

It works. Logout clears the key. TopBar is correct. A Redux move touches every request header, offline handlers, and logout — high regression, zero user-facing change.

### If you do it later

1. Add `warehouseScope: { selectedIds: string[] }` to the existing user/store slice (do not add a new store).
2. Persist with the **same** key: `store-platform-warehouse-scope:v2:{tenantId}:{userId}`.
3. `prepareHeaders` reads `getState()` only. No `hydrateWarehouseScopeForUser` module call.
4. Offline + `useWarehouseScope` select from the store. Delete `subscribeWarehouseScope` / module listeners.
5. Logout existing `clearWarehouseScope` becomes a reducer + `localStorage.removeItem`.
6. TopBar multi-select **unchanged**.

### Acceptance

- [ ] Single source of truth in Redux
- [ ] Header matches store on the same tick as a picker change (no race where the first request after click still has the old ids)
- [ ] Logout clears memory + v2 key
- [ ] Old v2 keys still load

### Out of scope

Changing default-to-first-warehouse. Backend.

---

## WH-ARCH-3 — Rename catalog “accessible” to “stocked in scope”

**Type:** Chore / Design  
**Priority:** Low  
**Labels:** warehouse, catalog  
**No UX change**

### Summary

`loadAccessibleProductIds` means “product ids that have an inventory row in the **working scope**”, not “ACL”. Buying uses `?all=1` (tenant product master). Selling uses the stocked-in-scope catalog. [`../reference/warehouse.md`](../reference/warehouse.md) already states this.

### Do

- Rename (or comment) BE: `loadAccessibleProductIds` → `loadProductIdsStockedInScope` (or a comment if rename is too wide).
- FE/offline: same words in comments. Keep `?all=1` behaviour.
- Do **not** add a third catalog mode.

### Acceptance

- [ ] A new reader can tell “not stocked here” from “no warehouse ACL”
- [ ] Buying search still sees products with zero stock in this warehouse
- [ ] Selling catalog still hides products with no in-scope inventory
- [ ] TopBar unchanged

---

## WH-ARCH-7 — API examples for `x-warehouse-scope`

**Type:** Documentation  
**Priority:** Low  
**Labels:** warehouse, api, docs

### Summary

[`../reference/warehouse.md`](../reference/warehouse.md) already documents header, missing vs present, owner vs employee, and “exactly one id for mutations”. This ticket only adds copy-paste examples and error strings. **Decision (already taken):** keep “missing header = ACL only / owner unrestricted on reads”. Do not require the header for non-owners (breaks scripts and `sync/push`).

### Add to `docs/reference/warehouse.md`

```http
GET /api/data/selling-invoices
Authorization: Bearer <token>
x-warehouse-scope: 11111111-1111-4111-8111-111111111111
```

```http
POST /api/data/inventory/warehouse-transfer
x-warehouse-scope: 11111111-1111-4111-8111-111111111111
Content-Type: application/json

{ "toWarehouseId": "22222222-2222-4222-8222-222222222222",
  "items": [{ "productId": "…", "quantity": 2 }] }
```

Document the two write errors:

- scope not exactly one id → “Exactly one warehouse must be selected to post invoices or change stock.”
- body warehouse ≠ operational → “Invoice warehouseId must match the selected operational warehouse.” / transfer: “fromWarehouseId must match the selected operational warehouse.”

### Acceptance

- [ ] Examples in `docs/reference/warehouse.md`
- [ ] README still links that doc
- [ ] No code change

---

## WH-ARCH-9 — Scope last selling / last buying price (optional)

**Type:** Improvement  
**Priority:** Low  
**Labels:** warehouse, catalog

### Summary

`resolveLastSellingPricesByProductId` / `resolveLastBuyingPricesByProductId` (`api.controller.ts` ~1382+) aggregate **tenant-wide**. A W1 cashier can see the last price charged in W2 for the same product.

### Do only if product wants warehouse-local last price

`$match` invoices with `warehouseMongoFilter` (WH-ARCH-2). If effective scope is `null`, keep tenant-wide (owner).

### Acceptance

- [ ] Cashier W1 last selling price is from W1 invoices only
- [ ] Owner with no header still sees tenant-wide last price
- [ ] Catalog `?all=1` does not leak qty (already true)

---

## WH-ARCH-10 — Paginate warehouse transfer list

**Type:** Performance  
**Priority:** Low  
**Labels:** warehouse, backend

### Summary

`getWarehouseTransfers` loads every `warehouse_transfer` stock moving for the tenant, groups in memory, no `limit`. Fine until a tenant has years of movements.

### Do later

`limit` + `invoiceDateFrom` / `invoiceDateTo` (already accepted) as a real page, not `totalCount: mapped.length` of the full set.

---

# Suggested order

| Ticket     | When            | Why                                |
| ---------- | --------------- | ---------------------------------- |
| WH-REL-1   | **Before prod** | Migration / index / staff ACL      |
| WH-ARCH-7  | Later           | Extra API examples                 |
| WH-ARCH-3  | Later           | Rename “accessible”                |
| WH-ARCH-9  | Later           | Last price per warehouse           |
| WH-ARCH-10 | Later           | Transfer pagination                |
| WH-ARCH-1  | Later / skip    | Redux; no user value now           |

Smoke checklist (WH-REL-2) is done — see [`../reference/warehouse.md`](../reference/warehouse.md).

