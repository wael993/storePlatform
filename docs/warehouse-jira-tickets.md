# Warehouse: merge vs later

How to read this:

- **Merge-blocking** = do this before `main` / production. If you skip it, you can lose stock, lock out staff, or show empty dashboards.
- **After merge** = real tech debt. Do next sprint. Not a reason to hold the feature.
- **Later / nice** = architecture polish. Do not schedule as “must”.

The original warehouse tickets (scope + grouped movement) are already implemented. The review bugs (API crash, user ACL backfill, daily-action scope, transfer claim, sync/push warehouse, invite ACL, import warehouse, barcode `'-'`, purchase-cancel gate, transfer cost seed) are already fixed **on the current working tree**. Merge those files. Do **not** merge only the first staged snapshot.

Do **not** mix in the unrelated label-template work (`PrintBarcodeModal.tsx` currently fails `tsc`). That is a separate review.

---

# A. Merge-blocking (before production)

## WH-REL-1 — Production cutover: run warehouse migration before the new API

**Type:** Release / Ops  
**Priority:** Blocker  
**Labels:** warehouse, production, migration  
**Blocks:** shipping this branch to production

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
2. Backfill missing/empty `warehouseId` on:
   - `Inventory`
   - `Invoice` (prefer warehouse from a `selling_invoice` stock moving)
   - `BuyingInvoice` (prefer warehouse from a `buying_invoice` stock moving)
   - `StockMoving` (prefer warehouse from the linked invoice)
   - `DailyAction` (prefer warehouse from `invoiceNumber` → selling/buying invoice)
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
5. Smoke test (WH-REL-2)
```

If the API is live **before** step 2, transfers and second-warehouse purchases fail until you run the script.

### Acceptance

- [ ] Script run against production (or a prod copy) exits 0
- [ ] One product can exist in two warehouses without `E11000`
- [ ] A pre-existing cashier (no `warehouseIds` before migrate) can open products and post a sale after login
- [ ] Historical invoices still appear under the default / inferred warehouse
- [ ] README / `docs/warehouse.md` cutover section is what ops followed

### Out of scope

Changing default-warehouse selection UI. Leftover daily-action cash that cannot be matched to an invoice number stays on the oldest warehouse (`docs/warehouse.md`). Combined-view cash is complete.

---

## WH-REL-2 — Production smoke test (warehouse feature)

**Type:** QA / Release  
**Priority:** Blocker  
**Labels:** warehouse, qa  
**Depends on:** WH-REL-1

### Summary

Prove operational vs combined mode, isolation, transfer atomicity, and dashboard scope on the deployed build. UI stays as today.

### Tenants / users to prepare

| Actor | Setup |
| --- | --- |
| Owner | Access to warehouses `W1` (Main) and `W2` |
| Cashier A | ACL = `[W1]` only |
| Cashier B | ACL = `[W2]` only |
| Product P | Stock 10 in W1, 3 in W2, known `averageCost` on W1 |

### Cases

1. **Operational post**  
   Owner selects only W1. Post a selling invoice of 2 × P.  
   **Expect:** W1 qty 8, W2 still 3, invoice.warehouseId = W1. Combined view (W1+W2) shows qty 11.

2. **Combined post blocked**  
   Owner selects W1+W2. New Invoice / stock edit disabled.  
   `POST /selling-invoices` with header `x-warehouse-scope: W1,W2`  
   **Expect:** 4xx, message like “Exactly one warehouse must be selected…”. Stock unchanged.

3. **ACL isolation**  
   Cashier A, header `x-warehouse-scope: W2` (or picker cannot select W2).  
   **Expect:** cannot see W2 stock or W2 invoices. Header is intersected (no API crash). `GET /warehouses` does not list W2.

4. **Grouped transfer**  
   Owner on W1, select 2 products with stock, Movement → dest W2.  
   **Expect:** one `referenceId`; each product has `transfer_out` (W1) + `transfer_in` (W2); W1 down, W2 up; Today’s Actions one row `W1 → W2`; Eye / Print / Download work; Edit only while still on W1.

5. **Transfer all-or-nothing**  
   Same as 4 but one product has qty 0.  
   **Expect:** whole request fails, no product moved.

6. **Dashboard**  
   With W1 only vs W1+W2, Period Sales / Profit / Best Seller / Top Profit / Receivable / Cash Balance change with the picker (W2-only sale must not appear on W1).

7. **Invite**  
   Cashier A (if they have invite) creates a user.  
   **Expect:** new user ACL = `[W1]`, not all warehouses. Owner invite may grant all.

8. **Offline (if used in prod)**  
   Owner posts a sale offline on W1, then switches picker to W2 and goes online.  
   **Expect:** the queued sale still posts to W1 (`sync/push` uses payload warehouse, not the current header).

### Acceptance

- [ ] All 8 cases pass on production (or staging with a prod dump)
- [ ] No Node process restart when sending `x-warehouse-scope: <random-uuid>`
- [ ] Frontend `tsc` of the merged set is clean (no label-template files in this PR)

---

# B. After merge (next refactor / hardening)

Do these in order. Do not change TopBar multi-select behaviour.

---

## WH-ARCH-2 — Push warehouse filters into Mongo queries

**Type:** Tech Debt / Performance  
**Priority:** High  
**Labels:** warehouse, backend, performance  
**Suggested sprint:** first after merge

### Summary

Many list endpoints load the whole tenant, then call `filterByWarehouseAccess` in memory. That does not scale and is easy to miss on a new endpoint.

### Current behaviour (wrong place to filter)

```ts
// selling-invoice/api.controller.ts getInvoices
const invoiceResponse = await this.mongoDbClient.getDocuments({ ... }) // all tenant invoices
const warehouseScopedInvoices = filterByWarehouseAccess(requestContext, invoices)
```

Same pattern today:

| Endpoint | File | What is post-filtered |
| --- | --- | --- |
| Selling invoice list + summary | `selling-invoice/api.controller.ts` ~856 | invoices |
| Buying invoice list | `buying-invoice/api.controller.ts` ~479 | invoices |
| Inventory list | `api.controller.ts` `getInventory` ~3667 | inventory (after Redis tenant blob) |
| Daily actions list | `api.controller.ts` `scopeDailyActions` ~4042 | daily actions (after Redis tenant blob) |
| Daily action filter-values | `api.controller.ts` ~4055 | daily actions |
| Offline bootstrap invoices / buying / daily | `api.controller.ts` ~5570, 5596, 5612 | same |
| Sync-since | `api.controller.ts` ~6082–6115 | inventory, daily, invoices, buying |

Already query-level (do not redo):

- `loadAccessibleProductIds`: `Inventory.find({ warehouseId: { $in: effective } })`
- Product list uses that id list as `productId: { $in }`

### Required helper

Add to `services/api-store-platform/src/shared/warehouseAccess.ts` (keep it tiny):

```ts
/** Mongo predicate for warehouse-scoped collections.
 *  null  = owner/unrestricted → omit the clause
 *  []    = no access → match nothing (e.g. { warehouseId: { $in: [] } } plus a known-false if you prefer)
 *  [id…] = { warehouseId: { $in: ids } }
 */
