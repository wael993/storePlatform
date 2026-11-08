import { readdirSync } from 'fs'
import mongoose from 'mongoose'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'

import * as schema from '../db/schema'

/** Mongoose model name → Postgres table (`schema.table`). A new model must be added here. */
const MODEL_TABLES: Record<string, string> = {
	Brand: 'store.brands',
	BuyingInvoice: 'store.buying_invoices',
	CashAccount: 'store.cash_accounts',
	CashLedgerEntry: 'store.cash_ledger_entries',
	Category: 'store.categories',
	Currency: 'store.currencies',
	CurrencySettings: 'store.currency_settings',
	Customer: 'store.customers',
	DailyAction: 'store.daily_actions',
	Employee: 'store.employees',
	Expense: 'store.expenses',
	Inventory: 'store.inventories',
	Invoice: 'store.invoices',
	InvoiceSettings: 'store.invoice_settings',
	LabelTemplate: 'store.label_templates',
	NegativeQuantitySnapshot: 'store.negative_quantity_snapshots',
	NotificationRead: 'store.notification_reads',
	OfflineSyncState: 'store.offline_sync_states',
	Partner: 'store.partners',
	ProductImportSession: 'store.product_import_sessions',
	Products: 'store.products',
	Project: 'store.projects',
	Report: 'store.reports',
	SellingInvoiceItem: 'store.legacy_selling_invoices',
	Shelf: 'store.shelves',
	StockMovings: 'store.stock_movings',
	Supplier: 'store.suppliers',
	SyncMutation: 'store.sync_mutations',
	TenantRolePermission: 'store.tenant_role_permissions',
	Unit: 'store.units',
	UserSettings: 'store.user_settings',
	Warehouses: 'store.warehouses',
	Tenant: 'platform.tenants',
	User: 'platform.users',
	RefreshToken: 'platform.refresh_tokens',
	Roles: 'platform.roles',
	SubscriptionPaymentSettings: 'platform.subscription_payment_settings',
	SubscriptionRenewalRequest: 'platform.subscription_renewal_requests',
	NewsroomTopic: 'platform.newsroom_topics',
	NewsroomReleaseNote: 'platform.newsroom_release_notes',
	NewsroomChange: 'platform.newsroom_changes',
	NewsroomUserState: 'platform.newsroom_user_states',
}

const tables = Object.values(schema)
	.filter((value): value is PgTable => value instanceof PgTable)
	.map(getTableConfig)

describe('Postgres schema covers every Mongo model', () => {
	it('maps each registered model to an existing table', async () => {
		const modelsDir = path.join(__dirname, '../models')

		for (const file of readdirSync(modelsDir)) {
			await import(path.join(modelsDir, file))
		}

		const tableNames = new Set(tables.map(t => `${t.schema}.${t.name}`))

		expect(mongoose.modelNames().sort()).toEqual(
			Object.keys(MODEL_TABLES).sort(),
		)

		for (const table of Object.values(MODEL_TABLES)) {
			expect(tableNames).toContain(table)
		}
	})

	it('puts tenant_id on every store table', () => {
		const missing = tables
			.filter(t => t.schema === 'store')
			.filter(t => !t.columns.some(c => c.name === 'tenantId'))
			.map(t => t.name)

		expect(missing).toEqual([])
	})

	it('stores no money or quantity as float', () => {
		const floats = tables.flatMap(t =>
			t.columns
				.filter(c => ['PgReal', 'PgDoublePrecision'].includes(c.columnType))
				.map(c => `${t.name}.${c.name}`),
		)

		expect(floats).toEqual([])
	})
})
