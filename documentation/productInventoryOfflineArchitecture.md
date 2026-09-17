# Product and inventory offline architecture

Mandatory architecture, invariants, and review rules for any change that
touches products, inventory, catalog, invoice search, offline mutations,
IndexedDB / Dexie, outbox, prices, quantity, WAC, invoice cost, profit,
selling/buying invoice edits, catalog sync, optimistic UI, or replay.

Applies to features, bug fixes, refactors, and “unrelated” diffs that still
touch those surfaces. The goal is to stop local, server, catalog, accounting,
and outbox state from diverging.

A UI change is not a complete change. A change is complete only when every
required representation stays consistent.

Related implementation notes: `offlineProductInventoryMutations.md`,
`totalprofit.md`.

---

## 1. Layers are not interchangeable

Product/inventory data has several representations. Treat them as separate
layers, never as aliases of each other.

```text
Server source of truth
  → local source state
  → local catalog projections
  → in-memory catalog / search state
  → UI
```

Synchronization:

```text
Local mutation
  → local state + projections
  → outbox
  → server replay
  → server state
  → catalog / inventory refresh
```

| Layer | Examples | Who reads it |
| --- | --- | --- |
| Server source of truth | MongoDB products, inventory, invoices, stock movings | Replay, refetch |
| Local source state | Dexie `products`, `inventory` | Offline apply |
| Local projections | Dexie `catalogProducts` | Offline catalog GET |
| In-memory catalog | `productCatalogStore` | Selling invoice search |
| RTK cache | `getProductCatalog`, `getProducts`, `getInventory` | Buying search, lists |
| Outbox | pending replay rows | `sync/push` |

Updating one layer does not update the others.

---

## 2. Golden mutation invariant

A mutation may report success only when the affected local source state, all
required local projections, and the required outbox / sync state have been
committed consistently.

Offline:

```text
UI
  → central local mutation boundary
  → source state
  → required projections
  → outbox
```

Online:

```text
UI
  → server mutation
  → canonical local projection update
  → UI / search / cache synchronization
```

UI components, invoice screens, modals, search, unrelated hooks, and event
handlers must not write Dexie tables, `productCatalogStore`, or outbox rows
themselves. That work belongs in the approved central mutation path.

- Product mutations go through the central product mutation path.
- Inventory mutations go through the central inventory mutation path.

Do not call `catalogProducts.update`, `products.update`, `inventory.update`,
`productCatalogStore.set`, or `addOutboxEntry` from UI code unless that code
**is** the central mutation implementation.

---

## 3. Product mutation workflow

```text
Validate
  → resolve required local context
  → begin Dexie transaction
  → update products
  → update required catalog projection
  → update required local derived state
  → create / update outbox mutation
  → commit
  → update in-memory / UI caches where required
```

Tables vary by operation. The consistency requirement does not.

---

## 4. Inventory mutation workflow

```text
Validate
  → resolve warehouse / access context
  → calculate authoritative local quantity
  → calculate availableQuantity
  → update inventory
  → update required local derived state
  → create / update outbox mutation
  → commit
```

The server must use the same business rule for derived inventory fields.

---

## 5. Dexie transactions

Every Dexie transaction must list **every** table the transaction may access,
including tables reached indirectly through helpers.

If `buildCatalogRecord()` reads `syncMeta`, the transaction must include
`syncMeta` even when the caller never names that table.

Before changing a transaction:

1. List tables accessed directly.
2. List helpers called inside the transaction.
3. Inspect those helpers for table reads / writes.
4. Add every required table to the transaction scope.
5. Add a real Dexie integration test. Mocks do not prove transaction scope.

**Hard rule:** never read a Dexie table outside the transaction scope.

```text
# wrong
transaction(products, inventory, catalogProducts)
  → helper()
  → syncMeta.get(...)   # syncMeta not in scope
```

Either include the table:

```text
transaction(products, inventory, catalogProducts, syncMeta)
```

or resolve it before the transaction:

```text
tenantId = readSyncMeta()
transaction(products, inventory, catalogProducts)
```

Choose based on the consistency requirement.

