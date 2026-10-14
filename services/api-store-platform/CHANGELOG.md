# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),

## [Unreleased]

### Fixed

- Raise the invoice-settings body limit so logo and QR code uploads are not rejected for size

### Added

- Project page api and it'S new controller
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

### Removed

- Unused mocks, the Content model, the initial product seed scripts, and unused request helpers

## [1.1.155] - 2026-10-07
