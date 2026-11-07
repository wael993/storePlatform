import { sql } from 'drizzle-orm'
import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgSchema,
	primaryKey,
	text,
	uniqueIndex,
} from 'drizzle-orm/pg-core'
import { audit, docId, tenantCol, timestamps, tz } from './columns'

/**
 * Tenant business data. Every table has `tenant_id`; repositories must refuse
 * queries without tenant context (same role as `withTenantScope`).
 * Money, rates and quantities are unconstrained `numeric`: exact, and the ETL
 * loads Mongo doubles without rounding so reconcile can compare exactly.
 */
export const store = pgSchema('store')

const base = { ...docId, ...tenantCol, ...audit, ...timestamps }

// ---------- master data ----------

export const currencies = store.table(
	'currencies',
	{
		...base,
		currencyId: text().notNull(),
		name: text().notNull(),
		internalCode: text(),
	},
	t => [uniqueIndex().on(t.tenantId, t.currencyId)],
)

export const currencySettings = store.table('currency_settings', {
	...docId,
	tenantId: text().notNull().unique(),
	...timestamps,
})

/** `primaryCurrency` + `secondaryCurrencies[]` of CurrencySettings. */
export const currencySettingItems = store.table(
	'currency_setting_items',
	{
		...tenantCol,
		currencyId: text().notNull(),
		isPrimary: boolean().notNull(),
		position: integer().notNull(),
		name: text().notNull(),
		internalCode: text(),
		exchangeRate: numeric(),
		exchangeRateUnitCurrencyId: text(),
	},
	t => [primaryKey({ columns: [t.tenantId, t.currencyId] })],
)

export const units = store.table(
	'units',
	{
		...base,
		unitId: text().notNull(),
		name: text().notNull(),
		internalCode: text(),
	},
	t => [uniqueIndex().on(t.tenantId, t.unitId)],
)

export const expenses = store.table(
	'expenses',
	{
		...base,
		expenseId: text().notNull(),
		name: text().notNull(),
		internalCode: text(),
	},
	t => [uniqueIndex().on(t.tenantId, t.expenseId)],
)

export const categories = store.table(
	'categories',
	{
		...base,
		categoryId: text().notNull(),
		name: text().notNull(),
		description: text(),
		parentCategoryId: text(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.categoryId),
		index().on(t.tenantId, t.parentCategoryId),
	],
)

export const brands = store.table(
	'brands',
	{
		...base,
		brandId: text().notNull(),
		name: text().notNull(),
		description: text(),
	},
	t => [uniqueIndex().on(t.tenantId, t.brandId)],
)

export const shelves = store.table(
	'shelves',
	{
		...base,
		shelfId: text().notNull(),
		name: text().notNull(),
		description: text(),
	},
	t => [uniqueIndex().on(t.tenantId, t.shelfId)],
)

export const warehouses = store.table(
	'warehouses',
	{
		...base,
		warehouseId: text().notNull(),
		name: text().notNull(),
		code: text(),
		address: text(),
		status: text().notNull().default('active'),
		description: text(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.warehouseId),
		index().on(t.tenantId, t.status),
		index().on(t.tenantId, t.code),
	],
)

// ---------- parties ----------

const party = {
	...base,
	name: text().notNull(),
	internalCode: text(),
	email: text(),
	phone: text(),
	country: text(),
}

export const customers = store.table(
	'customers',
	{ ...party, customerId: text().notNull() },
	t => [
		uniqueIndex().on(t.tenantId, t.customerId),
		index().on(t.tenantId, t.name),
	],
)

export const suppliers = store.table(
	'suppliers',
	{
		...party,
		supplierId: text().notNull(),
		vatId: text(),
		aliases: text().array(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.supplierId),
		index().on(t.tenantId, t.name),
	],
)

export const partners = store.table(
	'partners',
	{ ...party, partnerId: text().notNull() },
	t => [
		uniqueIndex().on(t.tenantId, t.partnerId),
		index().on(t.tenantId, t.name),
	],
)

