# Report AI (RIVO)

How the shipped Reports chat assistant works, what it can answer today, what
will be added later, and known bugs with how to fix them.

Code: `services/api-store-platform/src/shared/reportAi/`,
`apis/report/` (`POST …/reports/chat`, `GET …/reports/watch`),
FE `pages/ReportPage.tsx`, RTK `postReportChat` / `getReportWatch`.

Related: [`total-profit.md`](total-profit.md), [`warehouse.md`](warehouse.md).
Ticket-style backlog copy: [`../backlog/report-ai.md`](../backlog/report-ai.md).

---

## User flow

```text
/reports (tenant page REPORTS + SEE.reports)
  → empty state: GET reports/watch → “RIVO is watching” bullets
  → user sends question → POST reports/chat { messages } → { reply }
```

**Online only.** Chat/watch are excluded from offline handlers (no outbox).

**Auth:** JWT → `authorizationValidator` → tenant page `REPORTS` →
`ensureSeeForResource(REPORTS)`. Each tool also checks `TOOL_SEE` /
`canRunReportTool`; cost/profit fields need `SEE.productsBuyingPrice`.

**Provider:** `AI_REPORT_PROVIDER` = `mock` (default) | `openai` | `gemini`.
Live models: `rivoSystemPrompt` + tool loop (≤4 rounds). Mock: keyword intent
in `intent.ts` then one tool.

**FE:** Client-only chat history (last 16 turns sent each request). Watch only
on empty chat. i18n `report.chat.*`. Example chips: watch / today sales /
profit / outstanding.

**Caps:** 16 messages, 4k chars/message, ≤400-day span, ≤5k invoices/query.
Periods are UTC calendar days today (see bugs).

---

## What RIVO can answer today

Only these tools return real numbers. Everything else is refuse / clarify /
persona (identity, off-topic, language switch).

| Tool | Example questions |
| --- | --- |
| `salesSummary` | How much did I sell today / this month? |
| `topSellingProducts` | What are my best sellers? |
| `profitSummary` | What was my profit last month? |
| `purchaseSummary` | How much did I buy? Spend with supplier X? |
| `topSuppliers` | Who did I buy most from? |
| `topCustomersByOutstanding` | Who still owes me? |
| `businessWatch` | What should I pay attention to? (low stock, sales/profit Δ, unpaid) |

**Also works as UX (not tools):** greetings → watch; insults handled calmly;
unauthorized tool → “صلاحياتك ما بتسمحلي…” (when live model follows prompt).

**Does not answer with data today** (prompt may mention some of these — do not
invent numbers): product lookup by name/barcode, total stock qty/value, cash
drawer, expenses, best customers by sales, one customer balance, supplier
payables, category sales, employees, single invoice lookup, write/edit actions.

---

## What will be added (future features)

Prefer new tools over a longer prompt. Keep **read-only** until write tools are
explicitly wanted. When a tool ships, move it into “can answer today” above.

| Planned tool / change | Unlocks |
| --- | --- |
| `productLookup` | Do we have product X? Price / barcode |
| `stockLevels` | Qty / low / zero for a product or list |
| `inventorySummary` | **Total available product amount** — sum of `quantity` / `availableQuantity`; optional **stock value** `Σ qty × averageCost` (gate value with `SEE.productsBuyingPrice`; missing cost → partial, not 0) |
| `cashSummary` | Cash / drawer for a period (same rules as selling-invoice cash UI) |
| `expenseSummary` | Daily expenses |
| `topCustomersBySales` | Best customers by revenue (not debt) |
| `customerBalance` | One customer: owed + recent sales |
| `supplierPayable` | What we owe suppliers |
| Extend sales/profit tools | Filter by customer / product / barcode; worst sellers; sort by revenue |
| `salesByCategory` | Which category sells |
| Later | `invoiceLookup`, `comparePeriods`, light `employeeSummary` |

**Soft (with tools):** example chips for cash/stock/inventory value; prompt lists
only tools that exist; teach multi-tool turns (already ≤4 rounds).

**Out of scope for now:** create/edit/delete from chat (invoices, stock adjust).

**How to add a tool:** `ReportToolName` + `TOOL_SEE` + `TOOL_SPECS` +
`tools.ts` impl + mock keyword (`pickMockTool` / intent) + update this doc.

Suggested build order: productLookup → stockLevels → inventorySummary →
cash/expense → customers/suppliers → filters / category → later items.

---

