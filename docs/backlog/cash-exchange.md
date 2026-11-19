# Cash currency exchange (Quick Entry)

Three dependent tickets. Do **not** treat this as a UI-only change on Transfer:
cash transfers move the **same** currency between accounts; exchange debits one
currency and credits another **inside one** cash account.

Shipped cash transfer / offline balances:
[`../reference/cash-accounts.md`](../reference/cash-accounts.md).

**Order:** CASH-EX-1 first → CASH-EX-2 and CASH-EX-3 in parallel after the API
contract is stable.

**Keep visible while building**

1. Offline balance consistency — pending exchanges must chain on the updated
   local snapshot, not the original server balance (no double-spend).
2. Rate snapshot consistency — persist rate + converted amount at create time;
   sync must not recalculate with newer settings rates.
3. Atomic ledger posting — source debit + target credit are one transaction,
   including offline replay.

---

## Contract decisions (lock before / on day 1 of CASH-EX-1)

These close the gaps that would otherwise cause rework. Defaults below match
existing Transfer / cash-ledger patterns unless product overrides them.

### 1. API request / response

`POST /api/data/cash-accounts/exchanges`

Request (create / offline replay):

```ts
{
  accountType: 'daily_cash' | 'cash_reserve' | 'online'
  fromCurrencyId: string
  toCurrencyId: string
  fromAmount: number
  toAmount: number
  /** Snapshot of settings rates used at create (primary → display). */
  fromExchangeRateToPrimary: number
  toExchangeRateToPrimary: number
  reason?: string
  /** Client-generated id for offline idempotency. Server may mint if omitted online. */
  exchangeId?: string
}
```

Response (success): `{ exchangeId, warehouseId, accountType, fromCurrencyId,
toCurrencyId, fromAmount, toAmount }`.

- Use `accountType`, not a Mongo cash-account document id (same as Transfer).
- Warehouse comes from operational scope (`requireOperationalWarehouseId`), not
  a free-form body warehouse the client invents out of scope.

### 2. Trust client snapshot vs live rates

- **Create / sync trusts the submitted amounts + rate snapshot.** Do not
  recalculate `toAmount` from live currency settings on sync.
- Server still validates: currencies exist (or were valid at snapshot), amounts
  `> 0` and finite, currencies differ, rates `> 0` and finite, sufficient
  source balance, ACL, operational warehouse, idempotency.
- Optional consistency check: given snapshot rates, `toAmount` must match
  primary-pivot math within a small rounding epsilon (display 2dp /
  primary 8dp conventions). Mismatch → reject; never silently rewrite amounts.
- A settings rate change after create must not change stored legs.

### 3. Rate snapshot storage

`CashLedgerEntry` today has no rate field. For exchange:

- Both legs: `movementType: EXCHANGE`, `referenceType: cash_exchange` (or
  equivalent), shared `referenceId` / `transferGroupId` (= `exchangeId`).
- Persist snapshot on the ledger (preferred): e.g. optional fields
  `fromExchangeRateToPrimary` / `toExchangeRateToPrimary` on both legs, or a
  single shared metadata blob keyed by `exchangeId`. Do **not** stuff rates
  into `reason`.
- History displays the **stored** snapshot (or cross-rate derived from the two
  snapshot fields / the two leg amounts). Never live settings.

Primary-pivot math (same as `currencyDisplay` helpers):

`primary = fromAmount / fromExchangeRateToPrimary`  
`toAmount = roundDisplay(primary * toExchangeRateToPrimary)`  
(Primary currency rate is `1`.)

### 4. Cash account UI (CASH-EX-2)

- **One** `accountType` dropdown on the Exchange tab (Daily Cash / Cash Reserve /
  Online). Default `daily_cash`.
- “No second account selector” means no From/To **accounts** — not “no account
  field.” Both currency legs hit that single account.

### 5. Optional reason (CASH-EX-2)

- Include optional reason `InputLabel` (same as Transfer).
- Send `reason` on the exchange payload when non-empty.

### 6. Cash History grouping (CASH-EX-3)