/** Customer / Supplier `openingBalances[]`. */
export const partyOpeningBalances = store.table(
	'party_opening_balances',
	{
		...tenantCol,
		partyType: text().notNull(), // 'customer' | 'supplier'
		partyId: text().notNull(),
		position: integer().notNull(),
		currencyId: text().notNull(),
		currencyCode: text().notNull(),
		amount: numeric().notNull(),
		direction: text().notNull(), // 'owed_to_us' | 'we_owe'
	},
	t => [
		primaryKey({ columns: [t.tenantId, t.partyType, t.partyId, t.position] }),
	],
)

export const projects = store.table(
	'projects',
	{
		...base,
		projectId: text().notNull(),
		internalCode: text(),
		name: text().notNull(),
		contractCost: numeric(),
	},
	t => [uniqueIndex().on(t.tenantId, t.projectId)],
)

export const employees = store.table(
	'employees',
	{
		...base,
		employeeId: text().notNull(),
		name: text().notNull(),
		phone: text(),
		address: text(),
		status: text().notNull().default('active'),
		employmentType: text().notNull(),
		startDate: date({ mode: 'string' }).notNull(),
		endDate: date({ mode: 'string' }),
		workingDays: text()
			.array()
			.notNull()
			.default(sql`'{}'`),
		workStart: text(),
		workEnd: text(),
	},
	t => [uniqueIndex().on(t.tenantId, t.employeeId)],
)

export const employeeSalaries = store.table(
	'employee_salaries',
	{
		...tenantCol,
		employeeId: text().notNull(),
		salaryId: text().notNull(),
		position: integer().notNull(),
		type: text().notNull(),
		amount: numeric().notNull(),
		currencyId: text().notNull(),
		currencyName: text().notNull(),
		effectiveDate: date({ mode: 'string' }).notNull(),
		overtimeRate: numeric(),
	},
	t => [
		primaryKey({ columns: [t.tenantId, t.salaryId] }),
		index().on(t.tenantId, t.employeeId),
	],
)

export const employeePayouts = store.table(
	'employee_payouts',
	{
		...tenantCol,
		employeeId: text().notNull(),
		payoutId: text().notNull(),
		position: integer().notNull(),
		date: date({ mode: 'string' }).notNull(),
		amount: numeric().notNull(),
		currencyId: text().notNull(),
		currencyName: text().notNull(),
		note: text(),
	},
	t => [
		primaryKey({ columns: [t.tenantId, t.payoutId] }),
		index().on(t.tenantId, t.employeeId),
	],
)

// ---------- catalog + stock ----------

export const products = store.table(
	'products',
	{
		...base,
		productId: text().notNull(),
		name: text().notNull(),
		latinName: text(),
		barcode: text(),
		additionalBarcodes: text().array(),
		internalCode: text(),
		productFactoryCode: text(),
		categoryId: text(),
		supplierId: text(),
		brandId: text(),
		taxRate: text(), // string in Mongo; kept as-is
		unitId: text(),
		purchasePrice: numeric(),
		retailPrice: numeric().notNull(),
		wholesalePrice: numeric(),
		semiWholesalePrice: numeric(),
		discount: numeric(),
		priceCurrency: text().notNull(),
		status: text().notNull().default('active'),
		attributes: jsonb(), // optional free-text strings (color, size, ...)
		images: text().array(),
		description: text(),
		aliases: text().array(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.productId),
		index().on(t.tenantId, t.status, t.name),
		index().on(t.tenantId, t.barcode),
	],
)

export const inventories = store.table(
	'inventories',
	{
		...base,
		inventoryId: text().notNull(),
		productId: text().notNull(),
		warehouseId: text().notNull(),
		shelfId: text(),
		quantity: numeric(),
		averageCost: numeric(),
		minQuantity: numeric(),
		maxQuantity: numeric(),
		reservedQuantity: numeric(),
		availableQuantity: numeric(),
		lastCountDate: tz(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.warehouseId, t.productId),
		uniqueIndex().on(t.tenantId, t.inventoryId),
	],
)

export const stockMovings = store.table(
	'stock_movings',
	{
		...base,
		stockMovingId: text().notNull(),
		productId: text().notNull(),
		warehouseId: text().notNull(),
		type: text().notNull(),
		quantity: numeric().notNull(),
		unitCost: numeric(),
		referenceType: text().notNull(),
		referenceId: text().notNull(),
		note: text(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.stockMovingId),
		index().on(t.tenantId, t.productId),
		index().on(t.tenantId, t.warehouseId),
		index().on(t.tenantId, t.referenceType, t.referenceId),
	],
)

