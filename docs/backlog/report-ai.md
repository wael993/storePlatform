# Report AI (RIVO) — later tickets

Canonical detail (what works, what will be added, bugs + how to fix) lives in
[`../reference/report-ai.md`](../reference/report-ai.md).

This file is a short index for planning. Prefer the reference when
implementing.

---

## Bugs (see reference for how to fix)

| Id | Severity | One-liner |
| --- | --- | --- |
| RA-BUG-1 | Critical | Warehouse ACL / working scope ignored in tools |
| RA-BUG-2 | High | Expired subscription blocks `POST reports/chat` |
| RA-BUG-3 | High | Default mock dumps JSON for business answers |
| RA-BUG-4 | Medium | Period “today” is UTC, not cron timezone |
| RA-BUG-5 | Medium | Top-product revenue ≠ sales summary grandTotal |
| RA-BUG-6 | Medium | No chat usage quota / rate limit |
| RA-BUG-7 | Medium | No automated tests |

## Future features (see reference for build order)

`productLookup` → `stockLevels` → `inventorySummary` (total qty + optional
stock value) → `cashSummary` / `expenseSummary` → customer/supplier tools →
extend sales filters / `salesByCategory` → later invoice compare / employees.

Read-only until write tools are explicitly requested.