- Same pattern as Transfer: **two ledger rows**, shared `exchangeId` /
  `transferGroupId`, both `movementType: EXCHANGE`.
- UI links them (other leg currency/amount in `referenceLabel` or equivalent) —
  not two unrelated transactions; not a brand-new single-row History model
  unless product later asks.
- Movement filter `EXCHANGE` returns both legs.

### 7. Operational warehouse (CASH-EX-2)

- Same as Transfer / New Entry today: page already disables New Entry when
  `!isOperational`. Do **not** invent a stricter in-modal gate than Transfer
  unless product asks.
- Backend still enforces operational warehouse on every exchange POST / sync.

### 8. Tests (minimum for CASH-EX-1)

- Atomic two-leg post; idempotent replay does not duplicate legs.
- Insufficient source-currency balance rejected.
- Offline snapshot chaining: two pending exchanges cannot spend the same
  source balance twice.
- Sync preserves original `toAmount` / rate snapshot when settings rates change.

### 9. Explicitly out of scope (all three tickets)

- Reverse / void / edit / delete of an exchange from History.
- Creating a DailyAction row for exchanges (cash ledger only, like Transfer).
- Party-activity formula changes (balances move via cash accounts only).
- Manually editable exchange rate in the UI.
- Cross-account currency exchange (different `accountType` for debit vs credit).

---

## Reference & route map (for implementation)

Read these first, then clone the Transfer path — do not invent a second cash
stack.

### Docs / constraints

| Doc | Why |
| --- | --- |
| [`../reference/cash-accounts.md`](../reference/cash-accounts.md) | Ledger rules, Transfer API, offline balances, History |
| [`../reference/party-activity.md`](../reference/party-activity.md) | FX elsewhere is party valuation — exchange is **cash ledger**, not DailyAction |
| Contract decisions above | Request shape, snapshot trust, History grouping |
| This file | CASH-EX-1 → then 2 ∥ 3 |

### End-to-end route (happy path)

```text
Quick Entry → Exchange tab (CASH-EX-2)
  → POST /api/data/cash-accounts/exchanges   [or offline outbox cashExchange]
      → ensureSee(invoicesEntriesAdd) + requireOperationalWarehouseId
      → postInternalCashExchange (atomic −fromCurrency / +toCurrency)
          → CashLedgerEntry ×2 (EXCHANGE, shared exchangeId)
          → CashAccount.balances updated per currency
  → GET cash-accounts/balances (invalidate / local snapshot)
  → Cash History GET cash-accounts/ledger (CASH-EX-3 shows EXCHANGE legs)
```

Offline branch (mirror Transfer):

```text
POST cash-accounts/exchanges (offline-capable)
  → localHandlers entity = cashExchange
  → validate + stamp warehouseId / exchangeId
  → outbox queue
  → offlineCashBalances apply −from / +to on accountType
  → sync replay → api.controller postCashExchange (idempotent)
```

### Clone map: Transfer → Exchange

