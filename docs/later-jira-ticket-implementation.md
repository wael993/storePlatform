# Later Jira ticket implementation

Tickets that are **not** for the current warehouse / barcode work. Implement later.

---

## SI-BUG-1 — Selling invoice Total Profit equals Period Sales (COGS never applied)

**Type:** Bug  
**Priority:** High  
**Labels:** selling-invoice, summary, profit, offline, backend, frontend  
**Implement:** later (do not mix into the current warehouse/barcode work)

### Summary

The **Total Profit** card on Selling Invoices is not profit. In most real data it shows **Period Sales** (sum of line revenue), sometimes **one display-unit higher** after rounding. Offline is always wrong. Online is wrong whenever sale cost is 0 or missing.

The card already has `TODO: Fix before Readding total profit card` in `InvoiceSummaryCards.tsx`. It was shown again before the math was fixed.

### Symptom

On Selling Invoices summary:

| Card | What it should be | What it is today |
|---|---|---|
| Period Sales | Σ invoice `grandTotal` in range | Correct |
| Total Profit | Σ (revenue − COGS) in range | ≈ Period Sales, often rounded up |

Also wrong for the same reason: **Top profit product**.

### Expected

For the selected date range (draft / cancelled / void / pending excluded, same as today):

```
totalProfit = Σ line revenue after discounts − Σ (qty sold × unit cost)
```

- Unit cost order (already documented on the API): `Inventory.averageCost` if it is a real cost (`> 0`), else `Product.price.purchasePrice`. **Never** the sale `unitPrice`.
- If a line has no cost basis: **do not treat cost as 0**. Exclude that line from the profit sum, or show `—` / “cost unknown”. Do not silently report revenue as profit.
- Invoice-level discount must come out of profit the same way it comes out of Period Sales.
- Online and offline must use the **same** formula and the same missing-cost rule.

### Root cause (traced)

Profit is `revenue - cogs`. **`cogs` is 0 in the common cases**, so `profit === revenue`. Revenue is the sum of line totals, which is almost Period Sales. Display rounding then makes it look like “sales, next number”.

**1. Offline — COGS is hardcoded unused**

`web/store-platform-frontend/src/offline/localHandlers.ts` → `buildSellingInvoicesSummary`

- Each line: `revenue += lineTotal` (or `qty * unitPrice`).
- Comment already says: *offline has no StockMoving COGS; qty/revenue only until sync.*
- `cogs` stays `0`.
- Then `profit = revenue - 0`.

Local inventory **does** have `averageCost`, and products have `purchasePrice`. The summary never reads them. There is no offline `StockMoving` store.

So offline Total Profit is **always** “sum of selling lines”.

**2. Online — same formula, COGS only if StockMoving.unitCost > 0**

`services/api-store-platform/src/apis/selling-invoice/api.controller.ts`

- Revenue: invoice lines (`getInvoiceLineRevenue`).
- COGS: `StockMoving` rows `type: 'sale'`, `referenceType: 'selling_invoice'`, `referenceId = invoiceId`.
- `cogs += quantity * unitCost`.
- `profit = revenue - cogs`.

`unitCost` is set at sale time by `resolveSaleUnitCost`:

1. If `inventory.averageCost` is not `null`/`undefined` and is finite → **use it, including `0`**.
2. Else `product.price.purchasePrice`.
3. Else log a warning and **write `0`**.

That fails in the usual shop data:

- Many products have no purchase price (there is already a “missing purchase price” digest).
- `averageCost === 0` (never purchased, import, or adjustment) **blocks** the purchase-price fallback because `0` is treated as a valid cost.
- Older invoices with no sale `StockMoving` → `cogs = 0`.
- Offline-created sales have no local COGS until sync; after sync they still get `unitCost: 0` if cost was missing at post time.

**3. Why it looks like “sales rounded to the next number” (not always exact sales)**

Two different sums:

| Field | Source |
|---|---|
| Period Sales (`todaySales`) | Σ `getPrimaryInvoiceCurrencyAmounts(invoice).grandTotal` |
| Profit revenue | Σ `lineTotal` (or `qty * unitPrice`) — **no invoice-level discount** |

So:

- No discounts, COGS 0 → profit ≈ sales, float leftovers (`10.1 + 10.2`) plus `formatDisplayAmount` → `Math.round` to cents (`currencyDisplay.ts`) plus `formatNumber` (0–2 decimals) push the shown value to the **next** unit.
- Invoice-level discount → Period Sales is lower; profit still uses full line totals → profit **above** sales.
- `calculateInvoiceTotals` with `useInvoiceDiscount` even rebuilds `grandTotal` from **pre-line-discount** subtotal, so the two cards can diverge more.

The UI only formats the number. The bug is the summary payload.

**4. AI profit is a third formula**

`reportAi/tools.ts` `profitSummary` uses `Σ grandTotal − Σ (stockMoving.qty * unitCost)`. The invoice card uses `Σ lineTotal − COGS`. After the fix, these must match.

### Files to change (later)

| Path | What |
|---|---|
| `web/store-platform-frontend/src/offline/localHandlers.ts` | `buildSellingInvoicesSummary`: compute COGS from local inventory / product; apply invoice discount; missing-cost rule |
| `services/api-store-platform/src/apis/selling-invoice/api.controller.ts` | `buildPeriodProductAggregates`, `resolveSaleUnitCost` (`0` is not a cost), invoice-discount in profit |
| `web/store-platform-frontend/src/components/SellingInvoice/InvoiceSummaryCards.tsx` | Remove the stale TODO after the fix; keep `—` when profit is unknown |
| `web/store-platform-frontend/src/components/SellingInvoice/invoiceApiMappers.ts` | Pass through only a real profit (or an explicit “unknown” flag if you add one) |
| Tests (none exist today) | API + offline summary profit |

Optional short-term (if this ships before the fix): hide the Total Profit card again. The TODO already said to do that.

### How to implement (do this, nothing extra)

**A. One cost helper, both sides**

```
resolveSaleUnitCost(averageCost, purchasePrice):
  if averageCost is a finite number AND averageCost > 0 → averageCost
  else if purchasePrice is a finite number AND purchasePrice > 0 → purchasePrice
  else → missing (not 0)
```

API: change `resolveSaleUnitCost` so `averageCost === 0` falls through. Offline: same helper; read `inventory.averageCost` then `product.price.purchasePrice` from the local Dexie catalog (already loaded for products). Do not add a StockMoving collection just for this card.

**B. Profit sum**

For each in-range, non-excluded invoice:

```
lineRevenue = Σ getInvoiceLineRevenue(item)
invoiceDiscount = primary currencyAmounts.discount (or stored invoice discount)
netRevenue = max(0, lineRevenue - invoiceDiscount)
cogs = Σ (qty * cost) for lines with a known cost
  (online: sale StockMoving.unitCost if > 0;
   offline: resolveSaleUnitCost per product)
```

If **any** sold qty in the period has missing cost: either drop those lines from both revenue and COGS and expose `profitIncomplete`, or set `totalProfit` null and show `—`. Pick one and use it on **both** cards (total + top product). Do not default missing cost to 0.

**C. New sale StockMovings**

Keep writing `unitCost` from the helper. After the `> 0` fix, new sales get a real cost when purchase price exists. Old rows with `unitCost: 0` still need the fallback at **summary** time (re-resolve from inventory/product), otherwise historical profit stays wrong.

**D. Display**

Keep `formatAmount`. Do not “fix” this by rounding in the card.

### Concrete examples (use as fixtures)

**Example 1 — offline, cost exists (today’s bug)**

- 1 line: qty 2, sell 50, `averageCost` 30, no discounts.
- Period Sales = 100.
- **Today:** Total Profit = 100.
- **Correct:** 100 − 60 = **40**.

**Example 2 — online, averageCost 0, purchasePrice 30**

- Same line. Sale moving stored `unitCost: 0` (current `resolveSaleUnitCost`).
- **Today:** Profit = 100.
- **Correct:** fallback to 30 → profit **40**. Summary-time fallback required for old movings.

**Example 3 — no cost anywhere**

- No `averageCost`, no `purchasePrice`.
- **Today:** Profit = 100 (looks like sales).
- **Correct:** `—` or exclude the line. Never 100.

**Example 4 — “rounded to next number”**

