import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { Invoice } from '../../models/Invoice'
import { Product } from '../../models/Products'
import { StockMoving } from '../../models/StockMovings'
import { ERROR_CODES } from '../../shared/errorCodes'
import logger, { EntityType } from '../../shared/logger/logger'
import MongodbController from '../../shared/mongodb/mongodbController'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { redisCache } from '../../shared/cache/redisCache'
import { COLLECTION_NAMES } from '../../shared/general'
import {
	getPrimaryInvoiceCurrencyAmounts,
	type InvoiceAmountSource,
	type InvoiceCurrencyAmount,
} from '../../shared/invoiceCurrency'
import { mapInvoiceFiltersToUiStatus } from '../../shared/constants'
import {
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
} from '../../shared/globalEnums'
import { type InvoiceNumberPrefix } from '../../shared/invoiceNumbering'
import { SEE } from '../../shared/seeCatalog'
import {
	ensureSeeIds,
	ensureInvoiceEditFieldSee,
} from '../../shared/seePermissions'
import {
	ensureWarehouseAccess,
	filterByWarehouseAccess,
	requireOperationalWarehouseId,
	requireWarehouseId,
} from '../../shared/warehouseAccess'
import { getTenantContext } from '../../shared/tenant'
import { finiteCost } from '../../shared/inventoryCost'
import {
	buildPeriodProductAggregates,
	originalSaleUnitCostByProduct,
	pickBestSellerSummaryProduct,
	pickTopProfitSummaryProduct,
	selectCurrentSaleMovings,
	totalProfitFromAggregates,
} from '../../shared/sellingInvoiceProfit'
import {
	CustomerInvoiceSummary,
	InventoryDocument,
	InvoiceRequestBody,
	RequestContext,
	SellingInvoicesListResponse,
	SellingInvoicesQueryParams,
	SellingInvoicesSummary,
} from '../../shared/types'
import { DailyActionResponse } from '../../shared/types/api'
import { DailyActionType } from '../../shared/globalEnums'

export type SellingInvoiceCollaborator = {
	getDailyActions(
		requestContext: RequestContext,
		filters?: { customer?: string[]; entryType?: string[] },
	): Promise<DailyActionResponse>
	buildCustomerInvoiceSummary(
		invoices: Array<Record<string, unknown>>,
		customerEntries?: DailyActionResponse['data'],
	): CustomerInvoiceSummary
	allocateInvoiceNumberForCreate(
		requestContext: RequestContext,
		prefix: InvoiceNumberPrefix,
		requestedNumber: string | undefined,
		model: typeof Invoice,
		session?: mongoose.ClientSession,
	): Promise<string>
	resolveNextInvoiceNumber(requestContext: RequestContext): Promise<number>
	runInTransaction<T>(
		work: (session: mongoose.ClientSession) => Promise<T>,
	): Promise<T>
	getInventoryByProductId(
		requestContext: RequestContext,
		productId: string,
		warehouseId: string,
		session?: mongoose.ClientSession,
	): Promise<InventoryDocument | null>
	atomicAdjustInventoryQuantity(
		requestContext: RequestContext,
		params: {
			productId: string
			warehouseId: string
			quantityDelta: number
		},
		session: mongoose.ClientSession,
	): Promise<InventoryDocument>
	buildInvoiceCurrencyAmounts(
		tenantId: string,
		totals: {
			grandTotal: number
			paidAmount: number
			remainingAmount: number
			subtotal: number
			tax: number
			discount: number
		},
	): Promise<InvoiceRequestBody['currencyAmounts']>
	ensureOrderBelongsToTenant(
		requestContext: RequestContext,
		orderId?: string,
	): Promise<void>
	getProcessedSyncMutation(
		requestContext: RequestContext,
		clientMutationId: string,
	): Promise<{ result?: Record<string, unknown>; error?: string } | null>
	recordSyncMutation(
		requestContext: RequestContext,
		clientMutationId: string,
		entity: string,
		operation: string,
		result?: Record<string, unknown>,
		error?: string,
	): Promise<void>
	invalidateEntityCache(
		entity: 'orders' | 'invoices' | 'inventory' | 'products' | 'categories',
		requestContext: RequestContext,
		id?: string,
	): Promise<void>
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

type StoredSellingInvoice = Record<string, unknown> & {
	invoiceId: string
	invoiceNumber: string
	status?: InvoiceRequestBody['status']
	items?: InvoiceRequestBody['items']
	warehouseId?: string
}

const toDate = (value: unknown): Date | null => {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value
	}

	if (typeof value === 'string' || typeof value === 'number') {
		const date = new Date(value)

		return Number.isNaN(date.getTime()) ? null : date
	}

	return null
}