export const warehouseMongoFilter = (
  requestContext: RequestContext,
): Record<string, unknown> | null
```

Semantics **must** stay:

| Effective scope | Filter |
| --- | --- |
| `null` (owner, no header) | no `warehouseId` predicate |
| `[]` (employee, empty ACL or stale header intersected to empty) | match **nothing** (fail closed) |
| `['W1']` or `['W1','W2']` | `warehouseId: { $in: those ids }` |

Rows without `warehouseId` stay invisible when a scope is set (same as today).

### Example: selling invoices

**Before**

```ts
const invoices = await Invoice.find({ tenantId }).lean()
return filterByWarehouseAccess(requestContext, invoices)
```

**After**

```ts
const warehouse = warehouseMongoFilter(requestContext)
const invoices = await withTenantScope(
  Invoice.find({ ...(warehouse ?? {}) }),
  tenantId,
).lean()
```

Redis: either stop caching the unscoped list as the source of truth, or cache unscoped **master** and still apply the Mongo filter on the live path. Do not cache a scoped list under a tenant-only key (`cache:invoices:list:${tenantId}`).

### Acceptance

- [ ] Shared helper + self-check:
  - owner + no header → `null`
  - cashier ACL `[W1]` + header `W1,W2` → `{ warehouseId: { $in: ['W1'] } }`
  - cashier ACL `[]` → empty `$in` / match nothing
- [ ] Selling invoices, buying invoices, inventory, daily actions use the helper on the **query**, not as the only filter after a full tenant load
- [ ] Empty-ACL cashier still sees zero invoices / inventory / cash
- [ ] Owner with no header still sees all warehouses
- [ ] `docs/warehouse.md` lists any endpoint that still post-filters and why (e.g. Redis hit that is then scoped)

### Out of scope

Changing dashboard math. Changing the header contract. Frontend.

### Test plan

- Tenant with 10k invoices: W1-only request must not scan/return W2 rows (explain plan or log count).
- Regression: Cashier A cannot see Cashier B warehouse invoices.

---

## WH-ARCH-4 — Combined-view inventory must not keep a real inventoryId

**Type:** Bug / Tech Debt  
**Priority:** High  
**Labels:** warehouse, inventory, backend  
**Suggested sprint:** first after merge (small)

### Summary

`aggregateInventoryByProductId` already blanks `warehouseId` and `shelfId` when it merges two warehouse rows. It still spreads `...existing`, so **`inventoryId` (and any other identity field) stays the first Mongo row**. Combined view can hand the UI a real id that belongs to one warehouse while `quantity` is the sum.

Today qty edit is gated to operational mode (`isEditable={… && isOperational}` and API `requireOperationalWarehouseId`), so this is **not** a current write exploit. It is still a lying DTO.

### Current code

`services/api-store-platform/src/apis/api.controller.ts` ~193–234:

```ts
inventoryByProductId.set(inventoryItem.productId, {
  ...existing,          // inventoryId of warehouse A
  warehouseId: '',
  shelfId: undefined,
  quantity: totalQty,   // A + B
})
```

Frontend `productInlineEdit.ts` `requireInventoryTarget` needs both `inventoryId` and `warehouseId`. Combined mode already fails that because `warehouseId` is `''`. Keep that.

### Required change

When **more than one** inventory row contributed to the merge:

- set `inventoryId` to `''` or omit it
- keep `warehouseId: ''`, `shelfId: undefined`
- keep summed `quantity` / `availableQuantity` / `reservedQuantity` and qty-weighted `averageCost`

When **exactly one** row (operational, or product only stocked in one of the selected warehouses): keep that row’s identity. That row is a real target.

Same rule for product list, product detail, and any offline `aggregateInventoryByProductId` copy (`localHandlers.ts`).

### Example

Product P: W1 `inventoryId=inv-a` qty 10, W2 `inv-b` qty 3. Scope `W1,W2`.

| Field | Today | After |
| --- | --- | --- |
| quantity | 13 | 13 |
| warehouseId | `''` | `''` |
| inventoryId | `inv-a` | empty / omitted |

`PATCH /inventory/:inventoryId` in combined mode must still 4xx (operational rule). Do not add `inventoryByWarehouse[]` in this ticket unless a screen needs it.

### Acceptance

- [ ] Combined merge of 2+ rows has no usable `inventoryId`
- [ ] Single-row products still have `inventoryId` + `warehouseId` for operational inline edit
- [ ] Qty edit stays disabled in combined mode
- [ ] Combined view still shows summed qty
- [ ] One assert in a self-check: two rows → blank identity, summed qty

### Out of scope

Redesigning the product DTO. Per-warehouse qty columns.

---

## WH-ARCH-5 — Catalog Redis cache must not embed warehouse stock

**Type:** Tech Debt  
**Priority:** Medium  
**Labels:** warehouse, cache, backend

### Summary

Product **detail** cache is already correct: store master, strip `inventory` / `warehouseName` / `shelfName`, remap on read (`getProduct` ~1660).

Product **catalog** cache (`redisCache.buildProductListKey(tenantId)`) still maps **tenant-wide** inventory into the blob (`getProductCatalog` ~1284–1312), then later filters product ids and remaps `averageCost`. The HTTP catalog DTO does **not** currently send qty, so there is no live leak — but the blob is a footgun and wastes RAM.

### Required cache policy (write this into `docs/warehouse.md`)

| Data | Cache key | May store stock / location? |
| --- | --- | --- |
| Product master (name, barcode, prices) | `tenantId` only | No |
| Product detail | `tenantId + productId` | No (already stripped) |
| Inventory / qty / averageCost / warehouseName | not in product cache | Load per request from Inventory + scope |
| Invoice / daily-action **lists** | do not cache scoped lists under tenant-only keys (see WH-ARCH-2) |

### Required code change

When filling `buildProductListKey`:

- cache products **without** `inventory` / location names (same deletes as detail), **or**
- stop putting catalog through that key and cache master-only

On read, attach scoped `averageCost` the way `mapProductCatalogItem` already does (no tenant-wide fallback).

Invalidation (already mostly there — verify, do not invent a second system):

- inventory adjust, purchase, sale, transfer create/edit/delete → `invalidateEntityCache('inventory' | 'products')`

### Acceptance

- [ ] Redis catalog/list blob has no `inventory` / `warehouseName` / `shelfName`
- [ ] Cashier scoped to W1 never receives W2 qty or W2 `averageCost` on catalog
- [ ] Policy paragraph in `docs/warehouse.md`
- [ ] Transfer still busts product/inventory cache (existing tests or a manual check)

### Out of scope

Per-scope Redis keys for every catalog. Frontend.

---

## WH-ARCH-6 — One frontend helper for operational / empty-scope

**Type:** Tech Debt  
**Priority:** Medium  
**Labels:** warehouse, frontend, consistency  
**Do not** move scope into Redux in this ticket (that is WH-ARCH-1).

### Summary

The server (`warehouseAccess.ts`) is the authority. The UI copies the same rules in three places and they have already drifted once.

| Place | What it duplicates |
| --- | --- |
| `web/.../shared/warehouseScope.ts` | `isOperationalWarehouseMode`, `getOperationalWarehouseId` |
| `web/.../offline/localHandlers.ts` | `filterByWarehouseScope`, `requireOperationalWarehouseIdForOffline`, `assertWarehouseInScope` |
| Invoice / product panels | ad-hoc `isOperational && operationalWarehouseId` |

### Required helper (frontend only, pure)

File: `web/store-platform-frontend/src/shared/warehousePolicy.ts` (or keep functions in `warehouseScope.ts` and **delete** the copies).

```ts
export const isOperationalScope = (ids: string[]): boolean =>
  ids.length === 1