A helper that looks pure may still read Dexie, `syncMeta`, network state, or
another table. Audit that before putting it inside a transaction.

---

## 6. Atomicity and fail-closed

These must not become permanently inconsistent: `products`, `catalogProducts`,
`inventory`, derived local state, `syncMeta`, outbox.

If every write cannot live in one Dexie transaction, the implementation must
still guarantee that a failure cannot produce a successful but unreplayable
mutation.

Never silently accept:

- source updated, projection failed, outbox missing
- source updated, outbox missing, UI reports success

When a required local operation fails:

- do **not** report success
- do **not** leave an unreplayable mutation
- do **not** silently continue
- do **not** fabricate derived state

Roll back optimistic UI where appropriate. Prefer an explicit failure over
silent divergence. Typical fail cases: missing product/inventory row, catalog
projection cannot update, missing sync metadata, outbox cannot be created,
invalid local data, transaction failure.

---

## 7. Outbox

Every offline mutation that must reach the server needs a valid replay path.
Before adding a mutation, all of these must be yes:

- Can it persist locally?
- Can it be represented in the outbox?
- Can it be replayed?
- Can the server accept it?
- Can it preserve mutation order?
- Can it be retried safely?

If any answer is no, the mutation is not complete.

### Ordering is business logic

Outbox order is not an implementation detail.

```text
purchasePrice = 10 → sale
```

is not the same as:

```text
sale → purchasePrice = 10
```

Same for quantity change vs sale. Replay must preserve required order. Do not
fix ordering with delays, random retries, timeouts, or hoping the network
returns in order.

### Deduplication

Never collapse mutations only because they share `entityId`, endpoint, and
HTTP method. Different PATCH bodies are different business mutations.

```text
price = 10 → price = 20 → price = 30
```

must not collapse into the wrong final state. If coalescing is intentional,
the algorithm must preserve final state, required side effects, ordering, and
accounting implications.

---

## 8. Catalog, in-memory store, and RTK cache

`catalogProducts` is a projection, not the primary `products` table. Updating
`products` does **not** update catalog search by itself.

Whenever a product mutation changes identity, barcode, name, retail price,
purchase price, discount, average cost, or other catalog-search fields, update
the catalog projection.

IndexedDB being correct is not enough. If selling search reads
`productCatalogStore`, a successful mutation must update that in-memory store
too.

A common failure:

```text
products = new
catalogProducts = new
RTK cache = new
productCatalogStore = old   → selling search is stale
```

RTK cache is not `productCatalogStore`. Identify the actual consumer:

| UI | Reads |
| --- | --- |
| Buying search | RTK catalog query |
| Selling search | `productCatalogStore` → IndexedDB `catalogProducts` |

Updating `getProductCatalogQuery` does not update `productCatalogStore`.

---

## 9. Online and offline must converge

The same logical mutation must produce equivalent local state online and after
`offline → outbox → replay`.

Example: setting `purchasePrice` to 20 must converge on product state, catalog
state, average cost, search state, and profit implications after sync.

If the two paths calculate different results, the implementation is incomplete.

Local validation must not accept data the server will reject on replay (name
length, latinName length, non-negative prices, discount, barcode, required
fields, other product PATCH rules). If the server has a rule, the local path
must enforce it or refuse to queue the mutation.

Create and PATCH must not contradict each other. If PATCH rejects
`latinName > 100`, local create must not allow it and hope replay will fix it.

---

## 10. Cost, WAC, and frozen sale cost

`averageCost` is **not** automatically `purchasePrice`. WAC depends on existing
stock, opening stock, warehouses, buying invoices, transfer-in, cancelled
return-out, and the established business rules. Do not invent a second
calculation in a new feature.

Missing cost is **unknown**, never zero. Do not use `Number(cost ?? 0)` or
`Number(cost) || 0`. Valid finite cost is usable; missing/invalid cost is
unknown. Unknown cost must not silently make profit look better.

Use one `finiteCost` rule everywhere: server WAC, local WAC, catalog cost,
invoice COGS, profit, AI reports, optimistic calculations, offline summaries.
No local variants.

