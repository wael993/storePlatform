# Offline product and inventory mutations

Product-page edits (inline cells, edit modal, notification digest) all go
through `editProduct` / `editInventory`. Those mutations have several client
copies of the same fact:

- Dexie `products` and `inventory`
- Dexie `catalogProducts` plus in-memory `productCatalogStore`
- RTK product / inventory / catalog caches
- outbox rows that `sync/push` replays
- MongoDB after reconnect

Invoice search does **not** read Dexie `products`. Selling search reads
`productCatalogStore`. Stock in the search dropdown reads inventory
(`availableQuantity ?? quantity`). A mutation is successful only if local
source state, all required local projections, and a pending outbox row are
committed together. Replay uses the same server rules and keeps FIFO order.

## Local apply boundary

Offline `POST`/`PATCH`/`DELETE` for products and inventory no longer no-ops
inside the generic entity switch. They go through one pair of functions:

```text
handleOfflineQuery
  → handleGenericMutation
      → Dexie transaction (products, inventory, catalogProducts,
        buyingInvoices, syncMeta, outbox)
          → applyLocalProductMutation / applyLocalInventoryMutation
          → putOutboxEntry
      → reload catalog memory after commit
```

If the transaction throws, IndexedDB rolls back: no partial product row, no
catalog projection, and no outbox entry. Optimistic RTK then rolls back from
the thrown error. Memory catalog reload happens after commit (it is not a
Dexie table).

UI hooks stay on `editProduct` / `editInventory`. They do not write catalog
tables or outbox rows themselves.

`applyLocalProductMutation`:

1. Validates with the same field rules the server uses (non-empty name max
   100 chars, latinName max 100, non-negative prices/qty, barcode empty-or-real).
2. Fails if the Dexie product row is missing. No outbox. Optimistic RTK
   rollback follows the thrown error.
3. Reads tenant/SEE before the transaction. Helpers inside the transaction
   only touch declared tables (`syncMeta` is included so catalog/tenant reads
   cannot escape the scope).
4. Writes Dexie `products` (price merge for PATCH) with `inventory`,
   `buyingInvoices` (read, so opening-cost checks do not deadlock),
   `catalogProducts`, `syncMeta`, and `outbox` in one transaction.
5. On purchase-price change, reuses `syncLocalOpeningAverageCost` and marks
   those inventory rows `pending` so a pull cannot overwrite the correction
   before the product PATCH replays.
6. Merges the product into `catalogProducts` and reloads catalog memory +
   search indexes (`barcode`, `internalCode`, factory code) after commit.
7. Buying-cost fields (`purchasePrice`, `averageCost`, `lastBuyingPrice`) are
   included only when the session SEE contains `products.buyingPrice`.

`applyLocalInventoryMutation`:

1. Resolves `productId` from the URL and `warehouseId` from the body.
2. Requires the operational warehouse (same rule as online).
3. Fails if the Dexie inventory row is missing. No outbox.
4. Updates `quantity` / `minQuantity` / `shelfId`. `warehouseId` is a locator,
   not a mutable field.
5. Sets `availableQuantity` with `availableQuantityFromStock` so invoice
   search stock cannot stay on a stale `availableQuantity`. The server
   `patchInventory` path uses the same helper.

## Catalog projection

`mergeProductIntoCatalogItem` overlays identity and price onto an existing
`ProductCatalogItem`. It keeps invoice-derived `lastSellingPrice` /
`lastBuyingPrice` and `images`. It does not rebuild the row from a full
`Product` in a way that drops those fields.

Online product edits go through `applyOnlineProductCatalogEdit`, which uses
the same opening-cost + scoped WAC path as the offline apply so selling and
buying search do not keep a stale `averageCost` while catalog refresh is
skipped.

Offline `GET products/catalog` and `GET products/catalog?all=1` both read
`catalogProducts`. Updating IndexedDB and `productCatalogStore` together
keeps selling and buying search aligned.

