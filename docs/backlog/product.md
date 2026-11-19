# Product / nav — still open

Backlog only. Titles + short scope.

Shipped (see reference, do not re-open):

- Product Excel import master-data + field selection →
  [`../reference/product-import.md`](../reference/product-import.md)
- Remove old Daily page → cash on selling-invoices + party modals
  ([`../reference/party-activity.md`](../reference/party-activity.md))
- Docs under gitignored `docs/`

Superseded:

- “Move Selling Invoice Summary to Report page” → Dashboard
  ([`dashboard.md`](dashboard.md) **DASH-029** / **DASH-030**)
- One-shot “what’s new” popup → [`newsroom.md`](newsroom.md)

---

## 2 — Rename TopBar “Invoices” nav to “Daily”

Rename the invoices option in the TopBar nav select (`TopBar.tsx` + i18n) to
**Daily**. Same route/target for now. Label and breadcrumb copy only.

---

## 5 — Unit exchange (nested product units)

Support converting quantity across nested units, e.g. ton → kg → g, or m → cm,
or carton → pack → piece. Stock, invoice lines, and display must agree on the
same chain.

---

## 7 — Bulk update in product table

Select many product rows and apply one update (price, category, active, unit,
etc.) with clear success/failure per row. Respect existing edit permissions.

---

## 8 — Optimistic UI updates

Optimistic updates for common mutations via existing RTK Query
`onQueryStarted` / cache patch patterns. Highest-traffic writes first; avoid
double-writes with offline handlers.

---

## 9 — Return product or replace

Selling-invoice flow to return or replace a sold product (stock + money /
credit path). Reuse existing inventory and cash posting rules; do not invent a
second COGS model. Spec before code.

---

## Import follow-ups (product-import reference)

0a. Multi-column barcodes (Barcode 1…N)  
0b. Qty unparseable → error vs coerce-0  
0c. Currency strip from tenant settings; Arabic digits  
0d. Parse→commit integration test with `$` Excel cells  

---

## Profit follow-ups (titles only)

Rules stay in [`../reference/total-profit.md`](../reference/total-profit.md).

21. Explicit inventory cost adjustment for established WAC  
22. Profit by warehouse, cashier, and customer  
23. Profit in display currency (display only; COGS/revenue stay primary)  
24. Include tax in profit (or exclude it consistently in the UI label)  
25. FIFO / specific identification option (alternative to WAC)  
26. Cancelled-purchase WAC unwind  
27. Holding-gain report (catalog purchasePrice vs WAC)  
28. Date-range comparison / sparkline for profit  
29. Treat transfer-in as established cost offline  
30. Gross margin % card  
31. Per-invoice profit on invoice detail / PDF  
32. Legacy cost-currency migration  