When calculating WAC:

- valid costs participate
- missing / invalid costs do not participate

Do not treat missing `averageCost` as `0`; that pulls WAC toward zero.

Once a sale is accepted/posted, its cost is frozen:

```text
purchasePrice = 10
sale stamps unitCost = 10
purchasePrice changes to 20
previous sale still uses unitCost = 10
```

Invoice PATCH must preserve existing line `unitCost`. A new line may receive a
new cost. Do not replace a stamped cost with the current product/catalog cost.

Test every invoice edit as:

```text
sale → product price change → invoice edit → profit calculation
```

An offline sale must not later recompute historical profit from whatever the
catalog contains after reconnect. Prefer a frozen sale-cost snapshot, or a
guaranteed ordering/dependency mechanism.

---

## 11. Profit

All profit consumers use one canonical definition: selling invoice summary,
best seller, offline profit summary, AI/reporting, dashboards, exports.

They must agree on revenue, sold quantity, COGS, current-sale movements,
frozen `unitCost`, missing-cost behavior, and reliability. Do not keep
independent implementations of the same business calculation.

| Input | Source |
| --- | --- |
| Sold quantity | Invoice lines |
| COGS / cost | Current sale movements |

Do not infer sold quantity solely from inventory movements. Do not sum every
movement with `type === "sale"`; historical edits, replacements, reversals, or
stacked changes double-count. Use `selectCurrentSaleMovings` (or its shared
equivalent).

Empty periods are reliable:

```text
no sales → revenue 0, COGS 0, profit 0, profitReliable = true
```

Missing/incomplete cost data is different: `profitReliable = false`. Do not
use `movings.length === 0` as the sole reliability test.

Display profit only when `profitReliable === true`. Do **not** use
`profitReliable !== false`; missing metadata would look reliable.

UI fallbacks must not invent accounting truth. Loading, empty, or unavailable
summaries must not set `profitReliable = true` and `totalProfit = 0` unless
the data source explicitly established that zero is the correct reliable
result. Unknown stays unknown.

---

## 12. Available quantity

One canonical `availableQuantity` rule, for example
`max(0, quantity - reserved)` if that is the established formula. Use the same
helper in server PATCH, atomic quantity updates, local offline mutation,
optimistic state, catalog aggregation, invoice search, and refetch.

If the frontend calculates `availableQuantity` optimistically and the server
stores/recomputes something else, refetch overwrites the optimistic state.
This must hold:

```text
optimistic result = server result = refetched result
```

Selling invoices may go below zero quantity only when the tenant invoice
setting `allowOversell` is true. That flag is stored on `InvoiceSettings` and
synced into Dexie `syncMeta`. When it is false, both the local POST handler and
`validateSaleInventory` / the atomic stock gate block the sale and the UI
shows an informational modal. Warehouse transfers stay gated either way.

---

## 13. Shared domain logic

Frontend offline code must not import server application modules to reuse a
helper. Extract environment-independent domain logic into a shared module that
does not depend on Node, Express, database clients, server controllers,
filesystem, or backend runtime state. Frontend and backend may both consume
that package.

Business-critical rules have one owner: `finiteCost`,
`availableQuantityFromStock`, `findOversellLines`, `selectCurrentSaleMovings`,
profit aggregation, WAC. Adapters are allowed. Duplicate business logic is not.

---

## 14. Before implementing a mutation

Write down the full state impact. Do not implement by changing only the
visible UI field.

**Source:** products? inventory?

**Projection:** catalogProducts? productCatalogStore? RTK cache?

**Accounting:** averageCost? unitCost? profit?

**Sync:** outbox? ordering? replay?

**Server:** PATCH endpoint? validation? derived fields?

Then answer online vs offline:

| | Online | Offline |
| --- | --- | --- |
| Immediate change | ? | ? |
| Local / cache update | ? | outbox payload |
| After refetch / replay | ? | reconnect + replay failure |
| If replay / server rejects | ? | ? |

Then answer failure:

