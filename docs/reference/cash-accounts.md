# Cash & Payment Accounts

Server-authoritative cash balances. Do not use client-derived
`calculateCashBalance` (removed from Selling Invoices).

## Model

One `CashAccount` row per `(tenantId, warehouseId, type)`.

Initial types (extensible strings, not a closed app enum):

| type | Meaning |
| --- | --- |
| `daily_cash` | Drawer / daily cash |
| `cash_reserve` | Physical reserve outside the drawer |
| `online` | Card / online payment methods |

`allowNegativeBalance` is always false.

Each account stores `balances`: `currencyId` → signed amount. A missing key is
zero. That map must match the ledger for the same currency. A debit can spend
only the selected currency. Another currency on the same account does not cover
it.

## Ledger

Append-only `CashLedgerEntry` rows. Each row has `currencyId` and a signed
`amount` in that currency: positive into the account, negative out.
`balances[currencyId]` is denormalized and updated with each posting.

Cash is posted in the currency that was handed over. It is not converted to
primary. Party valuation and inventory cost still use rates. Cash posting does
not.

## Auto-posting

Selling and buying invoices store `invoiceCurrencyId`, `cashAccountType`, and
`tenders`. The user picks the cash account (Daily Cash, Cash Reserve, Online).
Default follows payment type: cash → `daily_cash`, card → `online`. Credit
stores no tenders and posts nothing.

| Event | Account | Sign |
| --- | --- | --- |
| Selling cash or card | chosen account (default from payment type) | + `appliedAmount` per tender currency |
| Selling `credit` | — | none (later receipt) |
| Buying cash or card | chosen account (default from payment type) | − `appliedAmount` per tender currency |
| Buying `credit` | — | none |

`allocateCashTenders` (`packages/store-domain`) walks tenders in order against
the primary amount due. Each tender converts with the invoice snapshot rate
(`currencyAmounts.exchangeRate`, `amount / rate`), not the tenant's live
rates. The part that covers the remaining due is `appliedAmount`. The rest of
that tender is `changeAmount`.

Only `appliedAmount` is posted, in the tender's currency. `changeAmount` is
stored on the tender and is not a ledger row. `currencyAmounts.paidAmount` is
still capped at the invoice total. Same rule for selling and buying, online
and offline. See [`party-activity.md`](party-activity.md).

An invoice with no `invoiceCurrencyId` and no tenders is historical. Those two
fields stay empty on edit. Its post is the primary-currency paid amount (grand
total unless partial) on `cashAccountType` when set, otherwise the default
account for the payment type.

Receipt / payment / expense: user picks the cash account in Quick Entry
(`cashAccountType` on `DailyAction`). Default is `daily_cash`. The entry
amount is posted as-is in `currencyId`. `exchangeRateToPrimary` on the action
is for party valuation, not the ledger.

| Entry | Field | Sign |
| --- | --- | --- |
| Receipt | To account | + |
| Payment | From account | − |
| Expense | From account | − |

## Migration

- Historical cash → Daily Cash ledger rows (or effects matching the table)
- Historical card/online sales → Online
- Cash Reserve: explicit `OPENING_BALANCE` only — never invent history
- Idempotent by `idempotencyKey`; keep `referenceType` / `referenceId`
- Stamp ledger rows that have no `currencyId` with the tenant primary currency
- Rebuild `balances` from the ledger and drop the old single `balance` field
- Do not rewrite existing ledger amounts. Do not rebuild an invoice that
  already has ledger rows
- Stamp `exchangeRateToPrimary` on cash daily actions that lack it (party
  valuation only)

## Invoice edit / removed lines

Cash impact is derived from the invoice tenders that remain after save, not from
a per-line ledger row. Removing a product line from an invoice does not create
a separate ledger entry for that line; the next post/rebuild uses the updated
tenders and paid amount only. Do not invent ghost ledger rows for deleted lines.

## Transfers

Internal double-post (`TRANSFER` legs). Not revenue/expense.

Public API: `POST /api/data/cash-accounts/transfers`  
Body: `{ fromAccountType, toAccountType, amount, currencyId, reason? }`  
`currencyId` is required. Both legs post `amount` in that currency. No
conversion to primary. A short balance in that currency fails the debit even
when another currency on the account would cover the value. Requires
operational warehouse + entries-add SEE. Quick Entry Transfer tab calls this
endpoint.

Offline, the same POST is queued and applied to the last balance snapshot:
minus on the source account, plus on the destination, in `currencyId`. The
ledger stays online. Sync replays the queued transfer onto the warehouse
stamped on the payload.

