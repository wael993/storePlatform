import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { BuyingInvoice } from '../../models/BuyingInvoices'
import { Product } from '../../models/Products'
import { Supplier } from '../../models/Supplier'
import { StockMoving } from '../../models/StockMovings'
import { ERROR_CODES } from '../../shared/errorCodes'
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
import { ensureSeeIds } from '../../shared/seePermissions'
import { ensureTenantAccess, getTenantContext } from '../../shared/tenant'
import {
	decodeInvoiceUpload,
	extractInvoice,
} from '../../shared/invoiceAi/extract'
import { matchExtractedInvoice } from '../../shared/invoiceAi/match'
import { getInvoiceAiProvider } from '../../shared/invoiceAi/providers'
import {
	getInvoiceAiUsage,
	refundInvoiceAiCredit,
	reserveInvoiceAiCredit,
} from '../../shared/invoiceAi/usage'
import {
	BuyingInvoiceRequestBody,
	BuyingInvoicesListResponse,
	BuyingInvoicesQueryParams,
	BuyingInvoicesSummary,
	InventoryDocument,
	InvoiceAiUsageResponse,
	RequestContext,
	SupplierInvoiceSummary,
} from '../../shared/types'
import { DailyActionResponse } from '../../shared/types/api'
import { DailyActionType } from '../../shared/globalEnums'

