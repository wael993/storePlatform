import { Invoice } from '../../models/Invoice'
import { BuyingInvoice } from '../../models/BuyingInvoices'
import { StockMoving } from '../../models/StockMovings'
import { InvoiceStatus } from '../globalEnums'
import { withTenantScope } from '../mongodb/tenantScopedModel'
import { getPrimaryInvoiceCurrencyAmounts } from '../invoiceCurrency'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import { ReportToolName } from './types'

const EXCLUDED_STATUS = [
	InvoiceStatus.DRAFT,
	InvoiceStatus.CANCELLED,
	InvoiceStatus.VOID,
	InvoiceStatus.PENDING,
]
const MAX_INVOICES = 5000
const MAX_LIMIT = 20
const MAX_SPAN_MS = 400 * 24 * 60 * 60 * 1000

type Period = { start: Date; end: Date }

const isYmd = (value: unknown): value is string =>
	typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

const ymdOrThrow = (value: unknown, field: string): string | undefined => {
	if (value == null || value === '') return undefined

	if (!isYmd(value)) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			`${field} must be YYYY-MM-DD.`,
		)
	}

	return value
}

const periodFromArgs = (args: Record<string, unknown>, now: Date): Period => {
	let startDate =
		ymdOrThrow(args.startDate, 'startDate') ??
		new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10)
	let endDate =
		ymdOrThrow(args.endDate, 'endDate') ?? now.toISOString().slice(0, 10)

	if (startDate > endDate) {
		;[startDate, endDate] = [endDate, startDate]
	}

	// ponytail: UTC calendar days. Upgrade to config.cron.timezone offsets if local-midnight reports matter.
	const start = new Date(`${startDate}T00:00:00.000Z`)
	const end = new Date(`${endDate}T23:59:59.999Z`)

	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'startDate and endDate must be YYYY-MM-DD.',
		)
	}

	if (end.getTime() - start.getTime() > MAX_SPAN_MS) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Date range cannot exceed 400 days.',
		)
	}

	return { start, end }
}

const parseLimit = (args: Record<string, unknown>, fallback = 5): number => {
	const raw = typeof args.limit === 'number' ? args.limit : Number(args.limit)
	const limit = Number.isInteger(raw) ? raw : fallback

	return Math.min(MAX_LIMIT, Math.max(1, limit))
}

const countedMatch = (extra: Record<string, unknown> = {}) => ({
	status: { $nin: EXCLUDED_STATUS },
	...extra,
})

const loadSales = async (tenantId: string, period: Period) => {
	const invoices = await withTenantScope(
		Invoice.find(
			countedMatch({
				issuedAt: { $gte: period.start, $lte: period.end },
			}),
		)
			.select({
				invoiceId: 1,
				invoiceNumber: 1,
				issuedAt: 1,
				items: 1,
				currencyAmounts: 1,
			})
			.limit(MAX_INVOICES + 1)
			.lean(),
		tenantId,
	)

	if (invoices.length > MAX_INVOICES) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Too many invoices in this range. Narrow the dates.',
		)
	}

	return invoices
}

const optionalPeriodFromArgs = (
	args: Record<string, unknown>,
	now: Date,
): Period | undefined => {
	if (args.startDate == null && args.endDate == null) return undefined

	return periodFromArgs(args, now)
}

const loadOutstandingSales = async (tenantId: string, period?: Period) => {
	const invoices = await withTenantScope(
		Invoice.find(
			countedMatch({
				...(period
					? { issuedAt: { $gte: period.start, $lte: period.end } }
					: {}),
				$or: [
					{ 'currencyAmounts.remainingAmount': { $gt: 0 } },
					{ remainingAmount: { $gt: 0 } },
				],
			}),
		)
			.select({
				invoiceId: 1,
				customerId: 1,
				customerName: 1,
				currencyAmounts: 1,
				remainingAmount: 1,
			})
			.limit(MAX_INVOICES + 1)
			.lean(),
		tenantId,
	)

	if (invoices.length > MAX_INVOICES) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Too many invoices in this range. Narrow the dates.',
		)
	}

	return invoices
}