- Lines `33.33 + 33.33 + 33.34` = 100; stored `grandTotal` 99.99 (currency round-trip).
- COGS 0.
- **Today:** Sales 99.99 → `"99.99 ل.س"`; Profit 100 → `"100 ل.س"`.
- **Correct:** after real COGS, the two cards must not be “same money, different rounding”. If COGS is unknown, profit is `—`, not 100.

**Example 5 — invoice-level discount**

- Lines 100, invoice discount 10, COGS 40.
- Period Sales = 90.
- **Today:** Profit = 100.
- **Correct:** 90 − 40 = **50**.

### Acceptance

- [ ] Offline: profit uses local `averageCost` / `purchasePrice`; Example 1 returns 40.
- [ ] Online: `averageCost === 0` does not block purchase-price fallback; Example 2 returns 40 (including old `unitCost: 0` movings).
- [ ] Missing cost does not become profit = sales (Example 3).
- [ ] Invoice-level discount is in the profit base (Example 5).
- [ ] Period Sales unchanged.
- [ ] Top profit product uses the same line profit.
- [ ] AI `profitSummary` matches the invoice card for the same range.
- [ ] Tests: one API file + one frontend/offline file covering examples 1–3 and 5. No profit tests exist now.
- [ ] Remove the TODO on the card once the numbers are real.

### Out of scope

- Redesigning the summary cards.
- Adding an offline StockMoving table.
- Backfilling every historical `StockMoving.unitCost` in Mongo (summary-time fallback is enough).
- Changing how Period Sales is calculated.
- Tax (line tax is already hardcoded `0`).

### Test plan

1. Offline, product with `averageCost` 30, sell 50 × 2 → Profit 40, Sales 100.
2. Online, `averageCost` 0, `purchasePrice` 30, same sale → Profit 40.
3. Product with no cost → Profit `—` (or incomplete), Sales still 100.
4. Invoice discount 10, COGS 40 → Sales 90, Profit 50.
5. Same invoices online vs offline after sync → same profit (when cost is known).
6. Top profit product is not the highest *revenue* product if that product has no margin.

### Note until this ships

The card is misleading, not corrupting stock or money. Treat Total Profit as untrusted (or hide it again). Do not “fix” it by rounding in `InvoiceSummaryCards.tsx`.

---

## FE-NUM-1 — Amount inputs: thousand separators parsed as decimals

**Type:** Bug / tech debt  
**Priority:** Medium  
**Labels:** frontend, input, number-format, selling-invoice, daily-action  
**Implement:** later (hotfix already shipped on Quick Entry; do not mix into warehouse/barcode work)

### Summary

Live amount fields that display `mapFee` / `formatNumber` (en-US commas) and parse with `parseNumberValue` treat the last `,` as a **decimal**. Typing past `4,000` (e.g. `40000`) collapses the value to `4`.

Hotfix on Quick Entry: stop formatting the live input (`value={form.amount}`). Grouping is gone while typing. The shared parser is still wrong if the user types or pastes `4,000`.

### Symptom

1. Type `4000` in a live-formatted amount box → display `4,000`.
2. Type one more `0` (want `40000`) → value becomes `4`.

Same class of bug if the user pastes `40,000` into any `parseNumberValue` field.

### Expected

- Typing or pasting `40000` / `40,000` / `4,000` stores **40000** / **40000** / **4000**.
- Real decimals still work: `4.50`, `4,50` → `4.50`.
- Money fields may show grouping **after blur** (or in read-only). While focused, the value must stay parse-safe.
- Online and offline save the same numeric string via existing `formatNumberForDb`.

### Root cause (traced)

`toDotDecimal` in `web/store-platform-frontend/src/shared/numberParse.ts`:

- Last `,` or `.` is always the decimal. Comment already says: `2,511` (thousands) becomes `2.511`.
- `parseNumberValue(..., 2)` then keeps 2 fraction digits.

Loop when display uses `mapFee` (`toLocaleString('en-US')`):

| Typed | Shown | Next raw | Parsed |
|---|---|---|---|
| `4000` | `4,000` | — | `4000` |
| + `0` | — | `4,0000` | `4.0000` → `4.00` → shown as `4` |