// ---------- cash ----------

export const cashAccounts = store.table(
	'cash_accounts',
	{
		...base,
		cashAccountId: text().notNull(),
		warehouseId: text().notNull(),
		type: text().notNull(),
		name: text().notNull(),
		isActive: boolean().notNull().default(true),
		allowNegativeBalance: boolean().notNull().default(false),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.warehouseId, t.type),
		uniqueIndex().on(t.tenantId, t.cashAccountId),
	],
)

/** CashAccount `balances` map. Missing row = zero. Must equal the ledger sum. */
export const cashAccountBalances = store.table(
	'cash_account_balances',
	{
		...tenantCol,
		cashAccountId: text().notNull(),
		currencyId: text().notNull(),
		amount: numeric().notNull(),
	},
	t => [primaryKey({ columns: [t.tenantId, t.cashAccountId, t.currencyId] })],
)

/** Append-only. */
export const cashLedgerEntries = store.table(
	'cash_ledger_entries',
	{
		...base,
		ledgerEntryId: text().notNull(),
		warehouseId: text().notNull(),
		cashAccountId: text().notNull(),
		accountType: text().notNull(),
		currencyId: text().notNull(),
		amount: numeric().notNull(),
		movementType: text().notNull(),
		referenceType: text().notNull(),
		referenceId: text().notNull(),
		idempotencyKey: text().notNull(),
		transferGroupId: text(),
		reversesLedgerEntryId: text(),
		reason: text(),
		fromExchangeRateToPrimary: numeric(),
		toExchangeRateToPrimary: numeric(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.idempotencyKey),
		uniqueIndex().on(t.tenantId, t.ledgerEntryId),
		index().on(t.tenantId, t.referenceType, t.referenceId),
		index().on(t.tenantId, t.cashAccountId, t.createdAt),
		index().on(t.tenantId, t.warehouseId, t.accountType, t.createdAt),
	],
)

// ---------- invoices (selling = Mongo `Invoice`, buying = `BuyingInvoice`) ----------

const invoiceHeader = {
	...base,
	invoiceNumber: text(),
	paymentType: text(),
	status: text(),
	paymentStatus: text(),
	invoiceCurrencyId: text(),
	cashAccountType: text(),
	notes: text(),
	invoiceDiscount: numeric(),
	invoiceDiscountIsPercent: boolean(),
	warehouseId: text(),
	issuedAt: tz(),
}

// Child rows hang off the parent's `id` (`invoiceId` is not required in Mongo).
const itemCols = {
	...tenantCol,
	position: integer().notNull(),
	productId: text().notNull(),
	name: text().notNull(),
	barcode: text(),
	quantity: numeric().notNull(),
	unit: text(),
	unitPrice: numeric().notNull(),
	discount: numeric(),
	discountIsPercent: boolean(),
	taxRate: numeric(),
	lineTotal: numeric(),
}

const currencyAmountCols = {
	...tenantCol,
	position: integer().notNull(),
	currencyId: text().notNull(),
	name: text().notNull(),
	internalCode: text(),
	exchangeRate: numeric().notNull(),
	isPrimary: boolean().notNull().default(false),
	amount: numeric().notNull(),
	paidAmount: numeric().notNull(),
	remainingAmount: numeric().notNull(),
	subtotal: numeric().notNull(),
	tax: numeric().notNull(),
	discount: numeric().notNull(),
}

const tenderCols = {
	...tenantCol,
	position: integer().notNull(),
	currencyId: text().notNull(),
	tenderedAmount: numeric().notNull(),
	appliedAmount: numeric().notNull(),
	changeAmount: numeric().notNull(),
}

export const invoices = store.table(
	'invoices',
	{
		...invoiceHeader,
		invoiceId: text(),
		projectId: text(),
		customerId: text(),
		customerName: text(),
		salesPerson: text(),
		printAfterPayment: boolean(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.invoiceId),
		index().on(t.tenantId, t.invoiceNumber),
		index().on(t.tenantId, t.warehouseId),
		index().on(t.tenantId, t.customerId),
	],
)

const invoiceFk = () =>
	text()
		.notNull()
		.references(() => invoices.id, { onDelete: 'cascade' })