## Known bugs and how to fix

Do not block first capability tools on these unless the new tool must be
warehouse-scoped from day one (prefer one shared scope helper).

### RA-BUG-1 — Warehouse ACL / working scope ignored (Critical)

**Problem:** Tools use `withTenantScope(…, tenantId)` only.
`buildRequestContext` already sets `warehouseScope` from `x-warehouse-scope`,
but `postReportChat` / `getReportWatch` never pass it into `runReportTool`.

**Impact:** A user limited to warehouse A who can open Reports sees sales,
profit, outstanding, and low stock for **all** warehouses — unlike dashboard
cards in [`warehouse.md`](warehouse.md).

**How to fix:**

1. Pass `RequestContext` (or resolved warehouse ids) from
   `ReportController` into `analyzeBusinessQuestion` / `runReportTool`.
2. In `tools.ts` loaders (`loadSales`, `loadPurchases`, `loadOutstandingSales`,
   `lowStock`, sale movings), filter `warehouseId` by ACL ∩ working scope
   (reuse `warehouseAccess` helpers used by invoice lists).
3. Empty ACL for non-owner → empty aggregates / empty watch items.
4. Owner / unrestricted with no header → all warehouses (same as other reads).
5. Add tests: restricted user cannot see other warehouse totals.

### RA-BUG-2 — Expired subscription blocks chat (High)

**Problem:** `POST reports/chat` hits `isWriteBlockedWhileExpired`. Chat is
read-only analysis; `GET reports/watch` still works when expired.

**Impact:** Expired tenants can read the app but RIVO chat returns 403.

**How to fix:** Exempt path `reports/chat` from write-while-expired in
`tenantPageAccess.ts` (or treat chat as a read). Keep real mutations
(`POST/PATCH/DELETE` on invoices, products, etc.) blocked. Confirm watch +
chat both work on expired subscription in a manual check.

### RA-BUG-3 — Default mock returns raw JSON for business answers (High)

**Problem:** `AI_REPORT_PROVIDER` defaults to `mock`. Watch replies are
formatted (`formatMockWatch`); business intents dump
`JSON.stringify({ tool, result })` into the chat bubble.

**Impact:** Anyone on default mock sees unusable business answers.

**How to fix:** Add formatters for each tool result (same tone as
`formatMockWatch`), or fail fast in non-dev if provider is still `mock`.
Update mock `pickMockTool` when new tools land.

### RA-BUG-4 — “Today” / periods are UTC (Medium)

**Problem:** `periodFromArgs` and mock “today” use `toISOString().slice(0, 10)`
(UTC). Prompt mentions `config.cron.timezone` but tools ignore it.

**Impact:** Near local midnight, “today’s sales” disagree with the invoices UI.

**How to fix:** Derive YMD start/end in `config.cron.timezone` (shared helper);
use that in `periodFromArgs`, mock today, and `businessWatch` windows.

### RA-BUG-5 — Top products revenue ≠ sales summary (Medium)

**Problem:** `topSellingProducts` sums line `lineTotal` / qty×unitPrice;
`salesSummary` uses primary `currencyAmounts.grandTotal` (discounts/fees).

**Impact:** “Best sellers revenue” can disagree with “period sales”.

**How to fix:** Align product revenue with the same primary-currency line/invoice
rules as selling-invoice summary / `getPrimaryInvoiceCurrencyAmounts`.

### RA-BUG-6 — No usage quota / rate limit on chat (Medium)

**Problem:** Unlike invoice AI (`invoiceAi/usage`), `reports/chat` has no
monthly cap or rate limit.

**Impact:** Unbounded OpenAI/Gemini cost for any Reports-capable user.

**How to fix:** Mirror invoice AI: per-tenant monthly counter + optional
express rate limit on `POST reports/chat`. Return a clear error when over
quota.

### RA-BUG-7 — No automated tests (Medium)

**Problem:** No tests for intent, tools, SEE gates, chat validation, or watch.

**How to fix:** Small assert-style tests: `classifyRivoIntent`,
`canRunReportTool` unauthorized, chat rejects empty/non-user last message,
warehouse filter once RA-BUG-1 lands, one mock watch shape check.

---

## Prompt vs reality

`rivoSystemPrompt` / identity copy mention cash, employees, inventory analysis,
etc. **Numbers only come from tools in “can answer today”.** Until future tools
ship, models must refuse or ask — never invent. Trim the prompt to match
shipped tools when editing persona text.