Hotfix (Quick Entry only): `value={form.amount}` so the comma never re-enters the parser. `mapFee` import removed.

`InputLabel` is not the bug. It forwards `value` / `onChange`. Most other `InputLabel`s already pass raw numbers (Add Product prices, daily-action amount in `SecondStep.tsx`).

### Do not do this

- Do **not** render `EditableNumberField` inside `InputLabel` when `inputType === 'number'`. `EditableNumberField` is a click-to-edit **table cell**. `InputLabel` is an always-visible **form field** (debounce, clear, textarea, tooltips). Different UX.
- Do **not** `mapFee` every `InputLabel`. That recreates the loop wherever the parent also calls `parseNumberValue`.
- Do **not** switch money fields to HTML `type="number"`. Spinners, locale, and rejected commas.

### How to implement (do this, nothing extra)

**A. Fix the parser (required)**

In `toDotDecimal` / `parseNumberValue`: if the last separator is `,` and the digit count after it is **greater than** `maximumDecimals` (default 2), treat **all** `,` / `.` before the real decimal as thousands.

```
4,50     → 4.50     (2 digits, decimal)
4,000    → 4000     (3 digits > 2, thousands)
4,0000   → 40000
40,000   → 40000
1,234.56 → 1234.56  (last sep is `.`)
1.234,56 → 1234.56  (last sep is `,`, 2 digits)
```

Pass `maximumDecimals` into `toDotDecimal` (or apply the rule inside `parseNumberValue` only). `formatNumber` also calls `toDotDecimal` on strings — keep that consistent.

**B. Optional money mode on InputLabel (only if you want commas back while using the form)**

Add an opt-in prop, e.g. `isAmount`. Behavior:

- Focused: show raw `parseNumberValue` string (no grouping).
- Blur / read-only: show `formatNumber` / `mapFee`.
- `onChange` still emits the **raw** parsed string, never `4,000`.

Reuse `formatNumber` + `parseNumberValue`. No new component. Do not use `EditableNumberField`.

Call sites that want grouping: Quick Entry amount, later any other money `InputLabel`. Leave names, barcodes, qty, notes as they are.

**C. One test file**

`web/store-platform-frontend/src/test/numberParse.test.ts` (or next to `numberParse.ts`). No tests exist today.

### Files to change (later)

| Path | What |
|---|---|
| `web/store-platform-frontend/src/shared/numberParse.ts` | thousands vs decimal rule; keep max-decimals trim |
| `web/store-platform-frontend/src/shared/utils.ts` | `formatNumber` / `formatNumberForDb` stay wrappers; no second parser |
| `web/store-platform-frontend/src/components/common/InputLabel.tsx` | optional `isAmount` blur/focus format only if doing B |
| `web/store-platform-frontend/src/components/SellingInvoice/QuickEntryModal.tsx` | turn `isAmount` on if B ships; keep hotfix until then |
| `web/store-platform-frontend/src/test/numberParse.test.ts` | new |

Read-only `mapFee` on cards / lists (`BudgetOverview`, `DailyPage`, `DailyActionItem`) is display-only. Leave it.

### Concrete examples (use as fixtures)

**Example 1 — hotfix already covers (live format loop)**

- Type `40000` one digit at a time in Quick Entry.
- **Before hotfix:** becomes `4`.
- **After parser fix + optional grouping:** stored `40000`, may display `40,000` on blur.

**Example 2 — typed / pasted grouping**

- Paste `4,000` meaning four thousand.
- **Today (even after hotfix):** `4.00`.
- **Correct:** `4000`.

**Example 3 — real decimal**

- Type `4,50` or `4.50`.
- **Correct:** `4.50`. Must not become `450`.

**Example 4 — mixed**

- `1.234,56` → `1234.56`. `1,234.56` → `1234.56`.

### Acceptance

- [ ] `parseNumberValue('4,0000', 2)` → `'40000'` (not `'4.00'`).
- [ ] `parseNumberValue('4,000', 2)` → `'4000'`.
- [ ] `parseNumberValue('4,50', 2)` / `'4.50'` → `'4.50'`.
- [ ] Quick Entry: type `40000`, save, stored amount is 40000 (`formatNumberForDb`).
- [ ] Paste `40,000` in Quick Entry → 40000.
- [ ] Product / qty / name `InputLabel`s unchanged (no click-to-edit, no auto commas).
- [ ] Tests cover examples 2–4. No `numberParse` tests exist now.