- local row missing
- validation fails
- Dexie transaction fails
- projection update fails
- outbox write fails
- replay fails
- server rejects
- network changes during replay

Never leave failure behavior implicit.

---

## 15. PR review checklist

Any PR touching these areas must answer:

**Local state**

- Which source tables change?
- Which local projections change?
- Are all required tables in the Dexie transaction?
- Are indirect helper accesses included?

**Catalog**

- Does `catalogProducts` change?
- Does `productCatalogStore` change?
- Does RTK cache change?
- Which search path consumes each representation?

**Outbox**

- Does this mutation require an outbox entry?
- Is it atomically committed?
- Can it replay?
- Is ordering preserved?
- Can deduplication corrupt the mutation sequence?

**Inventory**

- Are quantity and reserved correct?
- Is `availableQuantity` from the canonical helper?
- Do server and refetch produce the same result?

**Cost**

- Does this affect purchase price or WAC?
- Is missing cost treated as unknown?
- Is `finiteCost` used?
- Could an existing sale’s cost change?

**Profit**

- Is sold quantity based on invoice lines?
- Is COGS based on canonical sale movements?
- Are historical movements excluded?
- Is `profitReliable` fail-closed (`=== true`)?
- Does an empty period return reliable zero?

**Invoice**

- Could an invoice PATCH remove `unitCost`?
- Are existing line costs preserved?
- Are new lines handled separately?

**Validation**

- Does local validation match server validation?
- Can offline data later fail during replay?

**Shared logic**

- Is business logic duplicated?
- Should it live in a shared domain module?
- Is frontend importing backend application code?

---

## 16. Tests

For every bug in this area, test the **state transition**, not only the
function return value:

```text
initial state
  → mutation
  → local persistence
  → projection
  → outbox
  → replay / refetch
  → final state
```

Where accounting is involved:

```text
initial cost → sale → cost change → invoice edit → reporting → final profit
```

Major mutations also need adversarial cases:

- Rapid edits: `10 → 11 → 12 → 13`
- Offline then online: mutation → reconnect → replay → refetch
- Online then offline: online mutation → offline mutation → reconnect
- Dependent order: `price change → sale` and `sale → price change`
- Invoice edit after price change: `sale → price change → invoice PATCH`
- Missing data: cost, inventory, catalog, `syncMeta`
- Failed persistence: projection, outbox, transaction

The system must never silently enter an inconsistent state.

---

## 17. Definition of done

A change in this area is complete only when:

- the architecture boundary is preserved
- local source state is correct
- all required projections are correct
- in-memory search state is correct
- RTK cache is correct where applicable
- outbox behavior and mutation ordering are correct
- online and offline paths converge
- server / refetch state matches local state
- validation matches server behavior
- cost / WAC behavior is correct
- existing sale costs remain frozen
- profit remains fail-closed
- no duplicate business rule was introduced
- Dexie transaction scope was audited
- regression tests cover the complete state transition
- this document is updated if the invariant or workflow changed

---

## 18. Golden rule

Before merging anything that touches product, inventory, catalog, invoice,
cost, profit, offline, or outbox, ask:

If this mutation happens offline, then the user edits the same data again,
then the device reconnects, then the catalog refreshes, then an invoice is
edited, will every representation still describe the same business state?

If the answer is not clearly yes, the implementation is not finished.

```text
ONE BUSINESS MUTATION
  → ONE CENTRAL LOCAL MUTATION BOUNDARY
  → SOURCE STATE
     + REQUIRED PROJECTIONS
     + OUTBOX
  → ORDERED REPLAY
  → SERVER BUSINESS RULES
  → RECONCILED LOCAL STATE
```

Mandatory accounting distinctions:

```text
UNKNOWN COST              ≠  ZERO COST
POSTED SALE COST          ≠  CURRENT PRODUCT COST
INVOICE QUANTITY          ≠  INVENTORY MOVEMENT QUANTITY
CURRENT SALE MOVEMENTS    ≠  ALL HISTORICAL SALE MOVEMENTS
EMPTY PERIOD              ≠  UNRELIABLE PROFIT
```

These are invariants, not implementation preferences.
