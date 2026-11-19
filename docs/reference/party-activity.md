# Party modal

Customer, supplier, and partner detail is one GET:

- `GET /api/data/customers/:id`
- `GET /api/data/suppliers/:id`
- `GET /api/data/partners/:id`

That response already includes the cash entries, both invoice lists (selling and
buying), and `invoiceSummary`. Do not call `selling-invoices?customerId` or
`buying-invoices?supplierId` to paint the modal. Those list endpoints still own
the invoices-page summaries, and their entry filter is narrower. They use the
same builders and the same currency rates.

The activity table reads the embedded lists. It does not fetch invoices on
open.

Opening a row in view uses that embedded invoice or entry. Customers,
suppliers, partners, expenses, invoice settings, units, the product catalog,
inventory, and cash balances load when the user edits or creates, or when they
print or download. Viewing does not subscribe to them.

`useSee` and `useWarehouseScope` do not refetch just because the modal
subscribed. The shell already holds permissions and warehouses. Currency
settings refetch only when nothing has loaded them yet.

## Invoice summary

`invoiceSummary` is `{ totalInvoiced, totalPaid, outstanding }`.

Own side for a customer or partner is selling invoices
(`buildCustomerInvoiceSummary`). Own side for a supplier is buying invoices
(`buildSupplierInvoiceSummary`). Outstanding is the own balance minus the
other side's invoiced−paid, plus the party's opening balance converted to
primary with the same rates. The other side is passed with no entries.
Opening balance is not part of `totalInvoiced`.

Draft, cancelled, and void invoices are skipped. Amounts are the primary
currency amounts on the invoice.

Entry amounts are `totalPrice`, or `singleUnitPrice` when that is empty, with
commas stripped, then `amountToPrimary` using the tenant cash rates. No rates
means the amount is already primary.

| Party | Adds to invoiced | Adds to paid |
| --- | --- | --- |
| Customer, partner | selling entry, payment | receipt |
| Supplier | buying entry, receipt | payment |

Do not clamp supplier payable at zero. A negative supplier balance is money
owed to us, and it stays negative after the other side is subtracted.

Detail entries are `getPartyEntries`: receipt and payment only, matched on the
party id and internal code. Customer and supplier also match the other id
field (`supplierId` on a customer payment, `customerId` on a supplier receipt).
Partner matches `partnerId` only.

List totals use a wider entry set, still with the same directions and rates:

- Customer `totalReceivable`: non-buying actions for that customer, plus a
  payment stored on `supplierId`.
- Supplier `totalPayable`: actions on `supplierId`, plus a receipt stored on
  `customerId`.

Bump `buildCustomerListKey` and `buildSupplierListKey` when this formula
changes. Redis otherwise serves the previous totals. Current keys are customer
`v4` and supplier `v6`.

## Opening balance

Customers and suppliers store `openingBalances`: one row per configured
currency, `{ currencyId, currencyCode, amount, direction }`. `amount` is
always positive. `direction` is `owed_to_us` or `we_owe`. A zero row is not
stored. Partners have no opening balance.

`owed_to_us` adds to a customer outstanding and subtracts from a supplier
outstanding. `we_owe` does the opposite. Each row converts with
`amountToPrimary` (live rates, no snapshot). The result is added only to
outstanding, `totalReceivable`, and `totalPayable`.

`PATCH /api/data/customers/:id` and `PATCH /api/data/suppliers/:id` replace
the whole list. They require `customers.add` / `suppliers.add`. The patch
does not post cash and does not create an invoice or a daily action.

The card lists the primary currency first, then extra currencies the same way
as the invoice paid rows: `+` on the last row while another currency remains,
`−` once nothing is left to add. A row left at zero is not saved. The words
on each row are the same "Owed to us" / "We owe" labels. A new customer row
starts as owed to us; a new supplier row starts as we owe.

## Summary cards

Cards render only when `invoiceSummary` is present.

- Invoice total. Label is selling invoices for a customer or partner, buying
  invoices for a supplier. This is `totalInvoiced`. There is no total-paid card.
- Outstanding, shown as an absolute amount. Customer or partner outstanding
  `>= 0` is "Owed to us"; below zero is "We owe". Supplier is the opposite:
  positive outstanding is "We owe".
- Opening balance, for a customer or supplier only. One line per currency in
  that currency, with the same two direction labels. The primary currency is
  always shown, as zero until an amount is saved.

Outstanding and the opening balance are hidden unless the party is a partner
(outstanding only), or the user can see `customers.totalReceivable` /
`suppliers.totalPayable`. Editing the opening balance needs `customers.add` /
`suppliers.add`. The card reads currency settings so it can offer the next
currency; that request is cached.

## Activity balance

The balance column is this row's own amount, not a running sum. Positive is
green with `+`. Negative is orange with `-`.

| Party | `+` | `-` |
| --- | --- | --- |
| Customer, partner | selling invoice, selling entry, payment | buying invoice, buying entry, receipt |
| Supplier | buying invoice, buying entry, receipt | selling invoice, selling entry, payment |

An invoice balance is `max(0, total − paid)` with that sign. It is zero when
the status is draft, cancelled, void, or paid. Any other entry subtype is zero.

The kind badge and the invoice number are separate columns. The table pages
30 rows. The selling-invoices table uses the same page size.

## Tender and change

A cash or card payment can be several currencies. The invoice stores
`tenders`. Each row is `currencyId`, `tenderedAmount`, `appliedAmount`,
`changeAmount`.

`allocateCashTenders` walks the rows in order against the primary amount due.
It converts each tender with the invoice snapshot rate, keeps the part that
covers the remaining due (`appliedAmount`), and stores the rest as
`changeAmount` in that tender's currency. `currencyAmounts.paidAmount` is
still capped at the invoice total (`settleTenderedPayment` on the summed
primary tenders).

Cash posts `appliedAmount` only, in the tender currency. Change is stored on
the tender and is not a ledger row. Credit stores no tenders. Selling and
buying send the same fields (`invoiceCurrencyId`, `cashAccountType`,
`tenders`), including offline saves.

An invoice with no `invoiceCurrencyId` and no tenders is historical. Leave
those fields empty on edit. Its cash post stays the primary amount.

## Offline

Offline detail GETs build `invoiceSummary` with the same directions, the same
excluded statuses, and local currency rates. Customer and supplier lists
recompute `totalReceivable` and `totalPayable` the same way, including the
cross-id payment and receipt. List entries follow the current warehouse scope.
Detail entries stay receipt and payment across the local rows (the synced ACL
set), not the working scope.

Offline sums retained local invoices and entries only. Rows already pruned stay
out of the total until the next online sync.
