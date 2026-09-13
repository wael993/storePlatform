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
