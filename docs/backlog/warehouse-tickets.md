# Warehouse: still open

Shipped warehouse scope, ACL, transfers and production smoke
are documented in [`../reference/warehouse.md`](../reference/warehouse.md).
Do not re-open those as tickets.

Everything left is polish; nothing blocks a sprint. Done / dropped: WH-REL-1 (Mongo-only
migration, obsolete on Postgres), WH-ARCH-2/4/5/6/8, WH-REL-2 smoke.

Money-formatting (`Fee`) and return/replace live in [`later-tickets.md`](later-tickets.md)
and [`product.md`](product.md).

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
| WH-ARCH-7  | Later           | Extra API examples                 |
| WH-ARCH-3  | Later           | Rename “accessible”                |
| WH-ARCH-9  | Later           | Last price per warehouse           |
| WH-ARCH-10 | Later           | Transfer pagination                |
| WH-ARCH-1  | Later / skip    | Redux; no user value now           |

Smoke checklist (WH-REL-2) is done — see [`../reference/warehouse.md`](../reference/warehouse.md).

