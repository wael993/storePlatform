# Smoke test plan — from zero to everything

One walk through the whole app, starting with an empty tenant. Run it on staging, on the
production copy (PG-MIG-3) and after the switch (PG-MIG-4). Tick each row; any failure gets
a ticket with the row number.

**Before you start:** a fresh tenant (created in step 1), two browsers (or one normal + one
private window), a phone or a second browser for offline tests. Write down the numbers you
check (stock, cash) — most rows compare "before" and "after".

**Critical path** (★): the minimum set to run right after the production switch.

**Automated help:** `npm run stress` (API) covers parallel sales, edits back and forth,
double delete and offline replay — run it after section 6.

---

## 1. Platform: tenant and owner (super admin)

| # | Step | Expected | ✓ |
| --- | --- | --- | --- |
| 1.1 ★ | Super admin logs in | Tenant list loads | |
| 1.2 ★ | Create a tenant + owner | Tenant in list; owner can log in | |
| 1.3 | Edit tenant: pages, offline on/off, Invoice AI limit | Saved; owner sees only allowed pages after reload | |
| 1.4 | Set subscription payment info | Owner sees it on the subscription page | |

## 2. Login and account

| # | Step | Expected | ✓ |
| --- | --- | --- | --- |
| 2.1 ★ | Owner logs in | Dashboard loads | |
| 2.2 ★ | Wrong password | Refused, clear message | |
| 2.3 | Leave tab open 15+ min, then click around | Still logged in (token refresh) | |
| 2.4 | Change password | Other browser is logged out | |
| 2.5 | Log out; log out of all devices | Both browsers logged out | |

## 3. Setup (owner)

| # | Step | Expected | ✓ |
| --- | --- | --- | --- |
| 3.1 ★ | Currency settings: primary + one secondary with rate | Saved; same currency twice is not stored twice | |
| 3.2 | Invoice settings: name, address, logo, footer, oversell off | Shown on printed invoice | |
| 3.3 ★ | Warehouses: create two | Both in list and in warehouse switcher | |
| 3.4 | Units, categories, brands, shelves: create, rename, delete one | Duplicate names refused; used items cannot be deleted | |
| 3.5 | Label templates: create two, switch default | Only one default | |
| 3.6 | User settings: language, products per page | Kept after reload | |

## 4. Users and permissions

| # | Step | Expected | ✓ |
| --- | --- | --- | --- |
| 4.1 ★ | Invite admin, cashier, employee | Each logs in with temp password | |
| 4.2 | Limit a user to one warehouse | User sees and posts only there | |
| 4.3 | Change cashier's SEE list | Cashier sees exactly what is allowed; hidden actions refused by the API too | |
| 4.4 | Edit and delete a user | Deleted user cannot log in | |

## 5. Catalog and parties

| # | Step | Expected | ✓ |
| --- | --- | --- | --- |
| 5.1 ★ | Create product with barcode, prices, opening stock | In list; stock correct in the chosen warehouse | |
| 5.2 | Same barcode on another product | Refused | |
| 5.3 | Bulk edit prices; change purchase price | Saved; average cost follows the rules | |
| 5.4 | Product import (new tenant, no products): upload, map, master data, preview, commit | Products, stock and master data created; retry after failure creates no duplicates | |
| 5.5 ★ | Customers, suppliers with opening balance | Balance shown in party activity | |
| 5.6 | Partners, projects | Create, edit; used ones cannot be deleted | |
| 5.7 | Employee: create, salary, payout ×2 quickly, reactivate a terminated one | Both payouts kept; end date cleared | |

## 6. Money and stock (core)

| # | Step | Expected | ✓ |
| --- | --- | --- | --- |
| 6.1 ★ | Buying invoice (cash) | Stock up, cash down, average cost updated | |
| 6.2 ★ | Selling invoice cash, paid in full | Stock down, cash up, invoice number allocated | |
| 6.3 | Selling invoice: credit, partial, card, secondary currency | Customer balance / cash account / currency amounts correct | |
| 6.4 ★ | Edit sale: paid 100 → 50 → 100, quantity 2 → 3 → 2 | Cash and stock end where one sale of 2 for 100 would | |
| 6.5 ★ | Delete a paid sale | Stock and cash back exactly once | |
| 6.6 | Oversell off: sell more than stock | Refused | |
| 6.7 | Warehouse transfer, then delete it | Stock moves, then comes back | |
| 6.8 | Cash transfer and cash exchange between accounts / currencies | Balances right; history shows both legs | |
| 6.9 | Daily actions and expenses: create, edit, delete | Cash follows each change | |
| 6.10 | Dashboard and reports after the above | Totals match the invoices you made | |

## 7. Offline

| # | Step | Expected | ✓ |
| --- | --- | --- | --- |
| 7.1 ★ | Go offline, sell 3 invoices, go online | All 3 synced once; stock and cash correct | |
| 7.2 | Offline: sell the same product on two devices, reconnect | No duplicate invoices; stock rule respected | |
| 7.3 | Offline invoice numbers | Numbers from the offline block, no clash with online ones | |

## 8. Notifications, AI, newsroom, subscription

| # | Step | Expected | ✓ |
| --- | --- | --- | --- |
| 8.1 | Low-stock / negative-stock notifications; mark as read | Read state kept after reload | |
| 8.2 | Invoice AI: scan one invoice | Allowance goes down by 1 | |
| 8.3 | RIVO report | Report generated and saved | |
| 8.4 | Newsroom: super admin publishes a note; owner pins it | Unread count, pin kept | |
| 8.5 | Owner requests renewal; super admin approves / rejects | Subscription date / status updated once | |

## 9. Clean-up checks (after the run)

| # | Check | Expected | ✓ |
| --- | --- | --- | --- |
| 9.1 ★ | Database: cash balance = ledger for the tenant | No difference | |
| 9.2 | Database: no negative stock (oversell off), no orphan stock movements | None | |
| 9.3 | Render logs during the run | No 500, no Postgres error | |