export const operationalWarehouseId = (ids: string[]): string | null =>
  ids.length === 1 ? ids[0] : null

/** Fail closed: empty scope → []. Missing warehouseId → drop. */
export const filterRowsByWarehouseScope = <T extends { warehouseId?: string }>(
  items: T[],
  scopeIds: string[],
): T[] => {
  if (scopeIds.length === 0) return []
  const allowed = new Set(scopeIds)
  return items.filter(item => Boolean(item.warehouseId) && allowed.has(item.warehouseId!))
}
```

Wire:

- `localHandlers.ts` uses `filterRowsByWarehouseScope(getWarehouseScopeIds())` — delete local copies
- `NewSellingInvoicePanel` / `NewBuyingInvoicePanel` / product tables keep using `useWarehouseScope().isOperational` (hook already wraps the same rule)

Backend: add a one-line comment on `requireOperationalWarehouseId`:

```
// New stock/invoice write path must call this. Do not trust the client.
```

### Acceptance

- [ ] Offline list/filter/assert use the shared helper
- [ ] Empty scope still returns `[]` offline (no Dexie leak)
- [ ] Combined scope still cannot post offline
- [ ] No new npm package, no BE/FE shared workspace
- [ ] Self-check or a few asserts: `[]` → filter empty; `['W1']` → operational; `['W1','W2']` → not operational

### Out of scope

Redux. Changing default warehouse. Changing header name.

---

## WH-ARCH-8 — Fix stale warehouse comments

**Type:** Chore  
**Priority:** Low  
**Labels:** warehouse, docs  
**No behaviour change**

### Summary

Comments still describe an older default.

### Exact drift

`web/store-platform-frontend/src/shared/warehouseScope.ts` ~79–81:

```
 * Bind scope to user/tenant, prune to accessible warehouses, default to all accessible.
