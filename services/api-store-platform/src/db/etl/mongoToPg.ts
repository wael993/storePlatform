import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as t from '../schema'

/**
 * Pure Mongo document → Postgres rows mapping for the ETL (PG-MIG-1 dry run,
 * PG-MIG-3 copy). Column keys equal Mongo field names, so most collections map
 * generically; specs below only flatten nested shapes or explode arrays into
 * child tables. Any top-level field that lands nowhere is reported, never
 * dropped silently.
 */

export type Doc = Record<string, unknown>
export type Row = Record<string, unknown>
export type Scope = 'tenant' | 'global'

type Child = { table: PgTable; docs: Doc[]; parent: Doc }

export type Spec = {
	model: string
	table: PgTable
	scope: Scope
	/** Returns the doc to map generically; remove keys that go to children. */
	flatten?: (doc: Doc) => Doc
	/**
	 * Fields that exist in Mongo but not in the Mongoose schema. `.lean()` reads
	 * DID return them, but no code (API, web, store-domain) reads them (grep
	 * checked per field), so they are dropped on purpose.
	 */
	dropped?: string[]
	children?: (doc: Doc) => Child[]
}

const ALWAYS_IGNORED = new Set(['_id', '__v'])

const isBson = (value: unknown, type: string) =>
	typeof value === 'object' &&
	value !== null &&
	(value as { _bsontype?: string })._bsontype === type

const toNumericString = (value: unknown): string => {
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) {
			throw new Error(`non-finite number ${value}`)
		}

		return String(value) // exact repr of the stored double, no rounding
	}

	if (isBson(value, 'Decimal128') || typeof value === 'string') {
		return String(value)
	}

	throw new Error(`not a number: ${JSON.stringify(value)}`)
}

const coerce = (columnType: string, value: unknown): unknown => {
	if (value === null) {
		return null
	}

	switch (columnType) {
		case 'PgNumeric':
			return toNumericString(value)
		case 'PgTimestamp':
			return value instanceof Date ? value : new Date(value as string)
		case 'PgInteger':
			return Number(value)
		case 'PgBoolean':
			return Boolean(value)
		case 'PgArray':
			return (value as unknown[]).map(item => String(item))
		case 'PgJsonb':
			return JSON.parse(JSON.stringify(value)) // ObjectId → hex, Date → ISO

		default:
			return String(value) // text, date strings, ObjectId → hex
	}
}

const objectIdTime = (id: unknown): Date | undefined =>
	isBson(id, 'ObjectId')
		? (id as { getTimestamp(): Date }).getTimestamp()
		: undefined

type Actor = { _id?: unknown; displayName?: string; role?: string }

const auditSource = (doc: Doc): Doc => {
	const created = (doc.createdBy ?? {}) as Actor & { createdAt?: Date }
	const updated = (doc.updatedBy ?? {}) as Actor & { updatedAt?: Date }

	return {
		createdById: created._id,
		createdByName: created.displayName,
		createdByRole: created.role,
		createdByAt: created.createdAt,
		updatedById: updated._id,
		updatedByName: updated.displayName,
		updatedByRole: updated.role,
		updatedByAt: updated.updatedAt,
	}
}

/** Maps one flat doc onto a table's columns; records which doc keys were used. */
export const mapRow = (
	table: PgTable,
	doc: Doc,
	used: Set<string> = new Set(),
): Row => {
	const columns = getTableConfig(table).columns
	const hasAudit = columns.some(c => c.name === 'createdById')
	const source: Doc = { ...doc, ...(hasAudit ? auditSource(doc) : {}) }

	if (hasAudit) {
		used.add('createdBy').add('updatedBy')
	}

	if (source.createdAt === undefined) {
		source.createdAt =
			objectIdTime(doc._id) ??
			(doc.createdBy as { createdAt?: Date })?.createdAt
	}

	if (source.updatedAt === undefined) {
		source.updatedAt =
			(doc.updatedBy as { updatedAt?: Date })?.updatedAt ?? source.createdAt
	}

	const row: Row = {}

	for (const column of columns) {
		const key = column.name
		const value = key === 'id' ? doc._id : source[key]

		const where = `${getTableConfig(table).name}.${key} (_id ${String(doc._id)})`

		used.add(key)
		if (value === undefined || value === null) {
			if (column.notNull && !column.hasDefault) {
				throw new Error(`${where}: required value missing`)
			}

			if (value === undefined || column.notNull) {
				continue // let the column default apply, like a Mongoose default
			}
		}

		try {
			row[key] = coerce(column.columnType, value)
		} catch (error) {
			throw new Error(`${where}: ${(error as Error).message}`)
		}
	}

	return row
}