| Concern | Transfer (shipped — copy pattern) | Exchange (add) |
| --- | --- | --- |
| HTTP route | `POST …/cash-accounts/transfers` | `POST …/cash-accounts/exchanges` |
| Routes | `apis/api.routes.ts` (~494) | same file, sibling route |
| Route handler | `api.routes` `postCashTransfer` | `postCashExchange` |
| Controller | `apis/api.controller.ts` `postCashTransfer` (~4376) | `postCashExchange` |
| Sync replay | `api.controller` `entity === 'cashTransfer'` (~6892) | `entity === 'cashExchange'` |
| Domain post | `shared/cashAccounts/ledgerService.ts` `postInternalCashTransfer` | `postInternalCashExchange` |
| Input validate | `shared/cashAccounts/types.ts` `validateCashTransferInput` | `validateCashExchangeInput` |
| Movement / ref | `CASH_MOVEMENT_TYPES.TRANSFER` / `CASH_REFERENCE_TYPES.TRANSFER` (`cash_transfer`) | `EXCHANGE` / `cash_exchange` |
| Ledger model | `models/CashLedgerEntry.ts` | extend if snapshot fields needed |
| OpenAPI | `documentation/openapi.yaml` `/cash-accounts/transfers` | `/cash-accounts/exchanges` + schema |
| FE mutation | `api/apiStore.ts` `postCashTransfer` | `postCashExchange` |
| FE UI | `QuickEntryModal.tsx` Transfer tab (~928) | Exchange tab + `exchangeForm` |
| FX helpers | — (same currency) | `currencyDisplay.ts` `convertToPrimaryAmount` / `convertPrimaryAmount` |
| Offline entity | `offline/types.ts` `cashTransfer` | `cashExchange` |
| Offline map | `localHandlers` path→entity + create validate + `isOfflineCapableEndpoint` | same for `exchanges` |
| Local balances | `offlineCashBalances.ts` `postsForCashTransfer` | `postsForCashExchange` (−from cur, +to cur, same `accountType`) |
| History UI | `pages/CashAccountHistoryPage.tsx` TRANSFER filter / `cash_transfer` label | EXCHANGE filter / `cash_exchange` + linked legs |
| Ledger labels | `ledgerService` `listCashLedgerEntries` transfer other-account label | other-leg currency/amount (or rate) label |
| i18n | `i18n/{en,ar,de}/translation.json` `entries.transfer*`, `movementTypes.TRANSFER`, `referenceTypes.cash_transfer` | exchange + EXCHANGE + `cash_exchange` keys |
| Tests | `cashImpact.test.ts`, `offlineCashBalances.test.ts`, `isOfflineCapableEndpoint.test.ts` | extend / sibling cases |
| Docs | `docs/reference/cash-accounts.md` Transfers section | Exchange section + Transfer vs Exchange |

### CASH-EX-1 — files to touch

**Backend**

1. `services/api-store-platform/src/shared/cashAccounts/types.ts` — `EXCHANGE` movement + `cash_exchange` reference + `validateCashExchangeInput`
2. `services/api-store-platform/src/shared/cashAccounts/ledgerService.ts` — `postInternalCashExchange`; History `referenceLabel` for exchange groups
3. `services/api-store-platform/src/models/CashLedgerEntry.ts` — optional snapshot fields (`fromExchangeRateToPrimary`, `toExchangeRateToPrimary`) if not stored only on payload/idempotency metadata
4. `services/api-store-platform/src/apis/api.controller.ts` — `postCashExchange` (SEE + warehouse + call domain); sync branch for `cashExchange`
5. `services/api-store-platform/src/apis/api.routes.ts` — register `POST ${baseRoute}/cash-accounts/exchanges`
6. `documentation/openapi.yaml` — path + request schema
7. `docs/reference/cash-accounts.md` — Exchange section (API, legs, offline, snapshot)
8. `services/api-store-platform/src/test/…` — atomic legs, insufficient balance, idempotent replay (minimum from contract §8)

**Frontend offline (belongs with API so sync works; do with CASH-EX-1 or as first slice of CASH-EX-2)**

9. `web/store-platform-frontend/src/offline/types.ts` — `| 'cashExchange'`
10. `web/store-platform-frontend/src/offline/localHandlers.ts` — path `cash-accounts/exchanges` → entity; create validate; `isOfflineCapableEndpoint`
11. `web/store-platform-frontend/src/offline/offlineCashBalances.ts` — `postsForCashExchange`
12. `web/store-platform-frontend/src/test/isOfflineCapableEndpoint.test.ts` + `offlineCashBalances.test.ts`

SEE flag reuse (no new catalog entry): `SEE.invoicesEntriesAdd` in
`shared/seeCatalog.ts` / FE `shared/seeFlags.ts`.

### CASH-EX-2 — files to touch

