# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),

## [Unreleased]

## [1.1.0] - 2026-10-19

### Fixed

- Raise the invoice-settings body limit so logo and QR code uploads are not rejected for size
- A project receipt or payment can be saved with only the project

### Added

- Newsroom API for topics, release notes, public feed, pin, and unread count
- Project page api and it'S new controller
- Employee costs and other costs on a project, stored as credit with no cash movement
- Contract cost on a project, and profit from that cost minus selling invoices, employee costs, and other costs
- Cash ledger totals by currency for the current history filters
- Customer and supplier opening balances, per currency, with a patch endpoint
- Cash tender on selling and buying invoices (tendered, applied, and change), plus the invoice currency and cash account
- Cash accounts keep a balance per currency, and ledger entries record that currency
- Bulk edit for products
- Delete is blocked, with a reason, for products, categories, customers, suppliers, partners, currencies, and expenses that are still in use
- Party invoice summaries grouped by party, using the exchange rate saved on each entry
- Selling invoices can be listed as a summary only
- Daily actions store the exchange rate used when they were saved
- Request logs include a request id

### Changed

- Cash account balance is stored per currency
- Invoice and party summaries convert amounts with the saved exchange rate
- Daily actions and party entries follow the selected warehouse
- Project owed amount includes employee costs and other costs
- Deleting a project is blocked when it still has a daily action
- Project totals match the project id, not its internal code

### Removed

- Unused mocks, the Content model, the initial product seed scripts, and unused request helpers