export const invoiceItems = store.table(
	'invoice_items',
	{ invoiceRowId: invoiceFk(), ...itemCols },
	t => [
		primaryKey({ columns: [t.invoiceRowId, t.position] }),
		index().on(t.tenantId, t.productId),
	],
)

export const invoiceCurrencyAmounts = store.table(
	'invoice_currency_amounts',
	{ invoiceRowId: invoiceFk(), ...currencyAmountCols },
	t => [primaryKey({ columns: [t.invoiceRowId, t.position] })],
)

export const invoiceTenders = store.table(
	'invoice_tenders',
	{ invoiceRowId: invoiceFk(), ...tenderCols },
	t => [primaryKey({ columns: [t.invoiceRowId, t.position] })],
)

export const buyingInvoices = store.table(
	'buying_invoices',
	{
		...invoiceHeader,
		buyingInvoiceId: text(),
		supplierId: text(),
		supplierName: text(),
		supplierInvoiceNumber: text(),
		sourceSupplierName: text(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.buyingInvoiceId),
		index().on(t.tenantId, t.invoiceNumber),
		index().on(t.tenantId, t.warehouseId),
		index().on(t.tenantId, t.supplierId),
	],
)

const buyingFk = () =>
	text()
		.notNull()
		.references(() => buyingInvoices.id, { onDelete: 'cascade' })

export const buyingInvoiceItems = store.table(
	'buying_invoice_items',
	{ buyingInvoiceRowId: buyingFk(), ...itemCols, sourceName: text() },
	t => [
		primaryKey({ columns: [t.buyingInvoiceRowId, t.position] }),
		index().on(t.tenantId, t.productId),
	],
)

export const buyingInvoiceCurrencyAmounts = store.table(
	'buying_invoice_currency_amounts',
	{ buyingInvoiceRowId: buyingFk(), ...currencyAmountCols },
	t => [primaryKey({ columns: [t.buyingInvoiceRowId, t.position] })],
)

export const buyingInvoiceTenders = store.table(
	'buying_invoice_tenders',
	{ buyingInvoiceRowId: buyingFk(), ...tenderCols },
	t => [primaryKey({ columns: [t.buyingInvoiceRowId, t.position] })],
)

/**
 * Legacy `SellingInvoiceItem` collection, still read by customer activity and
 * product-import delete checks.
 * shortcut: line items kept as jsonb (read-only legacy), normalize or drop when those 2 readers move to `invoices`.
 */
export const legacySellingInvoices = store.table(
	'legacy_selling_invoices',
	{
		...base,
		sellingInvoiceId: text().notNull(),
		customerId: text(),
		invoiceNumber: text().notNull(),
		items: jsonb().notNull().default([]),
		status: text(),
		paymentStatus: text(),
		paidAmount: numeric(),
		remainingAmount: numeric(),
		totalAmount: numeric().notNull(),
		totalTax: numeric().notNull(),
		totalDiscount: numeric().notNull(),
		totalAmountAfterDiscount: numeric().notNull(),
		totalAmountAfterTax: numeric().notNull(),
		totalAmountAfterDiscountAndTax: numeric().notNull(),
		warehouseId: text(),
		notes: text(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.sellingInvoiceId),
		index().on(t.tenantId, t.customerId),
	],
)

// ---------- activity ----------

export const dailyActions = store.table(
	'daily_actions',
	{
		...base,
		actionId: text(),
		entryType: text(),
		warehouseId: text(),
		productId: text(),
		invoiceNumber: text(),
		invoiceDate: tz(),
		productName: text(),
		supplierId: text(),
		supplierName: text(),
		partnerId: text(),
		partnerName: text(),
		customerId: text(),
		customerName: text(),
		projectId: text(),
		employeeId: text(),
		employeeName: text(),
		expenseId: text(),
		expenseName: text(),
		currencyId: text(),
		currencyName: text(),
		exchangeRateToPrimary: numeric(),
		cashAccountType: text(),
		unitId: text(),
		unitName: text(),
		// strings in Mongo and in the API contract; kept as-is
		weight: text(),
		singleUnitPrice: text(),
		totalPrice: text(),
		note: text(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.actionId),
		index().on(t.tenantId, t.entryType),
		index().on(t.tenantId, t.warehouseId, t.invoiceDate),
		index().on(t.tenantId, t.createdAt),
	],
)