## Outbox

Create retries still key on entity identity (`invoiceId`, `productId`, …).

`PATCH` / `PUT` also fingerprint the body. Sequential edits to the same URL
(`name` then `barcode`, `quantity: 10` then `quantity: 5`, `purchasePrice: 10`
then `11`) are separate ordered rows. An identical retry of the same body is
still deduplicated.

Invoice PATCH writes the invoice row and its outbox entry in one Dexie
transaction (`invoices`, `products`, `inventory`, `outbox`). Existing lines
keep their stamped `unitCost`; only a new product line resolves a fresh cost.

Outbox `createdAt` is monotonic so two mutations in the same millisecond
keep FIFO order on replay.

Reconnect:

1. `sync/push` sends outbox FIFO (`createdAt`).
2. Product PATCH replays `patchProduct`.
3. Inventory PATCH replays `patchInventoryByProductId` (tenant, warehouse,
   SEE, immutable warehouse id stay on the server).
4. `clientMutationId` is recorded so the same retry is a no-op.
5. After a **successful** push (no remaining product/inventory pending rows),
   `syncFromNetwork` replaces the catalog from the server.

`syncFromNetwork` **does not** wipe `catalogProducts` while product or
inventory outbox rows are pending. That avoids a reconnect race where a
catalog GET lands before PATCH replay and invoice search snaps back to the
old server snapshot.

Quantity PATCH is an absolute `$set` (last write wins on reconnect). It is
not a delta against concurrent sales.

## Oversell

Tenant invoice setting `allowOversell` (Settings → Invoice → Allow Oversell)
is the one switch for selling-invoice oversell, online and offline.

- **On:** local POST skips the stock modal, `validateSaleInventory` does not
  throw, and sale quantity adjustments pass `allowNegative` so stock can go
  below zero. Search still shows `availableQuantity` as `max(0, qty − reserved)`.
- **Off (default):** local POST shows an informational oversell modal and does
  not queue the invoice. The server throws `Insufficient stock…` and the
  atomic inventory gate still blocks concurrent oversell. The cashier cannot
  confirm-and-continue.

The same document is bootstrapped into Dexie `syncMeta` (`invoiceSettings`)
and patched through `PATCH invoice-settings`. Warehouse transfers ignore this
flag and stay stock-gated.

`findOversellLines` in `store-domain` is the shared comparison. Callers that
mean “zero stock” must put `0` in the availability map; a missing entry is
unknown, not oversell.

## RTK caches

`onQueryStarted` still owns optimistic `getProducts` / `getInventory` /
`getProductCatalog`. `applyOptimisticProductPatch` updates **every** cached
`getProductCatalog` argument, including `{ all: true }` for buying search.
A successful `editProduct` / barcode generate also upserts that one row into
`catalogProducts` + `productCatalogStore`, even when `syncFromNetwork` skips
because product/inventory outbox rows are still pending.

If the offline apply throws, `runOptimistic` rolls those patches back.

`generateProductBarcode` (online only) also refreshes the selling catalog
store after a successful barcode write.

## What this does not change

- Inactive / discontinued / zero-stock catalog eligibility
- Invoice search still uses the catalog projection, not the full product
  document
- Open draft invoice lines keep the unit price the cashier already entered;
  new adds from search use the updated catalog price
- Mobile editing still uses the same `editProduct` / `editInventory` mutations

## Files

- `packages/store-domain/src` (cost, quantity, profit, name-length, oversell)
- `web/store-platform-frontend/src/offline/localProductInventoryMutations.ts`
- `web/store-platform-frontend/src/offline/localHandlers.ts`
- `web/store-platform-frontend/src/offline/productCatalogStore.ts`
- `web/store-platform-frontend/src/offline/localStore.ts`
- `web/store-platform-frontend/src/api/optimisticData.ts`
- `services/api-store-platform/src/apis/api.controller.ts` (`sync/push`)
