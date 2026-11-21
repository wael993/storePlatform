# Dashboard & RIVO — still open

Shipped shell + overview / cash / profit-partial KPIs:
[`../reference/dashboard.md`](../reference/dashboard.md).

Related: [`../reference/total-profit.md`](../reference/total-profit.md),
[`../reference/warehouse.md`](../reference/warehouse.md),
[`../reference/report-ai.md`](../reference/report-ai.md) (RIVO bugs + next tools).

**Product decision:** Tenant Dashboard is `/dashboard`. RIVO stays on its own
route. Do not fold RIVO into Dashboard as a widget.

Constraints for every remaining KPI ticket: same rules as the reference.

---

## Shipped (do not re-open)

| Id | What |
| --- | --- |
| DASH-001…003 | Shell, date filters, KPI component system |
| DASH-004 (partial) | Overview row live for core cards |
| DASH-009…014, 016, 017 (partial) | Products, customers, invoices/sales/profit today, inventory cost, receivable/payable, cash balances |
| DASH-006/015/018/019 | Live inventory / product cards and warnings |
| DASH-029 | Invoice summary on Dashboard (`InvoiceSummaryKpiCard`) |
Profit card always shows; incomplete COGS → `profitPartial` message
([`../reference/total-profit.md`](../reference/total-profit.md)).

---

## Still open — RIVO rename

### RIVO-001 — Rename Reports to RIVO

Chat title is RIVO; the nav label still says "Reports". Finish the rename (route may
stay; copy + branding only). Chat stays on its own page — see
[`../reference/report-ai.md`](../reference/report-ai.md).

---

## Still open — UI / charts

### DASH-005 — Sales & Profit visualization (real charts)

Replace Coming Soon chart shells (`SALES_PROFIT_CHART_IDS`) with real data.

### DASH-007 — Financial section polish

Cash period vs all-time toggle and any remaining financial card gaps beyond
live balances.

### DASH-008 / DASH-027 / DASH-028 — Activity

Recent activity + full activity view (pagination / filters only if architecture
already supports them).

---

## Still open — trends & comparisons

- DASH-020 Sales by Category  
- DASH-021 Sales Trend  
- DASH-022 Profit Trend  
- DASH-023 Sales by Month  
- DASH-024 Profit by Month  
- DASH-025 Period Comparison (equivalent prior window)  
- DASH-026 Profit Margin %  

One ticket per chart/KPI. Reuse existing aggregations; no parallel math.

---

## Still open — migration off Selling Invoices

### DASH-030 — Remove summary cards from Selling Invoices

DASH-029 shipped. Selling Invoices focuses on list/create/edit/post.

---

## Still open — SaaS Owner Dashboard

Separate epic. Do **not** mix into tenant Dashboard tickets.

- OWNER-001 Scope  
- OWNER-002 Shell  
- OWNER-003+ Owner KPIs  

---

## Security / architecture (still required)

### SEC-001 — Dashboard tenant isolation

Every Dashboard request scoped server-side: user → tenant → warehouses → SEE → KPI.

### SEC-002 — Dashboard ACL matrix

Document which existing SEE / permission each KPI needs.

### SEC-003 — Dashboard cross-tenant test suite

Prove Tenant A cannot see Tenant B across API, warehouse scope, permissions,
aggregations, combined mode.