## Exchanges

Same-account currency exchange (`EXCHANGE` legs, reference `cash_exchange`).
Not revenue/expense, no DailyAction.

**Transfer vs Exchange:** a transfer moves the **same** currency between two
accounts; an exchange debits one currency and credits another **inside one**
account.

Public API: `POST /api/data/cash-accounts/exchanges`  
Body: `{ accountType, fromCurrencyId, toCurrencyId, fromAmount, toAmount,
fromExchangeRateToPrimary, toExchangeRateToPrimary, reason?, exchangeId? }`  
Response: `{ exchangeId, warehouseId, accountType, fromCurrencyId,
toCurrencyId, fromAmount, toAmount }`.

- Rates are the currency-settings rates (primary → currency, primary is `1`)
  at create time. The client computes `toAmount` through primary:
  `round2(round8(fromAmount / fromRate) * toRate)`.
- The server never recalculates `toAmount`. It rejects: same currencies,
  amounts or rates that are not finite and `> 0`, a `toAmount` off by more
  than 0.01 from that math, currencies not in currency settings, and a short
  source-currency balance.
- Live requests must send today's settings rates. Sync replays skip that check
  and keep their create-time snapshot (settings may have changed offline).
- Same `exchangeId` again: identical values return the stored result (201);
  different values are rejected.
- Two ledger rows, one Mongo transaction: `−fromAmount fromCurrencyId` and
  `+toAmount toCurrencyId`. Both share `referenceId` / `transferGroupId` =
  `exchangeId` and store `fromExchangeRateToPrimary` /
  `toExchangeRateToPrimary`. Idempotency keys `cash_exchange:<id>:from|to`
  make a replay with the same `exchangeId` a no-op.
- Requires operational warehouse + entries-add SEE. Quick Entry Exchange tab
  (shown in create mode when more than one currency is configured) calls this
  endpoint and always sends a client `exchangeId`.

Offline, the POST is queued as outbox entity `cashExchange`. Before queueing,
the local handler checks the source-currency balance on the snapshot **plus
pending outbox work**, so two queued exchanges cannot spend the same balance.
The snapshot then shows `−from / +to` on the same account. Sync replays the
stored payload (amounts + rates unchanged) onto the stamped warehouse.

## Offline

Balance checks use the last snapshot plus unsynced creates and transfers.
There is no local cash ledger. History stays online-only.

`GET cash-accounts/balances` is offline-capable. Pending invoice, buying
invoice, daily-action, cash-transfer, and cash-exchange creates adjust that snapshot per
currency. A transfer debits the source account and credits the destination in
the selected currency. Edits of already-synced invoices stay on the server
until the next sync.

Quick Entry Transfer works offline when a balance snapshot is loaded. Save is
blocked when that currency's source balance is short. Offline without a
snapshot cannot save. Payment, expense, and buying cash-out use the same
currency check, and only when balances are loaded.

**Out of scope**

- Dexie `CashAccount` / `CashLedgerEntry`
- Balance simulation beyond pending creates and transfers (synced edits)

## History

Read-only ledger list for the current warehouse scope.

Public API: `GET /api/data/cash-accounts/ledger`  
Query: `accountType?`, `movementType?`, `dateFrom?`, `dateTo?`, `page?`,
`limit?` (default 50, max 100). Each row's `amount` is in that row's
`currencyId` and is shown with the currency code.

UI: Dashboard Cash card click → `/dashboard/cash-history` (account pre-filter
when a specific account card is clicked; Total opens all). Default date range is
start of month → today. Filters apply only on **Apply**. Transfer legs show as
two rows sharing `transferGroupId`. Each row includes `referenceLabel`
(invoice number, party/expense name, or counterparty account type for transfers).

Exchange legs also show as two rows (movement filter `EXCHANGE` returns both).
Each exchange row carries `exchangeCounterLeg` (`{ currencyId, amount }` of
the other leg) and the stored rate snapshot. The UI shows the other leg plus
`1 <from> = toRate / fromRate <to>`, always from the snapshot, never from live
settings.

## Selling Invoices summary

Shows live **Daily Cash** and **Online** from
`GET /api/data/cash-accounts/balances` (same API as Dashboard; no date
filter). Cash Reserve and Total stay on Dashboard only.

Each card lists one line per configured currency: primary first, then
secondary currencies in settings order. A missing balance is zero. More than
two currencies stay collapsed until the card is expanded. Balances response is
`{ accounts: [{ type, name, balances }], totals }` where `balances` and
`totals` are `currencyId` → amount.
