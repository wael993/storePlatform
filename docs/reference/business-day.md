# Business day (time zone)

A calendar day `YYYY-MM-DD` means **midnight to midnight in the business time zone**, whatever zone
the server (Render = UTC) or the device runs in. "Today" = the business-zone date of now.

| Where | Setting | Default |
| --- | --- | --- |
| API | `BUSINESS_TIME_ZONE` (IANA name; invalid → API refuses to start) | `Asia/Amman` |
| Web | `VITE_BUSINESS_TIME_ZONE` (build time; invalid → console error + default) | `Asia/Amman` |
| Cron / backups / subscriptions | `CRON_TIMEZONE`, falls back to `BUSINESS_TIME_ZONE` | `Asia/Amman` |

The two settings **must be equal**. Change both, or neither.

## One helper

`packages/store-domain/src/businessDay.ts` (mirrored into the API by `npm run sync-domain`):
`businessDayKey`, `toBusinessDayKey`, `businessDayStart`, `businessDayEnd`, `isDayKey`, `isValidTimeZone`.
No `setHours` / `getDate()` / `new Date(y, m, d)` day math anywhere else.

## Uses it

| Feature | API | Web (offline mirror / default) |
| --- | --- | --- |
| Today's Actions (entries) `invoiceDateFrom/To` | `getInvoiceDateBoundary` (`api.controller.ts`) | `offline/dailyActionFilters.ts` |
| Today's Actions (warehouse movements) | same helper | online only |
| Today's Actions default day | – | `InvoiceTableSection.tsx` |
| Selling / buying list `issuedDate` | selling + buying controllers | `offline/localHandlers.ts` |
| Selling summary `dateFrom/To` | `parseSummaryDateRange` | `parseSummaryDateRange` (localHandlers) |
| Buying summary "today" | `buildBuyingInvoicesSummary` | `buildBuyingInvoicesSummary` (localHandlers) |
| Cash ledger `dateFrom/To` | `parseLedgerDateBound` | online only |

A full date string (not `YYYY-MM-DD`) stays an exact instant in the filters and the cash ledger. The selling summary
maps it to its business day.

## Not (yet) on it

- **Saving**: forms build `issuedAt` / `invoiceDate` from the device's date + time (`shared/dateUtils.ts`), and lists show
  device-local times. Stored values are real instants, so they are correct. On a device outside the business zone,
  an entry saved near midnight can appear under the neighbouring business day.
- RIVO report tools (UTC days, RA-BUG in [report-ai.md](report-ai.md)), dashboard "new customers" count,
  offline-retention cutoffs.