1. `web/store-platform-frontend/src/api/apiStore.ts` — `postCashExchange` mutation → `cash-accounts/exchanges`, invalidate `cash-accounts`
2. `web/store-platform-frontend/src/components/SellingInvoice/QuickEntryModal.tsx` — `EXCHANGE_TAB`, `exchangeForm`, tab button, form UI (one `accountType`, From/To currency, amounts, reason), validation, save branch, disable rules
3. `web/store-platform-frontend/src/components/SellingInvoice/currencyDisplay.ts` — reuse only (`buildDisplayCurrencyOptions`, `convertToPrimaryAmount`, `convertPrimaryAmount`, `roundDisplayAmount`); no second FX path
4. `web/store-platform-frontend/src/shared/utils` / number parse — `parseNumberValue`, `formatNumberForDb` (same as Transfer amounts)
5. `web/store-platform-frontend/src/i18n/en|ar|de/translation.json` — under `components.sellingInvoices.entries.*` (mirror `transfer` keys)
6. Run `web/store-platform-frontend/scripts/checkTranslations.mjs` after keys

Parent gates already in place (do not re-invent):

- `SellingInvoicesPage.tsx` — `canSeeAddEntries`, New Entry `isDisabled={!isOperational}`
- `PartyActivityTable.tsx` — `canAddEntry` when opening Quick Entry from party

### CASH-EX-3 — files to touch

1. `web/store-platform-frontend/src/pages/CashAccountHistoryPage.tsx` — `MOVEMENT_OPTIONS` + `REFERENCE_LABEL_KEYS`; format exchange legs / rate display
2. `services/api-store-platform/src/shared/cashAccounts/ledgerService.ts` — `listCashLedgerEntries` labeling for `cash_exchange` (if not finished in CASH-EX-1)
3. `web/store-platform-frontend/src/i18n/en|ar|de/translation.json` — `dashboard.cashAccounts.movementTypes.EXCHANGE`, `referenceTypes.cash_exchange`, any History column/copy keys
4. `docs/reference/cash-accounts.md` — History / Transfer vs Exchange (finish doc surface)

Ledger list API already exists: `GET /api/data/cash-accounts/ledger` — no new History route unless grouping needs extra fields from CASH-EX-1.

### Suggested implement order (files)

1. types + `postInternalCashExchange` + model snapshot fields  
2. controller + routes + OpenAPI + sync replay  
3. FE offline entity + balance posts + capable-endpoint test  
4. `postCashExchange` in `apiStore` + Quick Entry tab  
5. History filter/labels + i18n  
6. `cash-accounts.md` + leftover OpenAPI polish  

### Do not touch for this feature

- Warehouse stock transfer (`inventory/warehouse-transfer*`) — different domain  
- Product “unit exchange” backlog — nested units, not cash FX  
- DailyAction create/edit paths for the exchange itself  
- `calculateCashBalance` (removed) / inventing client-only ledgers  

---

## CASH-EX-1 — [Backend] Cash currency exchange API, ledger & offline

**Type:** Story  
**Priority:** High  
**Component:** Cash Accounts  
**Dependencies:** None  
**Labels:** backend, cash-accounts, offline, ledger, fx

### User story

As a user managing cash accounts, I want to exchange cash from one currency into
another within the same cash account, so that both currency balances are updated
correctly and the exchange is recorded in the cash ledger.

### Description

Cash transfers support moving money between cash accounts using the **same**
currency. There is no dedicated cash currency exchange operation.

Introduce a new exchange transaction that converts one currency into another
**within the same cash account**: debit source currency, credit target currency.

Must support online and offline.

### 1. Exchange API

`POST /api/data/cash-accounts/exchanges`

Request should support:

- Cash account (`accountType` — same convention as transfers)
- `fromCurrencyId`
- `toCurrencyId`
- `fromAmount`
- `toAmount` (converted target amount)
- Exchange rate snapshot
- Optional reason
- Operational warehouse (from scope / payload as today)
- Unique transaction / idempotency id for offline sync

Exchange operates on **one** cash account only. No separate destination account.

### 2. Currency conversion

- Reuse existing currency settings and conversion helpers.
- Convert through primary: source → primary → target.
- Do not invent a second FX path.
- Persist the rate snapshot used for the transaction.
- Validate submitted amounts and rate on the backend.
- Later settings changes must not rewrite historical amounts.

### 3. Ledger & balance updates