const asInvoiceLines = (
	value: unknown,
): NonNullable<InvoiceRequestBody['items']> => {
	if (!Array.isArray(value)) {
		return []
	}

	const lines: NonNullable<InvoiceRequestBody['items']> = []

	for (const item of value) {
		if (!isPlainRecord(item) || typeof item.productId !== 'string') {
			continue
		}

		lines.push({
			productId: item.productId,
			name: String(item.name ?? ''),
			barcode: typeof item.barcode === 'string' ? item.barcode : undefined,
			quantity: Number(item.quantity ?? 0),
			unit: typeof item.unit === 'string' ? item.unit : undefined,
			unitPrice: Number(item.unitPrice ?? 0),
			discount: typeof item.discount === 'number' ? item.discount : undefined,
			discountIsPercent:
				typeof item.discountIsPercent === 'boolean'
					? item.discountIsPercent
					: undefined,
			taxRate: typeof item.taxRate === 'number' ? item.taxRate : undefined,
			lineTotal:
				typeof item.lineTotal === 'number' ? item.lineTotal : undefined,
		})
	}

	return lines
}

const asFiniteNumber = (value: unknown): number | undefined => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value
	}

	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value)

		return Number.isFinite(parsed) ? parsed : undefined
	}

	return undefined
}

const toInvoiceCurrencyAmount = (
	value: Record<string, unknown>,
): InvoiceCurrencyAmount => ({
	currencyId: String(value.currencyId ?? ''),
	name: String(value.name ?? ''),
	internalCode:
		typeof value.internalCode === 'string' ? value.internalCode : undefined,
	exchangeRate: asFiniteNumber(value.exchangeRate) ?? 0,
	isPrimary: Boolean(value.isPrimary),
	amount: asFiniteNumber(value.amount) ?? 0,
	paidAmount: asFiniteNumber(value.paidAmount) ?? 0,
	remainingAmount: asFiniteNumber(value.remainingAmount) ?? 0,
	subtotal: asFiniteNumber(value.subtotal) ?? 0,
	tax: asFiniteNumber(value.tax) ?? 0,
	discount: asFiniteNumber(value.discount) ?? 0,
})

const asInvoiceAmountSource = (
	invoice: Record<string, unknown>,
): InvoiceAmountSource => ({
	amount: asFiniteNumber(invoice.amount),
	paidAmount: asFiniteNumber(invoice.paidAmount),
	remainingAmount: asFiniteNumber(invoice.remainingAmount),
	totalAmount: asFiniteNumber(invoice.totalAmount),
	totalTax: asFiniteNumber(invoice.totalTax),
	totalDiscount: asFiniteNumber(invoice.totalDiscount),
	currencyAmounts: Array.isArray(invoice.currencyAmounts)
		? invoice.currencyAmounts.filter(isPlainRecord).map(toInvoiceCurrencyAmount)
		: undefined,
})

const toStoredSellingInvoice = (
	value: unknown,
): StoredSellingInvoice | null => {
	if (!isPlainRecord(value)) {
		return null
	}

	return {
		...value,
		invoiceId: String(value.invoiceId ?? ''),
		invoiceNumber: String(value.invoiceNumber ?? ''),
	}
}

export default class SellingInvoiceController {
	constructor(
		private mongoDbClient: MongodbController,
		private ops: SellingInvoiceCollaborator,
	) {}

	private getTenantId(requestContext: RequestContext): string {
		return requestContext.tenantId || 'global'
	}