### Out of scope

- Replacing `InputLabel` with `EditableNumberField`.
- Auto-formatting every `InputLabel`.
- Changing HTML `type="number"` on Add Product / daily-action fields (separate, not this bug).
- Backend number parsing.
- Redesigning invoice table inline edit.

### Test plan

1. Quick Entry: type `400`, `4000`, `40000`, `400000` — none collapse to `4`.
2. Paste `4,000` and `40,000` — stored 4000 and 40000.
3. Type `4.5` and `4,50` — stored 4.50.
4. Add Product retail price / stock qty still type normally.
5. Daily-action amount (`SecondStep`) still saves via `formatNumberForDb`.
6. View an existing 40000 entry — number is 40000 (grouped only if `isAmount` shipped).

### Note until this ships

Quick Entry hotfix is enough to type large amounts. Do not “fix” grouping by putting `mapFee` back on `value`. Treat pasted `4,000` as untrusted until the parser change lands.

---

## FE-OFF-1 — Review pending offline changes (not just a count)

**Type:** Feature  
**Priority:** Medium  
**Labels:** frontend, offline, outbox, ux  
**Implement:** later (do not mix into the current warehouse/barcode work)

### Summary

While offline, the banner only says *“Working offline. N change(s) waiting to sync.”* The user cannot open that number and see **what** those changes are (new product, daily entry, selling invoice, etc.).

The Dexie outbox already stores every pending mutation with `entity`, `operation`, `payload`, `createdAt`, and `status`. The UI never lists it.

### Symptom

1. Switch to offline work mode.
2. Add a product, a daily action, a selling invoice (or any mix).
3. Banner shows `Working offline. 3 change(s) waiting to sync.`
4. There is no way to browse those 3 items. Same gap on the online “N change(s) pending sync” banner.

### Expected

From the banner (offline **and** the online pending-sync banner), the user can open a **read-only list** of unsynced outbox rows and see, for each:

| Column | Source |
|---|---|
| What | Translated `entity` (`invoice`, `product`, `dailyAction`, …) |
| Action | Translated `operation` (`create` / `update` / `delete`) |
| Title | Human label from the payload (invoice number, product name, entry type + amount, …) |
| When | `createdAt` |
| Status | `pending` or `failed` (`lastError` under failed rows) |

Newest first. Empty list if `pendingCount === 0`. List updates live when the outbox changes.

Tapping a row **may** navigate to the existing screen for that record (invoice / product / daily page). That is optional. The list itself is required.

### Root cause (traced)

`getPendingOutboxCount()` in `web/store-platform-frontend/src/offline/db.ts` only counts `outbox` rows with `status` `pending` or `failed`.

`useOfflineSync` / `OfflineState` expose `pendingCount` only. `OfflineSyncBanner` interpolates that into `offline.workingOffline` / `offline.pendingChanges`. No hook reads `offlineDb.outbox`.

Each `OutboxEntry` already has everything a review list needs (`types.ts`):

- `entity`: `invoice` \| `buyingInvoice` \| `product` \| `dailyAction` \| `customer` \| `supplier` \| `expense` \| … (full `OutboxEntity`)
- `operation`: `create` \| `update` \| `delete`
- `payload`: the mutation body (invoice number, product name, `entryType`, etc.)
- `createdAt`, `status`, `lastError`

`subscribeOutboxChanges` already exists in `localStore.ts`. Sync already reads the same table in `syncService.ts`. Nothing new to persist.

### How to implement (do this, nothing extra)

**A. List pending outbox rows**

Add `getPendingOutboxEntries()` next to `getPendingOutboxCount` in `db.ts`:

```
offlineDb.outbox
  .where('status').anyOf(['pending', 'failed'])
  .reverse()   // createdAt index already exists
  .sortBy('createdAt')
```

Return `OutboxEntry[]`. Do not copy payloads into a second store.

**B. One title helper**

Small function, e.g. `getOutboxEntryTitle(entry)` — switch on `entity`, read the payload, fall back to `entity` + `operation` if the field is missing. No new types.

