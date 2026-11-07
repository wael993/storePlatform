# Later tickets (detailed)

Tickets that are **not** current merge work. Short product backlog:
[`product.md`](product.md). Profit **rules**:
[`../reference/total-profit.md`](../reference/total-profit.md).

Shipped / do not re-open:

- Selling invoice Total Profit (old “profit ≈ period sales”) →
  [`../reference/total-profit.md`](../reference/total-profit.md)
- Party FX summaries + opening balance →
  [`../reference/party-activity.md`](../reference/party-activity.md)
- Cash accounts offline / transfers →
  [`../reference/cash-accounts.md`](../reference/cash-accounts.md)
- Master-data delete (online + block reasons) →
  [`../reference/master-data-delete.md`](../reference/master-data-delete.md)

---

## FE-NUM-1 — Amount inputs: thousand separators parsed as decimals

**Type:** Bug / tech debt  
**Priority:** Medium  
**Labels:** frontend, input, number-format, selling-invoice, daily-action  
**Implement:** later (hotfix already shipped on Quick Entry)

### Summary

Live amount fields that display `mapFee` / `formatNumber` (en-US commas) and
parse with `parseNumberValue` treat the last `,` as a **decimal**. Typing past
`4,000` (e.g. `40000`) collapses the value to `4`.

Hotfix on Quick Entry: stop formatting the live input (`value={form.amount}`).
The shared parser is still wrong if the user types or pastes `4,000`.

### Expected

- Typing or pasting `40000` / `40,000` / `4,000` stores **40000** / **40000** / **4000**.
- Real decimals still work: `4.50`, `4,50` → `4.50`.
- Money fields may show grouping **after blur**. While focused, stay parse-safe.

### How to implement

In `toDotDecimal` / `parseNumberValue`
(`web/store-platform-frontend/src/shared/numberParse.ts`): if the last separator
is `,` and digits after it are **greater than** `maximumDecimals` (default 2),
treat earlier `,` / `.` as thousands.

Optional: `InputLabel` `isAmount` prop (raw while focused, grouped on blur).
Do **not** wrap `EditableNumberField` inside `InputLabel`.

Add `web/store-platform-frontend/src/test/numberParse.test.ts`.

### Acceptance

- [ ] `parseNumberValue('4,0000', 2)` → `'40000'` (not `'4.00'`).
- [ ] `parseNumberValue('4,000', 2)` → `'4000'`.
- [ ] `parseNumberValue('4,50', 2)` / `'4.50'` → `'4.50'`.
- [ ] Quick Entry: type / paste large grouped amounts store correctly.
- [ ] Product / qty / name `InputLabel`s unchanged.

### Out of scope

Replacing `InputLabel` with `EditableNumberField`; HTML `type="number"`;
backend parsing. Broader EU formatter / `Fee` component is **FE-MONEY-1** below.

---

## FE-MONEY-1 — Shared `Fee` component + EU money formatting

**Issue type:** Story  
**Labels:** `frontend`, `money-formatting`, `shared-component`, `tech-debt`

### Summary

Introduce a reusable `Fee` component and shared money utilities to standardize
monetary display and editing. Migrate invoice, summary, and daily/list money
fields incrementally. Preserve currency conversion, storage, calculation, and
API behaviour.

Align parsing with **FE-NUM-1**. Do not invent a second FX path.

### Goals

- Shared EU-style formatting (e.g. `10.000,5`, `1.000,12`, `1.000`).
- `Fee` modes: `readOnly`, `editable` (inline draft), `input` (parent-owned draft).
- Default `maximumDecimals = 2`; omit useless trailing fractional zeros.
- `Fee` never resolves currency IDs or performs FX; caller owns conversion.

### Phases

0. Utilities + `Fee` + tests (no broad UI migration).  
1. Reference integrations: invoice tooltip / Quick Entry amount.  
2. Broader daily/list/product migrations by area.

### Acceptance (abbrev.)

- [ ] Canonical EU formatting + shared parse/sanitize/validate.
- [ ] Inline: Enter/blur commit, Escape cancel; no keystroke regrouping.
- [ ] Form mode does not auto-`onCommit` on blur.
- [ ] No storage-model or silent calculation changes.
- [ ] Invoice edits still convert display → primary via existing helpers.

### Out of scope

Product prices in Default Invoice Currency; backend FX; tenant number-locale
setting; percentage discounts as `Fee`.

**Related open item:** display all fees in default (invoice) currency — do with
or after this component, without changing stored amounts.

---

## FE-OFF-1 — Review pending offline changes (not just a count)

**Type:** Feature  
**Priority:** Medium  
**Labels:** frontend, offline, outbox, ux  

### Summary

Offline / pending-sync banners only show a count. Dexie outbox already has
entity, operation, payload, `createdAt`, status. Add a read-only review modal
from both banners.

### Do

- `getPendingOutboxEntries()` next to `getPendingOutboxCount` in `offline/db.ts`
- Title helper from payload (invoice #, product name, …)
- `PendingChangesModal` from `OfflineSyncBanner` (mirror `SyncConflictModal`)
- i18n `en` / `ar` / `de`

### Acceptance

- [ ] Review list for offline + online pending banners.
- [ ] Rows: entity, operation, title, time, status (+ `lastError` if failed).
- [ ] Count matches `pending` + `failed` only.
- [ ] No new Dexie table; no discard / per-row retry in this ticket.

---

## INV-SET-1 — Store invoice logo/QR via object storage (not Base64)

**Type:** Tech debt / architecture  
**Priority:** Low  

### Goal

Upload logo/QR to object storage; API/DB store URLs only. Migrate existing
Base64 values. Keep PDF/header rendering working.