Two linked ledger movements on the same account, one atomic commit:

- Debit source currency by `fromAmount`
- Credit target currency by `toAmount`

Example: EUR 1,000 / USD 500 → exchange 100 EUR → 108 USD → EUR 900 / USD 608.

Dedicated movement / reference type: **`EXCHANGE`**. Do not reuse `TRANSFER` or
the transfer endpoint.

### 4. Balance validation

- Sufficient source-currency balance
- Reject identical source/target currencies
- Reject zero, negative, or invalid amounts
- Reject missing, zero, or invalid exchange rates
- Both legs succeed or neither is recorded

### 5. Access control

Same conventions as cash transfer:

- `SEE.invoicesEntriesAdd`
- Operational warehouse required
- Backend permission + warehouse restrictions

### 6. Offline support

Follow existing `cashTransfer` outbox architecture:

- Dedicated outbox entity for currency exchanges
- Create with local currency settings / rates; store rate snapshot at create
- Calculate target amount locally
- Validate against local balance snapshot; reject if unavailable or short
- Update local snapshot immediately (− source, + target)
- Queue for sync; replay when online
- Idempotent sync (no duplicate ledger rows)
- Preserve original amounts + rate snapshot on retries
- Backend validates integrity, ACL, warehouse, currencies, amounts, rate data,
  and duplicate ids on sync
- Rate change after create must not silently change original amounts

### 7. Documentation

Update:

- OpenAPI
- [`../reference/cash-accounts.md`](../reference/cash-accounts.md)

Document endpoint, ledger legs, rate snapshots, offline sync.

### Acceptance

- [ ] Dedicated cash exchange API available
- [ ] Same-account only; different source/target currencies
- [ ] Source debited, target credited; legs linked; atomic
- [ ] Existing conversion helpers reused; rate snapshot persisted
- [ ] Insufficient balance / invalid rates rejected
- [ ] ACL + operational warehouse enforced
- [ ] Offline create + immediate local balance update
- [ ] Sync without duplicates; original snapshot preserved
- [ ] OpenAPI + cash-accounts docs updated
- [ ] Existing transfer unchanged

### Out of scope

Frontend Quick Entry tab; Cash History UI filters/labels (CASH-EX-2 / CASH-EX-3).

---

## CASH-EX-2 — [Frontend] Exchange tab on Selling Invoice Quick Entry

**Type:** Story  
**Priority:** High  
**Component:** `SellingInvoice/QuickEntryModal.tsx`  
**Reference:** Transfer tab (~line 928)  
**Dependencies:** CASH-EX-1 (backend contract)  
**Labels:** frontend, selling-invoice, quick-entry, cash-accounts, offline, fx

### User story

As a user creating a selling invoice, I want to exchange cash from one currency
into another within the same cash account from the Quick Entry Modal, so that I
can manage currency exchanges without leaving the invoice workflow.

### Description

Add an Exchange tab beside Transfer. Select source/target currencies, enter
source amount, auto-calculate target amount. Same cash account only. Online +
offline.

### 1. Tab visibility & permissions

- New Exchange tab next to Transfer
- Create-only (`mode === 'create'`), same rules as Transfer
- Inherit parent `canSeeAddEntries` / `SEE.invoicesEntriesAdd`
- Require operational warehouse; hide/block in combined multi-warehouse view
- Same cost-flow hiding as Transfer (`costKind` / employee-other)
- No new SEE unless product asks

### 2. Exchange form UI

Reuse `DropdownLabel` / `InputLabel`.

| Field | Behaviour |
| --- | --- |
| Exchange From | Source currency (`buildDisplayCurrencyOptions`) |
| Exchange To | Target currency |
| Exchange Amount | Editable numeric; source currency |
| Exchange Amount To | Read-only calculated; target currency |
| Cash account | One account from existing Quick Entry patterns — **no** second account selector |

### 3. Currency conversion

Reuse `currencyDisplay.ts`:

- `convertToPrimaryAmount` / `convertPrimaryAmount`
- Pivot: source → primary → target
- Parsing/formatting: `parseNumberValue`, `formatNumberForDb`, `roundDisplayAmount`
- Recalc on amount or currency change
- No new FX mechanism; no manually editable rate field