const loadPurchases = async (
	tenantId: string,
	period: Period,
	supplierNeedle?: string,
) => {
	const filter = countedMatch({
		issuedAt: { $gte: period.start, $lte: period.end },
		...(supplierNeedle
			? {
					$or: [
						{
							supplierName: {
								$regex: supplierNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
								$options: 'i',
							},
						},
						{
							sourceSupplierName: {
								$regex: supplierNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
								$options: 'i',
							},
						},
					],
				}
			: {}),
	})

	const invoices = await withTenantScope(
		BuyingInvoice.find(filter)
			.select({
				buyingInvoiceId: 1,
				invoiceNumber: 1,
				issuedAt: 1,
				supplierId: 1,
				supplierName: 1,
				items: 1,
				currencyAmounts: 1,
			})
			.limit(MAX_INVOICES + 1)
			.lean(),
		tenantId,
	)

	if (invoices.length > MAX_INVOICES) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Too many invoices in this range. Narrow the dates.',
		)
	}

	return invoices
}

const lineRevenue = (item: {
	lineTotal?: number
	quantity?: number
	unitPrice?: number
}): number => {
	if (item.lineTotal != null) return Number(item.lineTotal) || 0

	return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
}

const topSellingProducts = async (
	tenantId: string,
	args: Record<string, unknown>,
	now: Date,
) => {
	const period = periodFromArgs(args, now)
	const limit = parseLimit(args)
	const invoices = await loadSales(tenantId, period)
	const byProduct = new Map<
		string,
		{ productId: string; name: string; quantity: number; revenue: number }
	>()

	for (const invoice of invoices) {
		for (const item of invoice.items ?? []) {
			const productId = item.productId || item.name
			const row = byProduct.get(productId) ?? {
				productId,
				name: item.name,
				quantity: 0,
				revenue: 0,
			}

			row.quantity += Number(item.quantity) || 0
			row.revenue += lineRevenue(item)
			if (!row.name && item.name) row.name = item.name

			byProduct.set(productId, row)
		}
	}

	return {
		period,
		products: [...byProduct.values()]
			.sort(
				(left, right) =>
					right.quantity - left.quantity || right.revenue - left.revenue,
			)
			.slice(0, limit),
	}
}

const salesSummary = async (
	tenantId: string,
	args: Record<string, unknown>,
	now: Date,
) => {
	const period = periodFromArgs(args, now)
	const invoices = await loadSales(tenantId, period)
	let revenue = 0

	for (const invoice of invoices) {
		revenue += getPrimaryInvoiceCurrencyAmounts(invoice).grandTotal
	}

	return {
		period,
		invoiceCount: invoices.length,
		revenue: Math.round(revenue * 100) / 100,
	}
}

const purchaseSummary = async (
	tenantId: string,
	args: Record<string, unknown>,
	now: Date,
) => {
	const period = periodFromArgs(args, now)
	const supplierName =
		typeof args.supplierName === 'string'
			? args.supplierName.trim().slice(0, 80)
			: ''
	const invoices = await loadPurchases(
		tenantId,
		period,
		supplierName || undefined,
	)
	let spend = 0
	let quantity = 0

	for (const invoice of invoices) {
		spend += getPrimaryInvoiceCurrencyAmounts(invoice).grandTotal
		for (const item of invoice.items ?? []) {
			quantity += Number(item.quantity) || 0
		}
	}

	return {
		period,
		supplierName: supplierName || null,
		invoiceCount: invoices.length,
		quantity,
		spend: Math.round(spend * 100) / 100,
	}
}