const unusedKeys = (doc: Doc, used: Set<string>) =>
	Object.keys(doc).filter(key => !used.has(key) && !ALWAYS_IGNORED.has(key))

export type MapResult = {
	rows: Map<PgTable, Row[]>
	/** `table.field` → number of docs where it would be dropped. */
	unmapped: Map<string, number>
	/** Docs that cannot be loaded as they are (data must be fixed in Mongo first). */
	errors: string[]
}

export const mapDocs = (spec: Spec, docs: Doc[], result: MapResult) => {
	const push = (table: PgTable, row: Row) => {
		const list = result.rows.get(table) ?? []

		list.push(row)
		result.rows.set(table, list)
	}
	const report = (table: PgTable, keys: string[]) => {
		for (const key of keys) {
			const label = `${getTableConfig(table).name}.${key}`

			result.unmapped.set(label, (result.unmapped.get(label) ?? 0) + 1)
		}
	}

	for (const doc of docs) {
		try {
			mapOne(doc)
		} catch (error) {
			result.errors.push((error as Error).message)
		}
	}

	function mapOne(doc: Doc) {
		const kept = spec.dropped ? without(doc, ...spec.dropped) : doc
		const flat = spec.flatten ? spec.flatten(kept) : kept
		const used = new Set<string>()

		push(spec.table, mapRow(spec.table, flat, used))
		report(spec.table, unusedKeys(flat, used))

		for (const child of spec.children?.(doc) ?? []) {
			child.docs.forEach((item, position) => {
				const childUsed = new Set<string>()
				const row = mapRow(
					child.table,
					{ ...item, tenantId: child.parent.tenantId, position },
					childUsed,
				)

				push(child.table, row)
				report(child.table, unusedKeys(item, childUsed))
			})
		}
	}
}

// ---------- specs ----------

const list = (value: unknown): Doc[] => (Array.isArray(value) ? value : [])

const without = (doc: Doc, ...keys: string[]): Doc => {
	const copy = { ...doc }

	for (const key of keys) {
		delete copy[key]
	}

	return copy
}

const sub = (doc: Doc, key: string): Doc => (doc[key] ?? {}) as Doc

const invoiceChildren =
	(items: PgTable, amounts: PgTable, tenders: PgTable, parentKey: string) =>
	(doc: Doc): Child[] => {
		const link = (rows: Doc[]) =>
			rows.map(row => ({ ...row, [parentKey]: doc._id }))

		return [
			{ table: items, docs: link(list(doc.items)), parent: doc },
			{ table: amounts, docs: link(list(doc.currencyAmounts)), parent: doc },
			{ table: tenders, docs: link(list(doc.tenders)), parent: doc },
		]
	}

const openingBalances =
	(partyType: 'customer' | 'supplier', idKey: string) =>
	(doc: Doc): Child[] => [
		{
			table: t.partyOpeningBalances,
			docs: list(doc.openingBalances).map(item => ({
				...item,
				partyType,
				partyId: doc[idKey],
			})),
			parent: doc,
		},
	]