```

Code ~104–107 defaults to **`[accessibleIds[0]]`** (operational). Combined view is explicit multi-select.

### Do

- Change that JSDoc to: default to the first accessible warehouse (operational). Combined = user selects 2+.
- Grep `warehouse` comments for “all accessible” / “default to all”.
- README already says migrate-before-deploy and links `docs/warehouse.md` — keep that; add one line: “UI default after login is the first warehouse.”

### Acceptance

- [ ] Comment matches code
- [ ] No runtime diff

---

# C. Later / nice (do not block a sprint)

---

## WH-ARCH-1 — Move warehouse scope into Redux

**Type:** Tech Debt  
**Priority:** Medium (do **not** start until WH-ARCH-6 is done)  
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

`loadAccessibleProductIds` means “product ids that have an inventory row in the **working scope**”, not “ACL”. Buying uses `?all=1` (tenant product master). Selling uses the stocked-in-scope catalog. `docs/warehouse.md` already states this.

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

`docs/warehouse.md` already documents header, missing vs present, owner vs employee, and “exactly one id for mutations”. This ticket only adds copy-paste examples and error strings. **Decision (already taken):** keep “missing header = ACL only / owner unrestricted on reads”. Do not require the header for non-owners (breaks scripts and `sync/push`).

### Add to `docs/warehouse.md`

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

- [ ] Examples in `docs/warehouse.md`
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

# Suggested Jira epic

**Epic:** Warehouse scope — production cutover and hardening

| Ticket | When | Why |
| --- | --- | --- |
| WH-REL-1 | **Before prod** | Migration / index / staff ACL |
| WH-REL-2 | **Before prod** | Smoke test |
| WH-ARCH-2 | After merge | Scale + harder to miss filters |
| WH-ARCH-4 | After merge | Honest combined DTO |
| WH-ARCH-5 | After merge | Cache footgun |
| WH-ARCH-6 | After merge | Stop FE/offline drift |
| WH-ARCH-8 | After merge | Comment fix (can do same day as 4) |
| WH-ARCH-7 | Later | Extra API examples |
| WH-ARCH-3 | Later | Rename “accessible” |
| WH-ARCH-9 | Later | Last price per warehouse |
| WH-ARCH-10 | Later | Transfer pagination |
| WH-ARCH-1 | Later / skip | Redux; no user value now |

Order after merge: **2 → 4 → 5 → 6 → 8**, then 7/3/9/10, then 1 only if you want it.