const profitSummary = async (
	tenantId: string,
	args: Record<string, unknown>,
	now: Date,
) => {
	const period = periodFromArgs(args, now)
	const invoices = await loadSales(tenantId, period)
	let revenue = 0

	for (const invoice of invoices) {
		revenue += getPrimaryInvoiceCurrencyAmounts(invoice).grandTotal
	}

	revenue = Math.round(revenue * 100) / 100
	const invoiceIds = invoices.map(invoice => invoice.invoiceId).filter(Boolean)
	const movings = invoiceIds.length
		? await withTenantScope(
				StockMoving.find({
					type: 'sale',
					referenceType: 'selling_invoice',
					referenceId: { $in: invoiceIds },
				})
					.select({ quantity: 1, unitCost: 1 })
					.limit(20_001)
					.lean(),
				tenantId,
			)
		: []

	if (movings.length > 20_000) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Too many invoices in this range. Narrow the dates.',
		)
	}

	let cogs = 0

	for (const moving of movings) {
		cogs += (Number(moving.quantity) || 0) * (Number(moving.unitCost) || 0)
	}

	const cost = Math.round(cogs * 100) / 100

	return {
		period,
		revenue,
		cost,
		profit: Math.round((revenue - cost) * 100) / 100,
		costSource: movings.length ? 'stock_movings' : 'none',
	}
}

const topSuppliers = async (
	tenantId: string,
	args: Record<string, unknown>,
	now: Date,
) => {
	const period = periodFromArgs(args, now)
	const limit = parseLimit(args)
	const invoices = await loadPurchases(tenantId, period)
	const bySupplier = new Map<
		string,
		{
			supplierId: string | null
			name: string
			invoiceCount: number
			spend: number
		}
	>()

	for (const invoice of invoices) {
		const name = invoice.supplierName?.trim() || 'Unknown supplier'
		const key = invoice.supplierId || name
		const row = bySupplier.get(key) ?? {
			supplierId: invoice.supplierId ?? null,
			name,
			invoiceCount: 0,
			spend: 0,
		}

		row.invoiceCount += 1
		row.spend += getPrimaryInvoiceCurrencyAmounts(invoice).grandTotal
		bySupplier.set(key, row)
	}

	return {
		period,
		suppliers: [...bySupplier.values()]
			.sort((left, right) => right.spend - left.spend)
			.slice(0, limit)
			.map(row => ({
				...row,
				spend: Math.round(row.spend * 100) / 100,
			})),
	}
}

const topCustomersByOutstanding = async (
	tenantId: string,
	args: Record<string, unknown>,
	now: Date,
) => {
	const period = optionalPeriodFromArgs(args, now)
	const limit = parseLimit(args)
	const invoices = await loadOutstandingSales(tenantId, period)
	const byCustomer = new Map<
		string,
		{
			customerId: string | null
			name: string
			invoiceCount: number
			outstanding: number
		}
	>()

	for (const invoice of invoices) {
		const remaining = getPrimaryInvoiceCurrencyAmounts(invoice).remainingAmount

		if (remaining <= 0) continue

		const name = invoice.customerName?.trim() || 'Unknown customer'
		const key = invoice.customerId || name
		const row = byCustomer.get(key) ?? {
			customerId: invoice.customerId ?? null,
			name,
			invoiceCount: 0,
			outstanding: 0,
		}

		row.invoiceCount += 1
		row.outstanding += remaining
		if (!row.name && invoice.customerName) row.name = invoice.customerName

		byCustomer.set(key, row)
	}

	return {
		// ponytail: current remainingAmount, not a historical snapshot as-of a date.
		period: period ?? null,
		customers: [...byCustomer.values()]
			.sort((left, right) => right.outstanding - left.outstanding)
			.slice(0, limit)
			.map(row => ({
				...row,
				outstanding: Math.round(row.outstanding * 100) / 100,
			})),
	}
}

const TOOLS: Record<
	ReportToolName,
	(
		tenantId: string,
		args: Record<string, unknown>,
		now: Date,
	) => Promise<unknown>
> = {
	topSellingProducts,
	salesSummary,
	purchaseSummary,
	profitSummary,
	topSuppliers,
	topCustomersByOutstanding,
}

export const runReportTool = (
	tenantId: string,
	name: ReportToolName,
	args: Record<string, unknown>,
	now = new Date(),
): Promise<unknown> => TOOLS[name](tenantId, args, now)

export const isReportToolName = (name: string): name is ReportToolName =>
	Object.prototype.hasOwnProperty.call(TOOLS, name)