export type BuyingInvoiceCollaborator = {
	getDailyActions(
		requestContext: RequestContext,
		filters?: { supplier?: string[]; entryType?: string[] },
	): Promise<DailyActionResponse>
	buildSupplierInvoiceSummary(
		invoices: Array<Record<string, unknown>>,
		supplierEntries?: DailyActionResponse['data'],
	): SupplierInvoiceSummary
	allocateInvoiceNumberForCreate(
		requestContext: RequestContext,
		prefix: InvoiceNumberPrefix,
		requestedNumber: string | undefined,
		model: typeof BuyingInvoice,
		session?: mongoose.ClientSession,
	): Promise<string>
	resolveNextBuyingInvoiceNumber(
		requestContext: RequestContext,
	): Promise<number>
	runInTransaction<T>(
		work: (session: mongoose.ClientSession) => Promise<T>,
	): Promise<T>
	getInventoryByProductId(
		requestContext: RequestContext,
		productId: string,
		session?: mongoose.ClientSession,
	): Promise<InventoryDocument | null>
	atomicAdjustInventoryQuantity(
		requestContext: RequestContext,
		params: {
			productId: string
			warehouseId?: string
			quantityDelta: number
		},
		session: mongoose.ClientSession,
	): Promise<InventoryDocument>
	atomicPurchaseInventoryAdjustment(
		requestContext: RequestContext,
		params: {
			productId: string
			warehouseId?: string
			purchaseQuantity: number
			purchaseUnitPrice: number
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
	): Promise<BuyingInvoiceRequestBody['currencyAmounts']>
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

type StoredBuyingInvoice = Record<string, unknown> & {
	buyingInvoiceId: string
	invoiceNumber: string
	status?: BuyingInvoiceRequestBody['status']
	items?: BuyingInvoiceRequestBody['items']
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
): NonNullable<BuyingInvoiceRequestBody['items']> => {
	if (!Array.isArray(value)) {
		return []
	}

	const lines: NonNullable<BuyingInvoiceRequestBody['items']> = []

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
			sourceName:
				typeof item.sourceName === 'string' && item.sourceName.trim()
					? item.sourceName.trim()
					: undefined,
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

const toStoredBuyingInvoice = (value: unknown): StoredBuyingInvoice | null => {
	if (!isPlainRecord(value)) {
		return null
	}

	return {
		...value,
		buyingInvoiceId: String(value.buyingInvoiceId ?? ''),
		invoiceNumber: String(value.invoiceNumber ?? ''),
		warehouseId:
			typeof value.warehouseId === 'string' ? value.warehouseId : undefined,
	}
}

export default class BuyingInvoiceController {
	constructor(
		private mongoDbClient: MongodbController,
		private ops: BuyingInvoiceCollaborator,
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

	private shouldAdjustInventoryForInvoice(status: unknown): boolean {
		const excluded: string[] = [
			InvoiceStatus.DRAFT,
			InvoiceStatus.CANCELLED,
			InvoiceStatus.VOID,
			InvoiceStatus.PENDING,
		]

		return !excluded.includes(String(status ?? ''))
	}

	private buildBuyingInvoicesSummary(
		invoices: Array<Record<string, unknown>>,
	): BuyingInvoicesSummary {
		const todayStart = new Date()

		todayStart.setHours(0, 0, 0, 0)

		const todayEnd = new Date()

		todayEnd.setHours(23, 59, 59, 999)

		const todaysInvoices = invoices.filter(invoice => {
			const issuedAt = toDate(invoice.issuedAt)

			return Boolean(issuedAt && issuedAt >= todayStart && issuedAt <= todayEnd)
		})

		const todayPurchases = todaysInvoices.reduce((total, invoice) => {
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

		const totalPayable = invoices.reduce((total, invoice) => {
			const { remainingAmount } = getPrimaryInvoiceCurrencyAmounts(
				asInvoiceAmountSource(invoice),
			)

			return remainingAmount > 0 ? total + remainingAmount : total
		}, 0)

		const averageOrder =
			todaysInvoices.length > 0 ? todayPurchases / todaysInvoices.length : 0

		return {
			todayPurchases,
			paidInvoices,
			creditInvoices,
			totalPayable,
			averageOrder,
		}
	}

	private async applyPurchaseInventoryAdjustments(
		requestContext: RequestContext,
		buyingInvoiceId: string,
		invoiceNumber: string,
		items: NonNullable<BuyingInvoiceRequestBody['items']>,
		session: mongoose.ClientSession,
		warehouseId?: string,
	): Promise<string[]> {
		const touchedInventoryIds: string[] = []

		for (const item of items) {
			const inventory = await this.ops.getInventoryByProductId(
				requestContext,
				item.productId,
				session,
			)

			const updatedInventory = await this.ops.atomicPurchaseInventoryAdjustment(
				requestContext,
				{
					productId: item.productId,
					warehouseId: inventory?.warehouseId ?? warehouseId,
					purchaseQuantity: item.quantity,
					purchaseUnitPrice: item.unitPrice,
				},
				session,
			)

			await this.mongoDbClient.createDocument(
				{
					collectionName: COLLECTION_NAMES.STOCK_MOVINGS,
					data: {
						stockMovingId: uuidv4(),
						productId: item.productId,
						warehouseId: inventory?.warehouseId ?? warehouseId,
						type: 'purchase',
						quantity: item.quantity,
						unitCost: item.unitPrice,
						referenceType: 'buying_invoice',
						referenceId: buyingInvoiceId,
						note: `Buying Invoice #${invoiceNumber}`,
					},
					session,
				},
				StockMoving,
				requestContext,
			)

			touchedInventoryIds.push(updatedInventory.inventoryId)
		}

		return touchedInventoryIds
	}

	private async reversePurchaseInventoryAdjustments(
		requestContext: RequestContext,
		buyingInvoiceId: string,
		invoiceNumber: string,
		items: NonNullable<BuyingInvoiceRequestBody['items']>,
		session: mongoose.ClientSession,
	): Promise<string[]> {
		const touchedInventoryIds: string[] = []

		for (const item of items) {
			const inventory = await this.ops.getInventoryByProductId(
				requestContext,
				item.productId,
				session,
			)

			const updatedInventory = await this.ops.atomicAdjustInventoryQuantity(
				requestContext,
				{
					productId: item.productId,
					warehouseId: inventory?.warehouseId,
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
						warehouseId: inventory?.warehouseId,
						type: 'return_out',
						quantity: item.quantity,
						unitCost: item.unitPrice,
						referenceType: 'buying_invoice',
						referenceId: buyingInvoiceId,
						note: `Cancelled buying invoice #${invoiceNumber}`,
					},
					session,
				},
				StockMoving,
				requestContext,
			)

			touchedInventoryIds.push(updatedInventory.inventoryId)
		}

		return touchedInventoryIds
	}

	public async getBuyingInvoices(
		requestContext: RequestContext,
		filters: BuyingInvoicesQueryParams = {},
	): Promise<BuyingInvoicesListResponse> {
		const { documents } = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.BUYING_INVOICES,
			model: BuyingInvoice,
			sort: { createdAt: 'desc' },
		})

		const invoices = documents.filter(isPlainRecord)

		const normalizedSearch = filters.searchText?.trim().toLowerCase()

		const filteredInvoices = invoices.filter(invoice => {
			if (
				filters.supplierId &&
				String(invoice.supplierId ?? '') !== filters.supplierId
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
			const supplierName = String(invoice.supplierName ?? '').toLowerCase()

			return (
				invoiceNumber.includes(normalizedSearch) ||
				supplierName.includes(normalizedSearch)
			)
		})

		const scopedInvoices = filters.supplierId
			? invoices.filter(
					invoice => String(invoice.supplierId ?? '') === filters.supplierId,
				)
			: invoices

		const summary = this.buildBuyingInvoicesSummary(scopedInvoices)
		let supplierSummary: SupplierInvoiceSummary | undefined

		if (filters.supplierId) {
			const { data: supplierEntries } = await this.ops.getDailyActions(
				requestContext,
				{
					supplier: [filters.supplierId],
					entryType: [
						DailyActionType.BUYING_ENTRY,
						DailyActionType.PAYMENT_ENTRY,
					],
				},
			)

			supplierSummary = this.ops.buildSupplierInvoiceSummary(
				scopedInvoices,
				supplierEntries,
			)
		}

		const nextInvoiceNumber =
			await this.ops.resolveNextBuyingInvoiceNumber(requestContext)

		return {
			invoices: filteredInvoices,
			summary,
			supplierSummary,
			nextInvoiceNumber,
			totalCount: filteredInvoices.length,
		}
	}

	public async getBuyingInvoice(
		buyingInvoiceId: string,
		requestContext: RequestContext,
	): Promise<StoredBuyingInvoice | null> {
		return toStoredBuyingInvoice(
			await this.mongoDbClient.getDocumentByField<unknown>(
				requestContext,
				COLLECTION_NAMES.BUYING_INVOICES,
				BuyingInvoice,
				{ fieldName: 'buyingInvoiceId', fieldValue: buyingInvoiceId },
			),
		)
	}

	public async postBuyingInvoice(
		requestBody: BuyingInvoiceRequestBody,
		requestContext: RequestContext,
	) {
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

		const tenantContext = getTenantContext(requestContext)

		if (!requestBody.items?.length) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Buying invoice must contain at least one item.',
			)
		}

		const buyingInvoiceItems = requestBody.items

		await this.ensureInvoiceProductsBelongToTenant(
			requestContext,
			buyingInvoiceItems,
		)

		const grandTotal = buyingInvoiceItems.reduce(
			(total, item) =>
				total + (item.lineTotal ?? item.quantity * item.unitPrice),
			0,
		)

		const currencyAmounts =
			requestBody.currencyAmounts?.length &&
			requestBody.currencyAmounts.length > 0
				? requestBody.currencyAmounts
				: await this.ops.buildInvoiceCurrencyAmounts(tenantContext.tenantId, {
						grandTotal,
						paidAmount: 0,
						remainingAmount: grandTotal,
						subtotal: grandTotal,
						tax: 0,
						discount: 0,
					})

		if (!currencyAmounts.length) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Buying invoice currency amounts are required.',
			)
		}

		const primary =
			currencyAmounts.find(amount => amount.isPrimary) ?? currencyAmounts[0]

		const paymentStatus =
			requestBody.paymentStatus ??
			this.deriveInvoicePaymentStatus(primary.amount, primary.paidAmount)

		const status: NonNullable<BuyingInvoiceRequestBody['status']> =
			requestBody.status === InvoiceStatus.DRAFT ||
			requestBody.status === InvoiceStatus.CANCELLED
				? requestBody.status
				: paymentStatus === InvoicePaymentStatus.PAID
					? InvoiceStatus.PAID
					: paymentStatus === InvoicePaymentStatus.PARTIAL
						? InvoiceStatus.PARTIAL
						: requestBody.paymentType === InvoicePaymentType.CREDIT
							? InvoiceStatus.CONFIRMED
							: (requestBody.status ?? InvoiceStatus.CONFIRMED)

		const buyingInvoiceId = requestBody.buyingInvoiceId ?? uuidv4()

		const existingInvoice = requestBody.buyingInvoiceId
			? await this.getBuyingInvoice(requestBody.buyingInvoiceId, requestContext)
			: null

		if (existingInvoice) {
			const result = {
				_id: existingInvoice._id,
				buyingInvoiceId: existingInvoice.buyingInvoiceId,
				invoiceNumber: existingInvoice.invoiceNumber,
			}

			if (requestBody.clientMutationId) {
				await this.ops.recordSyncMutation(
					requestContext,
					requestBody.clientMutationId,
					'buying_invoice',
					'create',
					result,
				)
			}

			return result
		}

		const { createInvoiceResponse, touchedInventoryIds, invoiceNumber } =
			await this.ops.runInTransaction(async session => {
				const allocatedNumber = await this.ops.allocateInvoiceNumberForCreate(
					requestContext,
					'BI',
					requestBody.invoiceNumber,
					BuyingInvoice,
					session,
				)

				const created = await this.mongoDbClient.createDocument(
					{
						collectionName: COLLECTION_NAMES.BUYING_INVOICES,
						data: {
							buyingInvoiceId,
							invoiceNumber: allocatedNumber,
							supplierId: requestBody.supplierId,
							supplierName: requestBody.supplierName,
							supplierInvoiceNumber: requestBody.supplierInvoiceNumber,
							sourceSupplierName: requestBody.sourceSupplierName,
							paymentType: requestBody.paymentType,
							items: requestBody.items,
							status,
							paymentStatus,
							currencyAmounts,
							notes: requestBody.notes,
							invoiceDiscount: requestBody.invoiceDiscount ?? 0,
							invoiceDiscountIsPercent:
								requestBody.invoiceDiscountIsPercent ?? false,
							warehouseId: requestBody.warehouseId,
							issuedAt: requestBody.issuedAt
								? new Date(requestBody.issuedAt)
								: new Date(),
						},
						session,
					},
					BuyingInvoice,
					requestContext,
				)

				const inventoryIds = this.shouldAdjustInventoryForInvoice(status)
					? await this.applyPurchaseInventoryAdjustments(
							requestContext,
							buyingInvoiceId,
							allocatedNumber,
							buyingInvoiceItems,
							session,
							requestBody.warehouseId,
						)
					: []

				return {
					createInvoiceResponse: created,
					touchedInventoryIds: inventoryIds,
					invoiceNumber: allocatedNumber,
				}
			})

		for (const inventoryId of touchedInventoryIds) {
			await this.ops.invalidateEntityCache(
				'inventory',
				requestContext,
				inventoryId,
			)
		}

		await redisCache.del(
			redisCache.buildSupplierListKey(this.getTenantId(requestContext)),
		)

		const result = {
			_id: createInvoiceResponse._id,
			buyingInvoiceId,
			invoiceNumber,
		}

		if (requestBody.clientMutationId) {
			await this.ops.recordSyncMutation(
				requestContext,
				requestBody.clientMutationId,
				'buying_invoice',
				'create',
				result,
			)
		}

		return result
	}

	public async patchBuyingInvoice(
		buyingInvoiceId: string,
		requestBody: Partial<BuyingInvoiceRequestBody>,
		requestContext: RequestContext,
	) {
		const existingInvoice = await this.getBuyingInvoice(
			buyingInvoiceId,
			requestContext,
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

		const { updateResponse, touchedInventoryIds } =
			await this.ops.runInTransaction(async session => {
				let inventoryIds: string[] = []

				if (shouldReverse && existingInvoice) {
					inventoryIds = await this.reversePurchaseInventoryAdjustments(
						requestContext,
						existingInvoice.buyingInvoiceId,
						existingInvoice.invoiceNumber,
						asInvoiceLines(existingInvoice.items),
						session,
					)
				}

				if (shouldApply && existingInvoice && itemsToApply.length) {
					inventoryIds = [
						...inventoryIds,
						...(await this.applyPurchaseInventoryAdjustments(
							requestContext,
							existingInvoice.buyingInvoiceId,
							existingInvoice.invoiceNumber,
							itemsToApply,
							session,
							requestBody.warehouseId ?? existingInvoice.warehouseId,
						)),
					]
				}

				const updated = await this.mongoDbClient.updateDocument(
					{
						collectionName: COLLECTION_NAMES.BUYING_INVOICES,
						id: buyingInvoiceId,
						session,
					},
					requestContext,
					BuyingInvoice,
					requestBody,
				)

				return { updateResponse: updated, touchedInventoryIds: inventoryIds }
			})

		for (const inventoryId of touchedInventoryIds) {
			await this.ops.invalidateEntityCache(
				'inventory',
				requestContext,
				inventoryId,
			)
		}

		await redisCache.del(
			redisCache.buildSupplierListKey(this.getTenantId(requestContext)),
		)

		return updateResponse
	}

	public async deleteBuyingInvoice(
		buyingInvoiceId: string,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.invoicesBuyingDelete])

		const existingInvoice = await this.getBuyingInvoice(
			buyingInvoiceId,
			requestContext,
		)
		const wasStockAffecting = Boolean(
			existingInvoice &&
			this.shouldAdjustInventoryForInvoice(existingInvoice.status),
		)

		const touchedInventoryIds =
			wasStockAffecting && existingInvoice
				? await this.ops.runInTransaction(async session =>
						this.reversePurchaseInventoryAdjustments(
							requestContext,
							existingInvoice.buyingInvoiceId,
							existingInvoice.invoiceNumber,
							asInvoiceLines(existingInvoice.items),
							session,
						),
					)
				: []

		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.BUYING_INVOICES, id: buyingInvoiceId },
			requestContext,
			BuyingInvoice,
		)

		for (const inventoryId of touchedInventoryIds) {
			await this.ops.invalidateEntityCache(
				'inventory',
				requestContext,
				inventoryId,
			)
		}

		await redisCache.del(
			redisCache.buildSupplierListKey(this.getTenantId(requestContext)),
		)

		return deleteResponse
	}

	public async getInvoiceAiUsage(
		requestContext: RequestContext,
	): Promise<InvoiceAiUsageResponse> {
		await ensureTenantAccess(
			requestContext,
			COLLECTION_NAMES.BUYING_INVOICES,
			'create',
		)

		const usage = await getInvoiceAiUsage(
			getTenantContext(requestContext).tenantId,
		)

		return {
			available: usage.available,
			monthlyLimit: usage.monthlyLimit,
			nextPeriodStartsAt: usage.nextPeriodStartsAt.toISOString(),
		}
	}

	public async extractBuyingInvoice(
		requestBody: Record<string, unknown>,
		requestContext: RequestContext,
	) {
		await ensureTenantAccess(
			requestContext,
			COLLECTION_NAMES.BUYING_INVOICES,
			'create',
		)

		const tenantId = getTenantContext(requestContext).tenantId
		const input = decodeInvoiceUpload(requestBody)
		const reserved = await reserveInvoiceAiCredit(tenantId)

		try {
			const extraction = await extractInvoice(input)
			// ponytail: full live catalog into RAM per extract (O(n) scan). Upgrade: candidate prefilter / indexed lookup if catalogs grow.
			const products = await withTenantScope(
				Product.find({ status: { $ne: 'discontinued' } })
					.select(
						'productId name latinName barcode internalCode productFactoryCode aliases unitId categoryId supplierId',
					)
					.lean(),
				tenantId,
			)
			const suppliers = await withTenantScope(
				Supplier.find({})
					.select('supplierId name internalCode email vatId aliases')
					.lean(),
				tenantId,
			)

			return await matchExtractedInvoice(
				extraction,
				products,
				suppliers,
				rankInput => getInvoiceAiProvider().rankMatch(rankInput),
			)
		} catch (error) {
			try {
				await refundInvoiceAiCredit(tenantId, reserved.periodStart)
			} catch {
				// keep the extract error
			}

			throw error
		}
	}

	public async confirmBuyingInvoiceMatch(
		requestBody: Record<string, unknown>,
		requestContext: RequestContext,
	) {
		if (requestBody.kind !== 'product' && requestBody.kind !== 'supplier') {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				'kind must be product or supplier.',
			)
		}

		const kind = requestBody.kind

		await ensureTenantAccess(
			requestContext,
			COLLECTION_NAMES.BUYING_INVOICES,
			'create',
		)

		await ensureTenantAccess(
			requestContext,
			kind === 'product'
				? COLLECTION_NAMES.PRODUCTS
				: COLLECTION_NAMES.SUPPLIERS,
			'update',
		)

		const id = typeof requestBody.id === 'string' ? requestBody.id.trim() : ''
		const alias =
			typeof requestBody.alias === 'string' ? requestBody.alias.trim() : ''

		if (!id || !alias) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'id and alias are required.',
			)
		}

		if (alias.length > 100) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				'alias must be 100 characters or fewer.',
			)
		}

		const tenantId = getTenantContext(requestContext).tenantId
		const normalizedAlias = alias.toLowerCase()

		if (kind === 'product') {
			const product = await withTenantScope(
				Product.findOne({ productId: id }).lean(),
				tenantId,
			)

			if (!product) {
				throw new BusinessLogicError(
					ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
					'Product not found.',
				)
			}

			if (
				product.name.trim().toLowerCase() === normalizedAlias ||
				(product.aliases ?? []).some(
					value => value.trim().toLowerCase() === normalizedAlias,
				)
			) {
				return { ok: true }
			}

			await withTenantScope(
				Product.findOneAndUpdate(
					{ productId: id },
					{ $addToSet: { aliases: alias } },
				),
				tenantId,
			)

			await this.ops.invalidateEntityCache('products', requestContext, id)

			return { ok: true }
		}

		const supplier = await withTenantScope(
			Supplier.findOne({ supplierId: id }).lean(),
			tenantId,
		)

		if (!supplier) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Supplier not found.',
			)
		}

		if (
			supplier.name.trim().toLowerCase() === normalizedAlias ||
			(supplier.aliases ?? []).some(
				value => value.trim().toLowerCase() === normalizedAlias,
			)
		) {
			return { ok: true }
		}

		await withTenantScope(
			Supplier.findOneAndUpdate(
				{ supplierId: id },
				{ $addToSet: { aliases: alias } },
			),
			tenantId,
		)

		await redisCache.del(redisCache.buildSupplierListKey(tenantId))

		return { ok: true }
	}
}