### 4. Validation

- Both currencies selected and different
- Source amount &gt; 0; reject invalid numerics
- Missing/zero/invalid rates block submit
- Insufficient source balance blocks submit
- Missing local balances block offline submit
- Clear error copy
- One configured currency only → hide or disable Exchange with message

### 5. Submission

- Dedicated exchange endpoint only (not transfers)
- Send account, currencies, amounts, rate snapshot, optional reason
- Existing toast / error patterns
- Refresh or update cash balances after success

### 6. Offline

- Local settings/rates; local calc; snapshot balance checks
- Dedicated exchange outbox entity
- Immediate local balance update (− source, + target)
- Preserve snapshot + amounts; sync without duplicates
- Follow `cashTransfer` offline architecture where it fits

### 7. State

- Separate `exchangeForm` (mirror `transferForm`)
- Isolate from Transfer; reset both on modal close
- Tab switch must not clobber the other form
- Transfer + other Quick Entry flows unchanged

### 8. Translations

`en` / `ar` / `de`: tab, From/To, amounts, validation, insufficient balance,
missing rate, offline messages, success/failure.

### Acceptance

- [ ] Create-only Exchange tab; Transfer visibility/permission rules
- [ ] One cash account; no second account selector
- [ ] Currencies selectable; source editable; target read-only auto-calc
- [ ] Primary pivot + existing parse/format helpers
- [ ] Identical currencies / bad rates / short balance blocked
- [ ] Dedicated exchange API; offline + local snapshot update + sync
- [ ] Isolated form state; reset on close
- [ ] en/ar/de keys
- [ ] Transfer unchanged

### Out of scope

Backend/ledger (CASH-EX-1); Cash History display/filters (CASH-EX-3); new
currency management; editing calculated target amount; changing Transfer.

---

## CASH-EX-3 — [Cash History] Exchange display, filters & docs

**Type:** Story  
**Priority:** Medium  
**Component:** Cash Accounts / Cash History  
**Dependencies:** CASH-EX-1  
**Labels:** frontend, cash-accounts, cash-history, docs, i18n

### User story

As a user reviewing cash account transactions, I want to identify and inspect
currency exchange operations in Cash History, so that I can see how each
currency balance changed and which exchange rate was applied.

### Description

Support `EXCHANGE` in Cash History and docs. Distinguish from Transfer. Same
account: show linked debit/credit as one logical exchange.

### 1. Cash History display

- Recognize `EXCHANGE`
- Show source amount/currency, received amount/currency, rate used, account,
  optional reason
- Link debit + credit under one exchange transaction (not two unrelated rows)

### 2. Historical accuracy

- Use stored rate snapshot (never live settings for history)
- Amounts/currencies match original transaction
- Offline-created then synced exchanges appear correctly

### 3. Filters

- Add Exchange movement-type filter
- Keep Transfer and other filters working
- Filtering/grouping consistent for both exchange legs

### 4. Translations

`en` / `ar` / `de`: movement label, source/target amount+currency, rate, reason,
filters, descriptions.

### 5. Documentation

Update [`../reference/cash-accounts.md`](../reference/cash-accounts.md):

- Transfer vs Exchange
- Same-account model; debit/credit legs
- Primary pivot + rate snapshot
- API request/response
- `EXCHANGE` movement/reference type
- Online/offline, outbox, sync, balance snapshot updates

(OpenAPI belongs primarily to CASH-EX-1; keep History docs in sync here.)

### Acceptance

- [ ] History recognizes `EXCHANGE` and distinguishes from Transfer
- [ ] Source/target amounts+currencies; rate; account; grouped legs
- [ ] Historical rates preserved; offline-synced rows correct
- [ ] Exchange filter works; Transfer history unchanged
- [ ] en/ar/de translations
- [ ] cash-accounts reference updated

### Out of scope

Exchange API implementation (CASH-EX-1); Quick Entry tab (CASH-EX-2).