export const SPECS: Spec[] = [
	// platform
	{
		model: 'Tenant',
		// rolePermissions: pre-TenantRolePermission copy; backupRestoreStartedAt: parked backup lock
		dropped: ['rolePermissions', 'backupRestoreStartedAt'],
		table: t.tenants,
		scope: 'tenant',
		flatten: doc => {
			const ai = sub(doc, 'invoiceAi')
			const subscription = sub(doc, 'subscription')

			return {
				...without(doc, 'invoiceAi', 'subscription', 'productImport'),
				invoiceAiMonthlyLimit: ai.monthlyLimit,
				invoiceAiActivatedAt: ai.activatedAt,
				invoiceAiPeriodStart: ai.periodStart,
				invoiceAiUsedInPeriod: ai.usedInPeriod,
				invoiceAiCarryOver: ai.carryOver,
				productImportStatus: sub(doc, 'productImport').status,
				subscriptionStartDate: subscription.startDate,
				subscriptionRenewalDate: subscription.renewalDate,
				subscriptionStatus: subscription.status,
				subscriptionRenewalEnabled: subscription.renewalEnabled,
				subscriptionLastRenewalDate: subscription.lastRenewalDate,
				subscriptionNotifiedForDate: subscription.notifiedForDate,
				subscriptionCreatedAt: subscription.createdAt,
				subscriptionUpdatedAt: subscription.updatedAt,
			}
		},
	},
	{
		model: 'User',
		table: t.users,
		scope: 'tenant',
		flatten: doc => ({
			...without(doc, 'user'),
			firstName: sub(doc, 'user').firstName,
			lastName: sub(doc, 'user').lastName,
		}),
	},
	{ model: 'RefreshToken', table: t.refreshTokens, scope: 'tenant' },
	{
		model: 'SubscriptionRenewalRequest',
		table: t.subscriptionRenewalRequests,
		scope: 'tenant',
		flatten: doc => ({
			...without(doc, 'requestedBy', 'reviewedBy'),
			requestedById: sub(doc, 'requestedBy').userId,
			requestedByName: sub(doc, 'requestedBy').displayName,
			reviewedById: sub(doc, 'reviewedBy').userId,
			reviewedByName: sub(doc, 'reviewedBy').displayName,
		}),
	},
	{ model: 'Roles', table: t.roles, scope: 'global' },
	{
		model: 'SubscriptionPaymentSettings',
		table: t.subscriptionPaymentSettings,
		scope: 'global',
	},
	{ model: 'NewsroomTopic', table: t.newsroomTopics, scope: 'global' },
	{
		model: 'NewsroomReleaseNote',
		table: t.newsroomReleaseNotes,
		scope: 'global',
	},
	{ model: 'NewsroomChange', table: t.newsroomChanges, scope: 'global' },
	{ model: 'NewsroomUserState', table: t.newsroomUserStates, scope: 'global' },

	// store: master data
	{ model: 'Currency', table: t.currencies, scope: 'tenant' },
	{
		model: 'CurrencySettings',
		table: t.currencySettings,
		scope: 'tenant',
		dropped: ['roundConvertedCurrencyAmounts'], // no code or history reads it
		flatten: doc => without(doc, 'primaryCurrency', 'secondaryCurrencies'),
		children: doc => [
			{
				table: t.currencySettingItems,
				docs: [
					...(doc.primaryCurrency
						? [{ ...(doc.primaryCurrency as Doc), isPrimary: true }]
						: []),
					...list(doc.secondaryCurrencies).map(item => ({
						...item,
						isPrimary: false,
					})),
				],
				parent: doc,
			},
		],
	},
	{ model: 'Unit', table: t.units, scope: 'tenant' },
	{ model: 'Expense', table: t.expenses, scope: 'tenant' },
	{ model: 'Category', table: t.categories, scope: 'tenant' },
	{ model: 'Brand', table: t.brands, scope: 'tenant' },
	{ model: 'Shelf', table: t.shelves, scope: 'tenant' },
	{ model: 'Warehouses', table: t.warehouses, scope: 'tenant' },

	// store: parties
	{
		model: 'Customer',
		// old soft-delete flag; today's app ignores it and lists these customers
		dropped: ['isDeleted'],
		table: t.customers,
		scope: 'tenant',
		flatten: doc => without(doc, 'openingBalances'),
		children: openingBalances('customer', 'customerId'),
	},
	{
		model: 'Supplier',
		table: t.suppliers,
		scope: 'tenant',
		flatten: doc => without(doc, 'openingBalances'),
		children: openingBalances('supplier', 'supplierId'),
	},
	{ model: 'Partner', table: t.partners, scope: 'tenant' },
	{ model: 'Project', table: t.projects, scope: 'tenant' },
	{
		model: 'Employee',
		table: t.employees,
		scope: 'tenant',
		flatten: doc => without(doc, 'salaries', 'payouts'),
		children: doc => [
			{
				table: t.employeeSalaries,
				docs: list(doc.salaries).map(s => ({
					...s,
					employeeId: doc.employeeId,
				})),
				parent: doc,
			},
			{
				table: t.employeePayouts,
				docs: list(doc.payouts).map(p => ({
					...p,
					employeeId: doc.employeeId,
				})),
				parent: doc,
			},
		],
	},

	// store: catalog + stock
	{
		model: 'Products',
		// pre-inventory `stock.quantity` and free-text `unit` (now Inventory + unitId)
		dropped: ['stock', 'unit'],
		table: t.products,
		scope: 'tenant',
		flatten: doc => {
			const price = sub(doc, 'price')

			return {
				...without(doc, 'price'),
				purchasePrice: price.purchasePrice,
				retailPrice: price.retailPrice,
				wholesalePrice: price.wholesalePrice,
				semiWholesalePrice: price.semiWholesalePrice,
				discount: price.discount,
				priceCurrency: price.currency,
			}
		},
	},
	{ model: 'Inventory', table: t.inventories, scope: 'tenant' },
	{ model: 'StockMovings', table: t.stockMovings, scope: 'tenant' },

	// store: cash
	{
		model: 'CashAccount',
		table: t.cashAccounts,
		scope: 'tenant',
		flatten: doc => without(doc, 'balances'),
		children: doc => [
			{
				table: t.cashAccountBalances,
				docs: Object.entries(
					(doc.balances ?? {}) as Record<string, unknown>,
				).map(([currencyId, amount]) => ({
					cashAccountId: doc.cashAccountId,
					currencyId,
					amount,
				})),
				parent: doc,
			},
		],
	},
	{ model: 'CashLedgerEntry', table: t.cashLedgerEntries, scope: 'tenant' },

	// store: invoices
	{
		model: 'Invoice',
		table: t.invoices,
		scope: 'tenant',
		flatten: doc => without(doc, 'items', 'currencyAmounts', 'tenders'),
		children: invoiceChildren(
			t.invoiceItems,
			t.invoiceCurrencyAmounts,
			t.invoiceTenders,
			'invoiceRowId',
		),
	},
	{
		model: 'BuyingInvoice',
		table: t.buyingInvoices,
		scope: 'tenant',
		flatten: doc => without(doc, 'items', 'currencyAmounts', 'tenders'),
		children: invoiceChildren(
			t.buyingInvoiceItems,
			t.buyingInvoiceCurrencyAmounts,
			t.buyingInvoiceTenders,
			'buyingInvoiceRowId',
		),
	},
	{
		model: 'SellingInvoiceItem',
		table: t.legacySellingInvoices,
		scope: 'tenant',
	},

	// store: activity, settings, derived, sync
	{ model: 'DailyAction', table: t.dailyActions, scope: 'tenant' },
	{ model: 'InvoiceSettings', table: t.invoiceSettings, scope: 'tenant' },
	{ model: 'LabelTemplate', table: t.labelTemplates, scope: 'tenant' },
	{ model: 'UserSettings', table: t.userSettings, scope: 'tenant' },
	{
		model: 'TenantRolePermission',
		table: t.tenantRolePermissions,
		scope: 'tenant',
	},
	{ model: 'Report', table: t.reports, scope: 'tenant' },
	{
		model: 'NegativeQuantitySnapshot',
		table: t.negativeQuantitySnapshots,
		scope: 'tenant',
	},
	{ model: 'NotificationRead', table: t.notificationReads, scope: 'tenant' },
	{
		model: 'ProductImportSession',
		table: t.productImportSessions,
		scope: 'tenant',
	},
	{ model: 'OfflineSyncState', table: t.offlineSyncStates, scope: 'tenant' },
	{ model: 'SyncMutation', table: t.syncMutations, scope: 'tenant' },
]