	private async ensureInvoiceProductsBelongToTenant(
		requestContext: RequestContext,
		items: Array<{ productId: string }>,
	) {
		const tenantContext = getTenantContext(requestContext)
		const requestedProductIds = [...new Set(items.map(item => item.productId))]
		const products = await withTenantScope(
			Product.find({ productId: { $in: requestedProductIds } }),
			tenantContext.tenantId,
		).lean()

		if (products.length !== requestedProductIds.length) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Invoice items must reference products from the same tenant.',
			)
		}
	}

	private deriveInvoicePaymentStatus(
		grandTotal: number,
		paidAmount: number,
	): InvoicePaymentStatus {
		if (paidAmount <= 0) return InvoicePaymentStatus.UNPAID

		if (paidAmount + 0.009 >= grandTotal) return InvoicePaymentStatus.PAID

		return InvoicePaymentStatus.PARTIAL
	}

	private deriveInvoiceStatus(
		requestStatus: InvoiceRequestBody['status'],
		paymentStatus: InvoicePaymentStatus | `${InvoicePaymentStatus}`,
		paymentType?: InvoiceRequestBody['paymentType'],
	): NonNullable<InvoiceRequestBody['status']> {
		if (
			requestStatus === InvoiceStatus.DRAFT ||
			requestStatus === InvoiceStatus.CANCELLED
		) {
			return requestStatus
		}

		if (paymentStatus === InvoicePaymentStatus.PAID) return InvoiceStatus.PAID

		if (paymentStatus === InvoicePaymentStatus.PARTIAL) {
			return InvoiceStatus.PARTIAL
		}

		if (paymentType === InvoicePaymentType.CREDIT)
			return InvoiceStatus.CONFIRMED

		return requestStatus ?? InvoiceStatus.CONFIRMED
	}

	private shouldAdjustInventoryForInvoice(status: unknown): boolean {
		const excluded: string[] = [
			InvoiceStatus.DRAFT,
			InvoiceStatus.CANCELLED,
			InvoiceStatus.VOID,
			InvoiceStatus.PENDING,
		]

		return !excluded.includes(String(status ?? ''))
	}

	private parseSummaryDateRange(filters: SellingInvoicesQueryParams = {}): {
		start: Date
		end: Date
	} {
		const defaultDay = new Date()

		defaultDay.setHours(0, 0, 0, 0)

		const start = filters.dateFrom
			? new Date(filters.dateFrom)
			: new Date(defaultDay)
		const end = filters.dateTo ? new Date(filters.dateTo) : new Date(defaultDay)

		start.setHours(0, 0, 0, 0)
		end.setHours(23, 59, 59, 999)

		if (start.getTime() > end.getTime()) {
			const swappedStart = new Date(end)
			const swappedEnd = new Date(start)

			swappedStart.setHours(0, 0, 0, 0)
			swappedEnd.setHours(23, 59, 59, 999)

			return { start: swappedStart, end: swappedEnd }
		}

		return { start, end }
	}

	private isInvoiceInSummaryPeriod(
		invoice: Record<string, unknown>,
		start: Date,
		end: Date,
	): boolean {
		const issuedAt = toDate(invoice.issuedAt)

		return Boolean(issuedAt && issuedAt >= start && issuedAt <= end)
	}

	private isPeriodSummaryInvoice(invoice: Record<string, unknown>): boolean {
		return this.shouldAdjustInventoryForInvoice(
			invoice.status ?? InvoiceStatus.CONFIRMED,
		)
	}

	private async getSaleStockMovingsForInvoices(
		requestContext: RequestContext,
		invoiceIds: string[],
	): Promise<Array<Record<string, unknown>>> {
		if (!invoiceIds.length) return []

		const tenantContext = getTenantContext(requestContext)

		return withTenantScope(
			StockMoving.find({
				type: 'sale',
				referenceType: 'selling_invoice',
				referenceId: { $in: invoiceIds },
			}).lean(),
			tenantContext.tenantId,
		)
	}

	private async getSaleStockMovingsForInvoice(
		requestContext: RequestContext,
		invoiceId: string,
		session?: mongoose.ClientSession,
	): Promise<Array<Record<string, unknown>>> {
		const tenantContext = getTenantContext(requestContext)
		const query = StockMoving.find({
			type: 'sale',
			referenceType: 'selling_invoice',
			referenceId: invoiceId,
		})
			.sort({ 'createdBy.createdAt': 1 })
			.lean()

		if (session) {
			query.session(session)
		}

		return withTenantScope(query, tenantContext.tenantId)
	}

	private async deleteSaleStockMovingsForInvoice(
		requestContext: RequestContext,
		invoiceId: string,
		session: mongoose.ClientSession,
	) {
		const tenantContext = getTenantContext(requestContext)

		await StockMoving.deleteMany({
			tenantId: tenantContext.tenantId,
			type: 'sale',
			referenceType: 'selling_invoice',
			referenceId: invoiceId,
		}).session(session)
	}

	private async buildSellingInvoicesSummary(
		requestContext: RequestContext,
		invoices: Array<Record<string, unknown>>,
		filters: SellingInvoicesQueryParams = {},
	): Promise<SellingInvoicesSummary> {
		const { start, end } = this.parseSummaryDateRange(filters)

		const periodInvoices = invoices.filter(
			invoice =>
				this.isInvoiceInSummaryPeriod(invoice, start, end) &&
				this.isPeriodSummaryInvoice(invoice),
		)

		const todaySales = periodInvoices.reduce((total, invoice) => {
			const { grandTotal } = getPrimaryInvoiceCurrencyAmounts(
				asInvoiceAmountSource(invoice),
			)

			return total + grandTotal
		}, 0)

		const paidInvoices = invoices.filter(
			invoice => invoice.status === InvoiceStatus.PAID,
		).length

		const creditInvoices = invoices.filter(
			invoice =>
				invoice.paymentType === InvoicePaymentType.CREDIT &&
				invoice.paymentStatus !== InvoicePaymentStatus.PAID,
		).length

		const totalReceivable = invoices.reduce((total, invoice) => {
			const { remainingAmount } = getPrimaryInvoiceCurrencyAmounts(
				asInvoiceAmountSource(invoice),
			)

			return remainingAmount > 0 ? total + remainingAmount : total
		}, 0)

		const averageOrder =
			periodInvoices.length > 0 ? todaySales / periodInvoices.length : 0

		const invoiceIds = periodInvoices.map(invoice => String(invoice.invoiceId))
		const stockMovings = await this.getSaleStockMovingsForInvoices(
			requestContext,
			invoiceIds,
		)
		const { aggregates, profitReliable } = buildPeriodProductAggregates(
			periodInvoices.map(invoice => ({
				items: asInvoiceLines(invoice.items),
				grandTotal: getPrimaryInvoiceCurrencyAmounts(
					asInvoiceAmountSource(invoice),
				).grandTotal,
			})),
			selectCurrentSaleMovings(periodInvoices, stockMovings),
		)

		return {
			todaySales,
			paidInvoices,
			creditInvoices,
			totalReceivable,
			averageOrder,
			totalProfit: profitReliable ? totalProfitFromAggregates(aggregates) : 0,
			profitReliable,
			bestSeller: pickBestSellerSummaryProduct(aggregates),
			topProfitProduct: profitReliable
				? pickTopProfitSummaryProduct(aggregates)
				: null,
		}
	}

	private async validateSaleInventory(
		requestContext: RequestContext,
		items: NonNullable<InvoiceRequestBody['items']>,
		warehouseId: string,
		session?: mongoose.ClientSession,
	) {
		const scopedWarehouseId = requireWarehouseId(warehouseId)

		for (const item of items) {
			const inventory = await this.ops.getInventoryByProductId(
				requestContext,
				item.productId,
				scopedWarehouseId,
				session,
			)

			if (!inventory) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					`No inventory record found for product ${item.name}.`,
				)
			}

			const currentQuantity = Number(inventory.quantity ?? 0)

			if (currentQuantity < item.quantity) {
				// throw new BusinessLogicError(
				// 	ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				// 	`Insufficient stock for ${item.name}. Available: ${currentQuantity}, requested: ${item.quantity}.`,
				// )
				logger.error(
					`Insufficient stock for ${item.name}. Available: ${currentQuantity}, requested: ${item.quantity}.`,
				)
			}
		}
	}

	/**
	 * COGS for a sale line: Inventory.averageCost first, then product purchasePrice,
	 * never the sale unitPrice. Missing cost stays unset (not 0).
	 */
	private async resolveSaleUnitCost(
		requestContext: RequestContext,
		productId: string,
		averageCost: number | undefined,
		session: mongoose.ClientSession,
	): Promise<number | undefined> {
		const inventoryCost = finiteCost(averageCost)

		if (inventoryCost != null) return inventoryCost

		const product = await this.mongoDbClient.getDocumentByField<{
			price?: { purchasePrice?: number }
		}>(
			requestContext,
			COLLECTION_NAMES.PRODUCTS,
			Product,
			{ fieldName: 'productId', fieldValue: productId },
			session,
		)

		const purchasePrice = finiteCost(product?.price?.purchasePrice)

		if (purchasePrice != null) return purchasePrice

		logger.warn(
			`No averageCost or purchasePrice for product ${productId}; sale unitCost left unset.`,
			{ entity: EntityType.MONGODB, productId },
		)

		return undefined
	}

	private async applySaleInventoryAdjustments(
		requestContext: RequestContext,
		invoiceId: string,
		invoiceNumber: string,
		items: NonNullable<InvoiceRequestBody['items']>,
		session: mongoose.ClientSession,
		warehouseId: string,
		unitCostByProduct?: Map<string, number>,
	): Promise<string[]> {
		const scopedWarehouseId = requireWarehouseId(warehouseId)
		const touchedInventoryIds: string[] = []

		for (const item of items) {
			const inventory = await this.ops.getInventoryByProductId(
				requestContext,
				item.productId,
				scopedWarehouseId,
				session,
			)

			if (!inventory) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					`No inventory record found for productss ${item.name}.`,
				)
			}

			// Extra qty of a product that already has a sale snapshot keeps that
			// unitCost. A new productId on the edit has no snapshot and resolves live WAC.
			const snapshotCost = unitCostByProduct?.get(item.productId)
			const costBasis =
				finiteCost(snapshotCost) ??
				(await this.resolveSaleUnitCost(
					requestContext,
					item.productId,
					inventory.averageCost,
					session,
				))

			await this.ops.atomicAdjustInventoryQuantity(
				requestContext,
				{
					productId: item.productId,
					warehouseId: scopedWarehouseId,
					quantityDelta: -item.quantity,
				},
				session,
			)

			await this.mongoDbClient.createDocument(
				{
					collectionName: COLLECTION_NAMES.STOCK_MOVINGS,
					data: {
						stockMovingId: uuidv4(),
						productId: item.productId,
						warehouseId: scopedWarehouseId,
						type: 'sale',
						quantity: item.quantity,
						...(costBasis != null ? { unitCost: costBasis } : {}),
						referenceType: 'selling_invoice',
						referenceId: invoiceId,
						note: `Invoice #${invoiceNumber}`,
					},
					session,
				},
				StockMoving,
				requestContext,
			)

			touchedInventoryIds.push(inventory.inventoryId)
		}

		return touchedInventoryIds
	}

	/**
	 * Reverses previously-applied sale movements when a selling invoice is
	 * cancelled: stock comes back in (type=return_in), Inventory quantity goes up.
	 */
	private async reverseSaleInventoryAdjustments(
		requestContext: RequestContext,
		invoiceId: string,
		invoiceNumber: string,
		items: NonNullable<InvoiceRequestBody['items']>,
		session: mongoose.ClientSession,
		warehouseId: string,
		unitCostByProduct?: Map<string, number>,
	): Promise<string[]> {
		const scopedWarehouseId = requireWarehouseId(warehouseId)
		const touchedInventoryIds: string[] = []

		for (const item of items) {
			const inventory = await this.ops.getInventoryByProductId(
				requestContext,
				item.productId,
				scopedWarehouseId,
				session,
			)

			const snapshotCost = unitCostByProduct?.get(item.productId)
			const costBasis =
				finiteCost(snapshotCost) ??
				(await this.resolveSaleUnitCost(
					requestContext,
					item.productId,
					inventory?.averageCost,
					session,
				))

			const updatedInventory = await this.ops.atomicAdjustInventoryQuantity(
				requestContext,
				{
					productId: item.productId,
					warehouseId: scopedWarehouseId,
					quantityDelta: item.quantity,
				},
				session,
			)

			await this.mongoDbClient.createDocument(
				{
					collectionName: COLLECTION_NAMES.STOCK_MOVINGS,
					data: {
						stockMovingId: uuidv4(),
						productId: item.productId,
						warehouseId: scopedWarehouseId,
						type: 'return_in',
						quantity: item.quantity,
						...(costBasis != null ? { unitCost: costBasis } : {}),
						referenceType: 'selling_invoice',
						referenceId: invoiceId,
						note: `Cancelled invoice #${invoiceNumber}`,
					},
					session,
				},
				StockMoving,
				requestContext,
			)

			touchedInventoryIds.push(updatedInventory.inventoryId)
		}

		await this.deleteSaleStockMovingsForInvoice(
			requestContext,
			invoiceId,
			session,
		)

		return touchedInventoryIds
	}

	public async getInvoices(
		requestContext: RequestContext,
		filters: SellingInvoicesQueryParams = {},
	): Promise<SellingInvoicesListResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildInvoiceListKey(tenantId)
		const cachedInvoices = await redisCache.getJson<
			SellingInvoicesListResponse | Array<Record<string, unknown>>
		>(cacheKey)

		let invoices: Array<Record<string, unknown>>

		if (Array.isArray(cachedInvoices)) {
			invoices = cachedInvoices
		} else if (cachedInvoices?.invoices) {
			invoices = cachedInvoices.invoices
		} else {
			const invoiceResponse = await this.mongoDbClient.getDocuments({
				requestContext,
				collectionName: COLLECTION_NAMES.INVOICES,
				model: Invoice,
				sort: { createdAt: 'desc' },
			})

			invoices = invoiceResponse.documents
		}

		const normalizedSearch = filters.searchText?.trim().toLowerCase()

		const warehouseScopedInvoices = filterByWarehouseAccess(
			requestContext,
			invoices as Array<Record<string, unknown> & { warehouseId?: string }>,
		)

		const filteredInvoices = warehouseScopedInvoices.filter(
			(invoice: Record<string, unknown>) => {
				if (
					filters.customerId &&
					String(invoice.customerId ?? '') !== filters.customerId
				) {
					return false
				}

				const uiStatus = mapInvoiceFiltersToUiStatus(invoice)

				if (
					filters.status &&
					filters.status !== 'all' &&
					uiStatus !== filters.status
				) {
					return false
				}

				if (filters.issuedDate) {
					const issuedAt = toDate(invoice.issuedAt)
					const filterDate = new Date(filters.issuedDate)

					if (!issuedAt) return false

					const sameDay =
						issuedAt.getFullYear() === filterDate.getFullYear() &&
						issuedAt.getMonth() === filterDate.getMonth() &&
						issuedAt.getDate() === filterDate.getDate()

					if (!sameDay) return false
				}

				if (!normalizedSearch) return true

				const invoiceNumber = String(invoice.invoiceNumber ?? '').toLowerCase()
				const customerName = String(invoice.customerName ?? '').toLowerCase()

				return (
					invoiceNumber.includes(normalizedSearch) ||
					customerName.includes(normalizedSearch)
				)
			},
		)

		const scopedInvoices = filters.customerId
			? warehouseScopedInvoices.filter(
					invoice => String(invoice.customerId ?? '') === filters.customerId,
				)
			: warehouseScopedInvoices

		const canSeeSummary = (requestContext.see || []).includes(
			SEE.sellingInvoicesSummary,
		)
		const summary = canSeeSummary
			? await this.buildSellingInvoicesSummary(
					requestContext,
					scopedInvoices,
					filters,
				)
			: undefined
		let customerSummary: CustomerInvoiceSummary | undefined

		if (filters.customerId) {
			const { data: customerEntries } = await this.ops.getDailyActions(
				requestContext,
				{
					customer: [filters.customerId],
					entryType: [
						DailyActionType.SELLING_ENTRY,
						DailyActionType.RECEIPT_ENTRY,
					],
				},
			)

			customerSummary = this.ops.buildCustomerInvoiceSummary(
				scopedInvoices,
				customerEntries,
			)
		}

		const nextInvoiceNumber =
			await this.ops.resolveNextInvoiceNumber(requestContext)

		const response: SellingInvoicesListResponse = {
			invoices: filteredInvoices,
			summary,
			customerSummary,
			nextInvoiceNumber,
			totalCount: filteredInvoices.length,
		}

		if (!Array.isArray(cachedInvoices) && !cachedInvoices?.invoices) {
			await redisCache.setJson(cacheKey, {
				invoices,
				summary,
				nextInvoiceNumber,
				totalCount: invoices.length,
			})
		}

		return response
	}

	public async getInvoice(
		invoiceId: string,
		requestContext: RequestContext,
	): Promise<StoredSellingInvoice | null> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildInvoiceDetailKey(tenantId, invoiceId)
		const cachedInvoice = toStoredSellingInvoice(
			await redisCache.getJson<unknown>(cacheKey),
		)

		if (cachedInvoice) {
			ensureWarehouseAccess(requestContext, cachedInvoice.warehouseId)

			return cachedInvoice
		}

		const invoice = toStoredSellingInvoice(
			await this.mongoDbClient.getDocumentByField<unknown>(
				requestContext,
				COLLECTION_NAMES.INVOICES,
				Invoice,
				{ fieldName: 'invoiceId', fieldValue: invoiceId },
			),
		)

		if (!invoice) {
			return null
		}

		ensureWarehouseAccess(requestContext, invoice.warehouseId)

		await redisCache.setJson(cacheKey, invoice)

		return invoice
	}

	public async postInvoice(
		requestBody: InvoiceRequestBody,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.sellingInvoicesSellingButton])
		const operationalWarehouseId = requireOperationalWarehouseId(requestContext)
		const warehouseId = requireWarehouseId(requestBody.warehouseId)

		if (warehouseId !== operationalWarehouseId) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Invoice warehouseId must match the selected operational warehouse.',
			)
		}

		ensureWarehouseAccess(requestContext, warehouseId)
		if (requestBody.clientMutationId) {
			const processed = await this.ops.getProcessedSyncMutation(
				requestContext,
				requestBody.clientMutationId,
			)

			if (processed?.result) {
				return processed.result
			}

			if (processed?.error) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					processed.error,
				)
			}
		}

		if (!requestBody.items?.length) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Invoice must contain at least one item.',
			)
		}

		const invoiceItems = requestBody.items

		await this.ensureInvoiceProductsBelongToTenant(requestContext, invoiceItems)

		const tenantContext = getTenantContext(requestContext)

		const currencyAmounts =
			requestBody.currencyAmounts?.length &&
			requestBody.currencyAmounts.length > 0
				? requestBody.currencyAmounts
				: await this.buildInvoiceCurrencyAmountsFromItems(
						tenantContext.tenantId,
						requestBody,
					)

		if (!currencyAmounts.length) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Invoice currency amounts are required.',
			)
		}

		const primary =
			currencyAmounts.find(amount => amount.isPrimary) ?? currencyAmounts[0]

		const paymentStatus =
			requestBody.paymentStatus ??
			this.deriveInvoicePaymentStatus(primary.amount, primary.paidAmount)

		const status = this.deriveInvoiceStatus(
			requestBody.status,
			paymentStatus,
			requestBody.paymentType,
		)

		const invoiceId = requestBody.invoiceId ?? uuidv4()

		const existingInvoice = requestBody.invoiceId
			? await this.getInvoice(requestBody.invoiceId, requestContext)
			: null

		if (existingInvoice) {
			const result = {
				_id: existingInvoice._id,
				invoiceId: existingInvoice.invoiceId,
				invoiceNumber: existingInvoice.invoiceNumber,
			}

			if (requestBody.clientMutationId) {
				await this.ops.recordSyncMutation(
					requestContext,
					requestBody.clientMutationId,
					'invoice',
					'create',
					result,
				)
			}

			return result
		}

		if (this.shouldAdjustInventoryForInvoice(status)) {
			await this.validateSaleInventory(
				requestContext,
				invoiceItems,
				warehouseId,
			)
		}

		const { createInvoiceResponse, touchedInventoryIds, invoiceNumber } =
			await this.ops.runInTransaction(async session => {
				const allocatedNumber = await this.ops.allocateInvoiceNumberForCreate(
					requestContext,
					'SI',
					requestBody.invoiceNumber,
					Invoice,
					session,
				)

				const created = await this.mongoDbClient.createDocument(
					{
						collectionName: COLLECTION_NAMES.INVOICES,
						data: {
							invoiceId,
							invoiceNumber: allocatedNumber,
							orderId: requestBody.orderId,
							customerId: requestBody.customerId,
							customerName: requestBody.customerName,
							salesPerson: requestBody.salesPerson,
							paymentType: requestBody.paymentType,
							items: requestBody.items,
							status,
							paymentStatus,
							currencyAmounts,
							notes: requestBody.notes,
							invoiceDiscount: requestBody.invoiceDiscount ?? 0,
							invoiceDiscountIsPercent:
								requestBody.invoiceDiscountIsPercent ?? false,
							printAfterPayment: requestBody.printAfterPayment ?? false,
							warehouseId,
							issuedAt: requestBody.issuedAt
								? new Date(requestBody.issuedAt)
								: new Date(),
						},
						session,
					},
					Invoice,
					requestContext,
				)

				const inventoryIds = this.shouldAdjustInventoryForInvoice(status)
					? await this.applySaleInventoryAdjustments(
							requestContext,
							invoiceId,
							allocatedNumber,
							invoiceItems,
							session,
							warehouseId,
						)
					: []

				return {
					createInvoiceResponse: created,
					touchedInventoryIds: inventoryIds,
					invoiceNumber: allocatedNumber,
				}
			})

		await this.ops.invalidateEntityCache('invoices', requestContext, invoiceId)

		for (const inventoryId of touchedInventoryIds) {
			await this.ops.invalidateEntityCache(
				'inventory',
				requestContext,
				inventoryId,
			)
		}

		await redisCache.del(
			redisCache.buildCustomerListKey(this.getTenantId(requestContext)),
		)

		const result = {
			_id: createInvoiceResponse._id,
			invoiceId,
			invoiceNumber,
		}

		if (requestBody.clientMutationId) {
			await this.ops.recordSyncMutation(
				requestContext,
				requestBody.clientMutationId,
				'invoice',
				'create',
				result,
			)
		}

		return result
	}

	private async buildInvoiceCurrencyAmountsFromItems(
		tenantId: string,
		requestBody: InvoiceRequestBody,
	) {
		const items = requestBody.items ?? []
		const grandTotal = items.reduce(
			(total, item) =>
				total + (item.lineTotal ?? item.quantity * item.unitPrice),
			0,
		)

		return this.ops.buildInvoiceCurrencyAmounts(tenantId, {
			grandTotal,
			paidAmount: 0,
			remainingAmount: grandTotal,
			subtotal: grandTotal,
			tax: 0,
			discount: 0,
		})
	}

	public async patchInvoice(
		invoiceId: string,
		requestBody: Partial<InvoiceRequestBody>,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.sellingInvoicesEdit])
		await this.ops.ensureOrderBelongsToTenant(
			requestContext,
			requestBody.orderId,
		)

		const existingInvoice = await this.getInvoice(invoiceId, requestContext)

		if (
			existingInvoice?.warehouseId &&
			requestBody.warehouseId &&
			requestBody.warehouseId !== existingInvoice.warehouseId
		) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Invoice warehouseId cannot be changed.',
			)
		}

		const warehouseId = requireWarehouseId(
			existingInvoice?.warehouseId ?? requestBody.warehouseId,
		)

		ensureWarehouseAccess(requestContext, warehouseId)

		await ensureInvoiceEditFieldSee(
			requestContext,
			existingInvoice,
			requestBody,
			'selling',
		)

		const wasStockAffecting = Boolean(
			existingInvoice &&
			this.shouldAdjustInventoryForInvoice(existingInvoice.status),
		)
		const willBeStockAffecting = Boolean(
			existingInvoice &&
			this.shouldAdjustInventoryForInvoice(
				requestBody.status ?? existingInvoice.status,
			),
		)
		const hasPatchItems = Boolean(requestBody.items?.length)
		const shouldReverse =
			wasStockAffecting && (!willBeStockAffecting || hasPatchItems)
		const shouldApply =
			willBeStockAffecting && (!wasStockAffecting || hasPatchItems)
		const itemsToApply =
			hasPatchItems && requestBody.items
				? requestBody.items
				: asInvoiceLines(existingInvoice?.items)

		if (itemsToApply.length) {
			await this.ensureInvoiceProductsBelongToTenant(
				requestContext,
				itemsToApply,
			)
		}

		const reverseWarehouseId = requireWarehouseId(
			existingInvoice?.warehouseId ?? warehouseId,
		)

		const { updateResponse, touchedInventoryIds } =
			await this.ops.runInTransaction(async session => {
				let inventoryIds: string[] = []
				const originalUnitCosts =
					shouldReverse && existingInvoice
						? originalSaleUnitCostByProduct(
								await this.getSaleStockMovingsForInvoice(
									requestContext,
									existingInvoice.invoiceId,
									session,
								),
							)
						: undefined

				if (shouldReverse && existingInvoice) {
					inventoryIds = await this.reverseSaleInventoryAdjustments(
						requestContext,
						existingInvoice.invoiceId,
						existingInvoice.invoiceNumber,
						asInvoiceLines(existingInvoice.items),
						session,
						reverseWarehouseId,
						originalUnitCosts,
					)
				}

				if (shouldApply && existingInvoice && itemsToApply?.length) {
					await this.validateSaleInventory(
						requestContext,
						itemsToApply,
						warehouseId,
						session,
					)

					inventoryIds = [
						...inventoryIds,
						...(await this.applySaleInventoryAdjustments(
							requestContext,
							existingInvoice.invoiceId,
							existingInvoice.invoiceNumber,
							itemsToApply,
							session,
							warehouseId,
							originalUnitCosts,
						)),
					]
				}

				const updated = await this.mongoDbClient.updateDocument(
					{ collectionName: COLLECTION_NAMES.INVOICES, id: invoiceId, session },
					requestContext,
					Invoice,
					requestBody,
				)

				return { updateResponse: updated, touchedInventoryIds: inventoryIds }
			})

		await this.ops.invalidateEntityCache('invoices', requestContext, invoiceId)

		for (const inventoryId of touchedInventoryIds) {
			await this.ops.invalidateEntityCache(
				'inventory',
				requestContext,
				inventoryId,
			)
		}

		await redisCache.del(
			redisCache.buildCustomerListKey(this.getTenantId(requestContext)),
		)

		return updateResponse
	}

	public async deleteInvoice(
		invoiceId: string,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.sellingInvoicesDelete])

		const existingInvoice = await this.getInvoice(invoiceId, requestContext)
		const wasStockAffecting = Boolean(
			existingInvoice &&
			this.shouldAdjustInventoryForInvoice(existingInvoice.status),
		)

		if (existingInvoice) {
			ensureWarehouseAccess(
				requestContext,
				requireWarehouseId(existingInvoice.warehouseId),
			)
		}

		const touchedInventoryIds =
			wasStockAffecting && existingInvoice
				? await this.ops.runInTransaction(async session => {
						const originalUnitCosts = originalSaleUnitCostByProduct(
							await this.getSaleStockMovingsForInvoice(
								requestContext,
								existingInvoice.invoiceId,
								session,
							),
						)

						return this.reverseSaleInventoryAdjustments(
							requestContext,
							existingInvoice.invoiceId,
							existingInvoice.invoiceNumber,
							asInvoiceLines(existingInvoice.items),
							session,
							requireWarehouseId(existingInvoice.warehouseId),
							originalUnitCosts,
						)
					})
				: []

		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.INVOICES, id: invoiceId },
			requestContext,
			Invoice,
		)

		await this.ops.invalidateEntityCache('invoices', requestContext, invoiceId)

		for (const inventoryId of touchedInventoryIds) {
			await this.ops.invalidateEntityCache(
				'inventory',
				requestContext,
				inventoryId,
			)
		}

		await redisCache.del(
			redisCache.buildCustomerListKey(this.getTenantId(requestContext)),
		)

		return deleteResponse
	}
}
