import { v4 as uuidv4 } from 'uuid'
import { DbTx } from '../../db'
import { pgDeleteMany, pgFind } from '../../db/mongoQuery'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { BuyingInvoice } from '../../models/BuyingInvoices'
import { Invoice } from '../../models/Invoice'
import InvoiceSettings from '../../models/InvoiceSettings'
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
	requireOperationalWarehouseId,
	requireWarehouseId,
	warehouseAclMongoFilter,
	warehouseMongoFilter,
} from '../../shared/warehouseAccess'
import { ensureTenantAccess, getTenantContext } from '../../shared/tenant'
import {
	catalogCostToPrimary,
	finiteCost,
	findOversellLines,
	ratesFromCurrencySettings,
	type CostCurrencyRate,
} from '../../shared/inventoryCost'
import CurrencySettings from '../../models/CurrencySettings'
import {
	clearCashLedgerForReference,
	loadCashCurrencyRates,
	isHistoricalInvoiceCash,
	prepareInvoiceCashFields,
	syncSellingInvoiceCashLedger,
} from '../../shared/cashAccounts/posting'
import { CASH_REFERENCE_TYPES } from '../../shared/cashAccounts/types'
import {
	buildPeriodProductAggregates,
	filterAggregatesByProductIds,
	originalSaleUnitCostByProduct,
	pickBestSellerSummaryProducts,
	pickTopProfitSummaryProducts,
	selectCurrentSaleMovings,
	totalProfitFromAggregates,
	type ProductProfitAggregate,
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
		warehouseScope?: 'working' | 'acl',
	): Promise<DailyActionResponse>
	getPartyEntries(
		requestContext: RequestContext,
		ids: string[],
		fields: Array<'customerId' | 'supplierId' | 'partnerId'>,
	): Promise<DailyActionResponse['data']>
	buildCustomerInvoiceSummary(
		invoices: Array<Record<string, unknown>>,
		customerEntries?: DailyActionResponse['data'],
		rates?: readonly CostCurrencyRate[],
	): CustomerInvoiceSummary
	allocateInvoiceNumberForCreate(
		requestContext: RequestContext,
		prefix: InvoiceNumberPrefix,
		requestedNumber: string | undefined,
		model: typeof Invoice,
		session?: DbTx,
	): Promise<string>
	resolveNextInvoiceNumber(requestContext: RequestContext): Promise<number>
	runInTransaction<T>(work: (session: DbTx) => Promise<T>): Promise<T>
	getInventoryByProductId(
		requestContext: RequestContext,
		productId: string,
		warehouseId: string,
		session?: DbTx,
	): Promise<InventoryDocument | null>
	atomicAdjustInventoryQuantity(
		requestContext: RequestContext,
		params: {
			productId: string
			warehouseId: string
			quantityDelta: number
			allowNegative?: boolean
		},
		session: DbTx,
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
	ensureProjectBelongsToTenant(
		requestContext: RequestContext,
		projectId?: string,
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
		entity: 'invoices' | 'inventory' | 'products' | 'categories',
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

		return pgFind(StockMoving, tenantContext.tenantId, {
			type: 'sale',
			referenceType: 'selling_invoice',
			referenceId: { $in: invoiceIds },
		})
	}

	private async getSaleStockMovingsForInvoice(
		requestContext: RequestContext,
		invoiceId: string,
		session?: DbTx,
	): Promise<Array<Record<string, unknown>>> {
		const tenantContext = getTenantContext(requestContext)

		return pgFind(
			StockMoving,
			tenantContext.tenantId,
			{
				type: 'sale',
				referenceType: 'selling_invoice',
				referenceId: invoiceId,
			},
			{ sort: { 'createdBy.createdAt': 1 }, db: session },
		)
	}

	private async deleteSaleStockMovingsForInvoice(
		requestContext: RequestContext,
		invoiceId: string,
		session: DbTx,
	) {
		const tenantContext = getTenantContext(requestContext)

		await pgDeleteMany(
			StockMoving,
			tenantContext.tenantId,
			{
				type: 'sale',
				referenceType: 'selling_invoice',
				referenceId: invoiceId,
			},
			session,
		)
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

		const rankedAggregates = filters.supplierId
			? await this.aggregatesForSupplier(
					requestContext,
					aggregates,
					filters.supplierId,
				)
			: aggregates

		const bestSellers = pickBestSellerSummaryProducts(rankedAggregates)
		const topProfitProducts = pickTopProfitSummaryProducts(rankedAggregates)

		return {
			todaySales,
			paidInvoices,
			creditInvoices,
			totalReceivable,
			averageOrder,
			totalProfit: totalProfitFromAggregates(aggregates),
			profitReliable,
			bestSeller: bestSellers[0] ?? null,
			bestSellers,
			topProfitProduct: topProfitProducts[0] ?? null,
			topProfitProducts,
		}
	}

	/** Keep period totals unfiltered; only product ranking lists follow supplier. */
	private async aggregatesForSupplier(
		requestContext: RequestContext,
		aggregates: Map<string, ProductProfitAggregate>,
		supplierId: string,
	): Promise<Map<string, ProductProfitAggregate>> {
		const tenantId = this.getTenantId(requestContext)
		const products = await withTenantScope(
			Product.find({ supplierId }).select({ productId: 1 }),
			tenantId,
		).lean<Array<{ productId?: string }>>()
		const allowed = new Set(
			products
				.map(product => product.productId)
				.filter((id): id is string => Boolean(id)),
		)

		return filterAggregatesByProductIds(aggregates, allowed)
	}

	private async tenantAllowsOversell(
		requestContext: RequestContext,
	): Promise<boolean> {
		const { tenantId } = getTenantContext(requestContext)
		const settings = await InvoiceSettings.findOne({ tenantId })
			.select('allowOversell')
			.lean<{ allowOversell?: boolean }>()

		return settings?.allowOversell === true
	}

	private async validateSaleInventory(
		requestContext: RequestContext,
		items: NonNullable<InvoiceRequestBody['items']>,
		warehouseId: string,
		session?: DbTx,
	) {
		const scopedWarehouseId = requireWarehouseId(warehouseId)
		const availableByProductId = new Map<string, number>()

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

			availableByProductId.set(item.productId, Number(inventory.quantity ?? 0))
		}

		const oversell = findOversellLines(
			items,
			availableByProductId,
			await this.tenantAllowsOversell(requestContext),
		)

		if (oversell.length === 0) return

		const first = oversell[0]!

		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			`Insufficient stock for ${first.name}. Available: ${first.available}, requested: ${first.requested}.`,
		)
	}

	/**
	 * COGS for a sale line: Inventory.averageCost (primary) first, then catalog
	 * purchasePrice converted to primary at sale time. Never the sale unitPrice.
	 * Missing cost stays unset (not 0).
	 */
	private async resolveSaleUnitCost(
		requestContext: RequestContext,
		productId: string,
		averageCost: number | undefined,
		session: DbTx,
	): Promise<number | undefined> {
		const inventoryCost = finiteCost(averageCost)

		// note: averageCost is primary after opening/purchase writers; legacy rows
		// may still be catalog-currency — do not re-infer from live price.currency.
		if (inventoryCost != null) return inventoryCost

		const product = await this.mongoDbClient.getDocumentByField<{
			price?: { purchasePrice?: number; currency?: string }
		}>(
			requestContext,
			COLLECTION_NAMES.PRODUCTS,
			Product,
			{ fieldName: 'productId', fieldValue: productId },
			session,
		)

		const tenantId = getTenantContext(requestContext).tenantId
		const currencySettings = await CurrencySettings.findOne({ tenantId })
			.select('primaryCurrency secondaryCurrencies')
			.lean()
		const purchaseCost = catalogCostToPrimary(
			product?.price?.purchasePrice,
			product?.price?.currency,
			ratesFromCurrencySettings(currencySettings),
		)

		if (purchaseCost != null) return purchaseCost

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
		session: DbTx,
		warehouseId: string,
		unitCostByProduct?: Map<string, number>,
	): Promise<string[]> {
		const scopedWarehouseId = requireWarehouseId(warehouseId)
		const touchedInventoryIds: string[] = []
		const allowNegative = await this.tenantAllowsOversell(requestContext)

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
					allowNegative,
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
		session: DbTx,
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
		const warehouse = filters.customerId
			? warehouseAclMongoFilter(requestContext)
			: warehouseMongoFilter(requestContext)
		const cacheKey = redisCache.buildInvoiceListKey(tenantId)
		const useTenantCache = warehouse === null

		let invoices: Array<Record<string, unknown>>
		let cachedInvoices:
			| SellingInvoicesListResponse
			| Array<Record<string, unknown>>
			| null = null

		if (useTenantCache) {
			cachedInvoices = await redisCache.getJson<
				SellingInvoicesListResponse | Array<Record<string, unknown>>
			>(cacheKey)

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
		} else {
			await ensureTenantAccess(requestContext, COLLECTION_NAMES.INVOICES)
			invoices = await (pgFind(Invoice, tenantId, warehouse, {
				sort: { createdAt: -1 },
			}) as unknown as Promise<Array<Record<string, unknown>>>)
		}

		const normalizedSearch = filters.searchText?.trim().toLowerCase()

		const warehouseScopedInvoices = invoices as Array<
			Record<string, unknown> & { warehouseId?: string }
		>

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
			const [{ data: customerEntries }, partyPayments, buyingInvoices, rates] =
				await Promise.all([
					this.ops.getDailyActions(
						requestContext,
						{
							customer: [filters.customerId],
							entryType: [
								DailyActionType.SELLING_ENTRY,
								DailyActionType.RECEIPT_ENTRY,
							],
						},
						'acl',
					),
					this.ops.getPartyEntries(
						requestContext,
						[filters.customerId],
						['supplierId'],
					),
					pgFind(
						BuyingInvoice,
						tenantId,
						{
							supplierId: filters.customerId,
							...(warehouseAclMongoFilter(requestContext) ?? {}),
						},
						{
							sort: {
								createdAt: 'desc',
							},
						},
					) as unknown as Promise<
						Array<Record<string, unknown> & { warehouseId?: string }>
					>,
					loadCashCurrencyRates(tenantId),
				])
			const own = this.ops.buildCustomerInvoiceSummary(
				scopedInvoices,
				[
					...customerEntries,
					...partyPayments.filter(
						entry => entry.entryType === DailyActionType.PAYMENT_ENTRY,
					),
				],
				rates,
			)
			const buyingOwed = this.ops.buildCustomerInvoiceSummary(
				buyingInvoices,
				[],
			)

			customerSummary = {
				...own,
				totalReceivable:
					own.totalReceivable -
					(buyingOwed.totalInvoiced - buyingOwed.totalPaid),
			}
		}

		const nextInvoiceNumber =
			await this.ops.resolveNextInvoiceNumber(requestContext)

		const response: SellingInvoicesListResponse = {
			invoices: filters.summaryOnly ? [] : filteredInvoices,
			summary,
			customerSummary,
			nextInvoiceNumber,
			totalCount: filters.summaryOnly ? 0 : filteredInvoices.length,
		}

		if (
			useTenantCache &&
			!Array.isArray(cachedInvoices) &&
			!cachedInvoices?.invoices
		) {
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
		const cashFields = prepareInvoiceCashFields({
			paymentType: requestBody.paymentType,
			invoiceCurrencyId: requestBody.invoiceCurrencyId,
			cashAccountType: requestBody.cashAccountType,
			currencyAmounts,
			tenders: requestBody.tenders,
		})

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
							projectId: requestBody.projectId,
							customerId: requestBody.customerId,
							customerName: requestBody.customerName,
							salesPerson: requestBody.salesPerson,
							paymentType: requestBody.paymentType,
							items: requestBody.items,
							status,
							paymentStatus,
							invoiceCurrencyId: cashFields.invoiceCurrencyId,
							cashAccountType: cashFields.cashAccountType,
							tenders: cashFields.tenders,
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

				await syncSellingInvoiceCashLedger({
					requestContext,
					warehouseId,
					invoiceId,
					status,
					paymentStatus,
					paymentType: requestBody.paymentType,
					cashAccountType: cashFields.cashAccountType,
					invoiceCurrencyId: cashFields.invoiceCurrencyId,
					tenders: cashFields.tenders,
					currencyAmounts,
					session,
				})

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
		await this.ops.ensureProjectBelongsToTenant(
			requestContext,
			requestBody.projectId,
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

				const paymentType = (requestBody.paymentType ??
					existingInvoice?.paymentType) as string | undefined
				const currencyAmounts = (requestBody.currencyAmounts ??
					existingInvoice?.currencyAmounts) as
					| Array<{
							currencyId?: string
							isPrimary?: boolean
							exchangeRate?: number
							amount?: number
							paidAmount?: number
					  }>
					| undefined
				const historicalCash = isHistoricalInvoiceCash(existingInvoice)
				const cashFields = historicalCash
					? {
							invoiceCurrencyId: undefined,
							cashAccountType:
								requestBody.cashAccountType ??
								(typeof existingInvoice?.cashAccountType === 'string'
									? existingInvoice.cashAccountType
									: undefined),
							tenders: [],
						}
					: prepareInvoiceCashFields({
							paymentType,
							invoiceCurrencyId:
								requestBody.invoiceCurrencyId ??
								(typeof existingInvoice?.invoiceCurrencyId === 'string'
									? existingInvoice.invoiceCurrencyId
									: undefined),
							cashAccountType:
								requestBody.cashAccountType ??
								(typeof existingInvoice?.cashAccountType === 'string'
									? existingInvoice.cashAccountType
									: undefined),
							currencyAmounts,
							tenders:
								requestBody.tenders ??
								(Array.isArray(existingInvoice?.tenders)
									? (existingInvoice.tenders as Array<{
											currencyId: string
											tenderedAmount: number
										}>)
									: undefined),
						})
				const invoiceUpdate = {
					...requestBody,
					...cashFields,
				} as Record<string, unknown>

				if (historicalCash) {
					delete invoiceUpdate.invoiceCurrencyId
					delete invoiceUpdate.tenders
				}

				const updated = await this.mongoDbClient.updateDocument(
					{ collectionName: COLLECTION_NAMES.INVOICES, id: invoiceId, session },
					requestContext,
					Invoice,
					invoiceUpdate,
				)

				await syncSellingInvoiceCashLedger({
					requestContext,
					warehouseId,
					invoiceId,
					status: (requestBody.status ?? existingInvoice?.status) as
						| string
						| undefined,
					paymentStatus: (requestBody.paymentStatus ??
						existingInvoice?.paymentStatus) as string | undefined,
					paymentType,
					cashAccountType: cashFields.cashAccountType,
					invoiceCurrencyId: cashFields.invoiceCurrencyId,
					tenders: cashFields.tenders,
					currencyAmounts,
					session,
				})

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

		const warehouseIdForCash = existingInvoice
			? requireWarehouseId(existingInvoice.warehouseId)
			: undefined

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

						const inventoryIds = await this.reverseSaleInventoryAdjustments(
							requestContext,
							existingInvoice.invoiceId,
							existingInvoice.invoiceNumber,
							asInvoiceLines(existingInvoice.items),
							session,
							requireWarehouseId(existingInvoice.warehouseId),
							originalUnitCosts,
						)

						await clearCashLedgerForReference({
							requestContext,
							warehouseId: requireWarehouseId(existingInvoice.warehouseId),
							referenceType: CASH_REFERENCE_TYPES.SELLING_INVOICE,
							referenceId: existingInvoice.invoiceId,
							session,
						})

						return inventoryIds
					})
				: warehouseIdForCash && existingInvoice
					? await (async () => {
							await clearCashLedgerForReference({
								requestContext,
								warehouseId: warehouseIdForCash,
								referenceType: CASH_REFERENCE_TYPES.SELLING_INVOICE,
								referenceId: existingInvoice.invoiceId,
							})

							return [] as string[]
						})()
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