| entity | Title from payload |
|---|---|
| `invoice` | `#{{invoiceNumber}}` + customer name if present |
| `buyingInvoice` | `#{{invoiceNumber}}` + supplier name if present |
| `product` | `name` |
| `dailyAction` | `entryType` + amount / note (same labels as Daily page) |
| `customer` / `supplier` / `partner` / `expense` / `category` / `brand` / `shelf` / `warehouse` | `name` |
| `inventory` / settings / `currency` / `unit` | translated entity name is enough |

**C. Review UI from the banner**

Reuse the `SyncConflictModal` pattern (Chakra modal, i18n). New `PendingChangesModal` (or the same file if it stays small).

Entry points — both banners that already show the count:

- Offline: `offline.workingOffline` in `OfflineSyncBanner.tsx`
- Online pending: `offline.pendingChanges` (same file)

A “Review” / “View” button, or make the count text a button. Do not add a new page or route.

Subscribe with `subscribeOutboxChanges` so the list matches `pendingCount`.

**D. i18n**

Add keys under `offline` in `en` / `ar` / `de`: modal title, Review button, entity labels, operation labels, empty state, failed + `lastError`. Do not invent a second copy of Daily/Invoice names if those keys already exist.

### Files to change (later)

| Path | What |
|---|---|
| `web/store-platform-frontend/src/offline/db.ts` | `getPendingOutboxEntries()` |
| `web/store-platform-frontend/src/offline/index.ts` | re-export if needed |
| `web/store-platform-frontend/src/components/OfflineSyncBanner.tsx` | Review button on both count banners |
| `web/store-platform-frontend/src/components/PendingChangesModal.tsx` | new, list only — mirror `SyncConflictModal` |
| `web/store-platform-frontend/src/i18n/{en,ar,de}/translation.json` | `offline` keys |
| Title helper: next to the modal or a 20-line fn in `offline/` | payload → label |

Do **not** change `OutboxEntry`, sync push, or local handlers. The data is already written.

### Concrete examples (use as fixtures)

**Example 1 — mixed offline work**

- Offline: add product “Tea 500g”, add a selling invoice `#1042`, add an expense entry 50.
- Banner: `Working offline. 3 change(s) waiting to sync.`
- Review list (newest first):

| What | Action | Title |
|---|---|---|
| Daily action | Create | Expense · 50 |
| Selling invoice | Create | #1042 |
| Product | Create | Tea 500g |

**Example 2 — failed row**

- One invoice create failed (`status: 'failed'`, `lastError` set).
- It still appears. Status = failed. Show `lastError` under the row.

**Example 3 — count matches list**

- Banner says 3. Modal has 3 rows. After a successful push, both are 0 / empty.

### Acceptance

- [ ] Offline banner: with `pendingCount > 0`, user can open a list of those changes.
- [ ] Online “pending sync” banner: same list.
- [ ] Each row shows entity, operation, title, time, status.
- [ ] Titles are readable for invoice, buying invoice, product, daily action (the common shop work). Other entities at least show translated type + operation.
- [ ] Failed rows show `lastError`.
- [ ] List count equals `pendingCount` (`pending` + `failed` only; not `processing` / `completed`).
- [ ] `en` / `ar` / `de` all have the new strings.
- [ ] No new Dexie table. No discard / edit / retry-per-row in this ticket.

### Out of scope

- Discarding or editing a pending change.
- Per-row retry (banner Retry already retries the whole push).
- Redesigning sync, conflicts, or `SyncConflictModal`.
- A dedicated `/offline-changes` page.
- Showing locally edited catalog rows that never went through the outbox (if that can happen, it is a different bug).

### Test plan

1. Offline: create a product, a selling invoice, a daily entry → Review shows all three with correct titles.
2. Close and reopen the modal → same three (Dexie, not React state).
3. Go online, push → list empty, count 0.
4. Force one failed outbox row → it appears with the error text.
5. Online banner with leftover pending rows → Review still works.
6. `pendingCount === 0` → no Review action, or empty state if opened.

### Note until this ships

The count is trustworthy. Users who need to know *what* they queued must remember it or wait for sync. Do not “fix” this by putting raw payloads in the banner text.