// ---------- settings ----------

export const invoiceSettings = store.table('invoice_settings', {
	...docId,
	tenantId: text().notNull().unique(),
	noMergeInvoiceLines: boolean(),
	allowOversell: boolean(),
	displayName: text(),
	address: text(),
	phone: text(),
	email: text(),
	taxNumber: text(),
	logoUrl: text(),
	qrUrl: text(),
	footerNote: text(),
	...timestamps,
})

export const labelTemplates = store.table(
	'label_templates',
	{
		...base,
		templateId: text().notNull(),
		name: text().notNull(),
		isDefault: boolean().notNull().default(false),
		layout: jsonb().notNull(),
	},
	t => [
		uniqueIndex().on(t.tenantId, t.templateId),
		uniqueIndex()
			.on(t.tenantId)
			.where(sql`${t.isDefault}`),
	],
)

export const userSettings = store.table(
	'user_settings',
	{
		...docId,
		...tenantCol,
		userId: text().notNull(),
		productsPerPage: integer(),
		displayLanguage: text(),
		defaultInvoiceCurrencyId: text(),
		columnConfigs: jsonb(), // UI preferences
		...timestamps,
	},
	t => [uniqueIndex().on(t.tenantId, t.userId)],
)

export const tenantRolePermissions = store.table(
	'tenant_role_permissions',
	{
		...docId,
		...tenantCol,
		role: text().notNull(),
		see: text()
			.array()
			.notNull()
			.default(sql`'{}'`),
		...timestamps,
	},
	t => [uniqueIndex().on(t.tenantId, t.role)],
)

export const reports = store.table(
	'reports',
	{
		...docId,
		...tenantCol,
		reportId: text(),
		name: text(),
		type: text(),
		periodStart: tz(),
		periodEnd: tz(),
		data: jsonb(),
		createdBy: text(), // plain user id string on this model
		updatedBy: text(),
		...timestamps,
	},
	t => [uniqueIndex().on(t.tenantId, t.reportId)],
)

// ---------- derived / transient / per-user ----------

export const negativeQuantitySnapshots = store.table(
	'negative_quantity_snapshots',
	{
		...base,
		type: text().notNull(),
		runAt: tz(),
		productIds: text()
			.array()
			.notNull()
			.default(sql`'{}'`),
		count: integer().notNull().default(0),
	},
	t => [uniqueIndex().on(t.tenantId, t.type)],
)

export const notificationReads = store.table(
	'notification_reads',
	{
		...docId,
		...tenantCol,
		userId: text().notNull(),
		runAt: tz().notNull(),
		type: text().notNull(),
		...timestamps,
	},
	t => [uniqueIndex().on(t.tenantId, t.userId, t.runAt, t.type)],
)

/** Import drafts. Mongo TTL index on `expiresAt` becomes a cron delete (PG-MIG-2). */
export const productImportSessions = store.table(
	'product_import_sessions',
	{
		...docId,
		...tenantCol,
		sessionId: text().notNull().unique(),
		status: text(),
		files: jsonb().notNull().default([]),
		mapping: jsonb(),
		selectedFields: text().array(),
		masterResolutions: jsonb(),
		createdMasterData: jsonb(),
		currency: text(),
		expiresAt: tz().notNull(),
		...timestamps,
	},
	t => [index().on(t.tenantId), index().on(t.expiresAt)],
)

// ---------- offline sync (ETL required: idempotency must survive cutover) ----------

export const offlineSyncStates = store.table('offline_sync_states', {
	...docId,
	tenantId: text().notNull().unique(),
	nextBlockStart: integer(),
	minOnlineInvoiceNumber: integer(),
	buyingNextBlockStart: integer(),
	minOnlineBuyingInvoiceNumber: integer(),
	...audit,
	...timestamps,
})

export const syncMutations = store.table(
	'sync_mutations',
	{
		...base,
		clientMutationId: text().notNull(),
		entity: text().notNull(),
		operation: text().notNull(),
		result: jsonb(),
		error: text(),
		processedAt: tz().notNull().defaultNow(),
	},
	t => [uniqueIndex().on(t.tenantId, t.clientMutationId)],
)
