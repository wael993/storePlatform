# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),

## [Unreleased]

## [1.1.0] - 2026-10-19

### Fixed

- Project list total shows what the project owes us, or what we owe the project

### Added

- Newsroom feed of release notes, with pin and unread, plus Super Admin topics and editor
- New Project page with it's all invoices and entries
- Employee costs and other costs on a project, as credit owed to us
- Contract cost on a project, and profit from that cost minus selling invoices, employee costs, and other costs
- Cash history shows the sum of a filtered movement type, by currency
- Dashboard cards for sales, profit, receivables, best sellers, and cash balances by currency
- Bulk edit for selected products
- Opening balances on customer and supplier summaries
- Paid and change amounts on invoices, including cash tendered
- Shared activity list for customers and suppliers
- Top bar shortcuts to dashboard, products, projects, customers, suppliers, and selling invoices
- Offline cash transfers and cash balances per currency
- New Rivo logo, favicon, and app icons

### Changed

- Invoice summaries and party balances use the saved exchange rate
- Lists explain why a record cannot be deleted when it is still in use
- A selling invoice or a receipt can be assigned to a project
- Customer, supplier, and partner codes are generated the same way as project codes
- A new app build reloads hidden tabs; hashed assets stay cached and the shell is fetched fresh

### Removed

- Unused daily-action screens, the old customer and supplier invoice tabs, and other unused UI
