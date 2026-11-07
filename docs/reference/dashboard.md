# Tenant Dashboard (shipped)

`/dashboard` is a first-class tenant page. RIVO / Reports stays on its own
route; do not fold chat into Dashboard widgets.

Rules for every live money KPI: tenant isolation server-side, warehouse scope
via TopBar / `x-warehouse-scope`, reuse profit / cash / WAC helpers, missing
cost is partial never coerced to `0`, primary currency for money, online only.

Related: [`total-profit.md`](total-profit.md), [`cash-accounts.md`](cash-accounts.md),
[`warehouse.md`](warehouse.md). Remaining KPI / Owner work:
[`../backlog/dashboard.md`](../backlog/dashboard.md).

---

## Shell

- Sections: Overview, Sales & Profit, Inventory, Activity
  (`DASHBOARD_SECTIONS` in `shared/dashboardShell.ts`).
- Global date range defaults to start of month → today (`getDashboardDefaultDateRange`).
- Inventory section: optional supplier dropdown scopes best-seller / best-profit
  lists via `selling-invoices?supplierId=` (product.supplierId). Clear = unfiltered.
  Period sales / profit KPIs stay unscoped.
- KPI shell supports ready / loading / offline / unavailable / error / coming soon.

---

## Overview row (live)

Overview cards that read real data (not Coming Soon):

| Card | Source |
| --- | --- |
| Products | product count |
| Registered / new customers | customer list / period |
| Inventory cost | scoped inventory + cost rules |
| Invoices today | selling-invoice period summary |
| Sales today / Profit | same summary; profit uses `profitReliable` → UI `profitPartial` when incomplete |
| Total receivable / payable | party balances |
| Cash | live `GET cash-accounts/balances` (`CashPaymentsCard`); history route `/dashboard/cash-history` |

Profit stays visible when COGS is incomplete; the card is marked partial. See
[`total-profit.md`](total-profit.md).

---

## Still Coming Soon (backlog)

- Sales & Profit charts (`SALES_PROFIT_CHART_IDS`)
- Some inventory / activity list cards still shell-only depending on ticket
- SaaS Owner dashboard
- Moving invoice summary cards off Selling Invoices (`DASH-029` / `DASH-030`)

Full ticket list: [`../backlog/dashboard.md`](../backlog/dashboard.md).
