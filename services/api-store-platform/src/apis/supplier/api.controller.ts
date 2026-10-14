import { BusinessLogicError } from '../../middleware/errorHandler'
import { BuyingInvoice } from '../../models/BuyingInvoices'
import { DailyAction } from '../../models/DailyAction'
import { Invoice } from '../../models/Invoice'
import { Product } from '../../models/Products'
import { Supplier, type ISupplier } from '../../models/Supplier'
import { ERROR_CODES } from '../../shared/errorCodes'
import logger, { EntityType } from '../../shared/logger/logger'
import MongodbController from '../../shared/mongodb/mongodbController'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { filterByWarehouseAcl } from '../../shared/warehouseAccess'
import { redisCache } from '../../shared/cache/redisCache'
import { loadCashCurrencyRates } from '../../shared/cashAccounts/posting'
import CurrencySettings from '../../models/CurrencySettings'
import {
	normalizeOpeningBalances,
	openingBalancePrimary,
	ratesFromCurrencySettings,
	type CostCurrencyRate,
} from '../../shared/inventoryCost'
import { COLLECTION_NAMES } from '../../shared/general'
import { SEE } from '../../shared/seeCatalog'
import { ensureSeeIds } from '../../shared/seePermissions'
import {
	DeleteBlockReason,
	stampDeleteAvailability,
} from '../../shared/deleteBlock'
import { getTenantContext } from '../../shared/tenant'
import { resolveSyncClientId } from '../../shared/uuid'
import {
	CreateSupplierResponse,
	SupplierDocument,
	SupplierInvoiceSummary,
	SupplierRequestBody,
	RequestContext,
} from '../../shared/types'
import { DailyActionResponse, SuppliersResponse } from '../../shared/types/api'
import {
	filterSupplierRelatedActions,
	groupInvoicesByPartyId,
	mapSuppliers,
} from '../mappings/mapper'

export type SupplierInvoiceCollaborator = {
	getDailyActions(
		requestContext: RequestContext,
		filters?: object,
		warehouseScope?: 'working' | 'acl',
	): Promise<DailyActionResponse>
	getPartyEntries(
		requestContext: RequestContext,
		ids: string[],
		fields: Array<'customerId' | 'supplierId' | 'partnerId'>,
	): Promise<DailyActionResponse['data']>
	buildSupplierInvoiceSummary(
		invoices: Array<Record<string, unknown>>,
		supplierEntries?: DailyActionResponse['data'],
		rates?: readonly CostCurrencyRate[],
	): SupplierInvoiceSummary
}

const canSeePayable = (requestContext: RequestContext) =>
	(requestContext.see || []).includes('suppliers.totalPayable')

const omitPayableIfHidden = (
	supplier: SuppliersResponse['data'][number],
	requestContext: RequestContext,
): SuppliersResponse['data'][number] => {
	if (canSeePayable(requestContext)) return supplier

	const { ...row } = supplier

	return row
}

export default class SupplierController {
	constructor(
		private mongoDbClient: MongodbController,
		private invoiceCollaborator: SupplierInvoiceCollaborator,
	) {}

	private getTenantId(requestContext: RequestContext): string {
		return requestContext.tenantId || 'global'
	}

	private escapeRegex(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	}

	public async getSuppliers(
		requestContext: RequestContext,
	): Promise<SuppliersResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildSupplierListKey(tenantId)
		const cachedSuppliers =
			await redisCache.getJson<SuppliersResponse>(cacheKey)

		if (cachedSuppliers) {
			const visible = cachedSuppliers.data.map(supplier =>
				omitPayableIfHidden(supplier, requestContext),
			)

			return {
				...cachedSuppliers,
				data: await this.withSupplierDeleteFlags(tenantId, visible),
			}
		}

		const suppliers = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.SUPPLIERS,
			model: Supplier,
			sort: { createdAt: 'desc' },
		})

		const dailyActions =
			await this.invoiceCollaborator.getDailyActions(requestContext)
		const buyingInvoices: unknown[] = (
			await this.mongoDbClient.getDocuments({
				requestContext,
				collectionName: COLLECTION_NAMES.BUYING_INVOICES,
				model: BuyingInvoice,
				sort: { createdAt: 'desc' },
			})
		).documents

		const sellingInvoices: unknown[] = (
			await this.mongoDbClient.getDocuments({
				requestContext,
				collectionName: COLLECTION_NAMES.INVOICES,
				model: Invoice,
				sort: { createdAt: 'desc' },
			})
		).documents
		const invoicesBySupplierId = groupInvoicesByPartyId(
			buyingInvoices,
			'supplierId',
		)
		const sellingInvoicesByCustomerId = groupInvoicesByPartyId(
			sellingInvoices,
			'customerId',
		)
		const rates = await loadCashCurrencyRates(tenantId)

		const data = suppliers.documents.map((supplier: SupplierDocument) => {
			const actions = filterSupplierRelatedActions(dailyActions.data, supplier)
			const { totalPayable: buyingPayable } =
				this.invoiceCollaborator.buildSupplierInvoiceSummary(
					invoicesBySupplierId.get(supplier.supplierId) ?? [],
					actions,
					rates,
				)
			const sellingOwed = this.invoiceCollaborator.buildSupplierInvoiceSummary(
				sellingInvoicesByCustomerId.get(supplier.supplierId) ?? [],
				[],
			)
			const totalPayable =
				buyingPayable -
				(sellingOwed.totalInvoiced - sellingOwed.totalPaid) +
				openingBalancePrimary('supplier', supplier.openingBalances, rates)

			return {
				supplierId: supplier.supplierId,
				name: supplier.name,
				internalCode: supplier.internalCode,
				openingBalances: supplier.openingBalances,
				createdAt: supplier.createdAt?.toISOString(),
				updatedAt: supplier.updatedAt?.toISOString(),
				totalPayable,
				createdBy: supplier.createdBy
					? {
							...supplier.createdBy,
							createdAt:
								supplier.createdBy.createdAt instanceof Date
									? supplier.createdBy.createdAt.toISOString()
									: (supplier.createdAt?.toISOString() ?? ''),
						}
					: undefined,
				updatedBy: supplier.updatedBy
					? {
							...supplier.updatedBy,
							updatedAt: supplier.updatedBy.updatedAt.toISOString(),
						}
					: undefined,
				actions,
			}
		})

		const mappedSuppliers = mapSuppliers(data)
		const response: SuppliersResponse = {
			data: mappedSuppliers,
			totalCount: mappedSuppliers.length,
		}

		await redisCache.setJson(cacheKey, response)

		const visible = response.data.map(supplier =>
			omitPayableIfHidden(supplier, requestContext),
		)

		return {
			...response,
			data: await this.withSupplierDeleteFlags(tenantId, visible),
		}
	}

	public async getSupplier(
		supplierId: string,
		requestContext: RequestContext,
	): Promise<SuppliersResponse['data'][number] | null> {
		const supplier =
			await this.mongoDbClient.getDocumentByField<SupplierDocument>(
				requestContext,
				COLLECTION_NAMES.SUPPLIERS,
				Supplier,
				{ fieldName: 'supplierId', fieldValue: supplierId },
			)

		if (!supplier) {
			return null
		}

		const ids = [supplier.supplierId, supplier.internalCode].filter(
			(id): id is string => Boolean(id),
		)
		const tenantId = this.getTenantId(requestContext)
		const [actions, buyingInvoices, sellingInvoices, rates] = await Promise.all(
			[
				this.invoiceCollaborator.getPartyEntries(requestContext, ids, [
					'supplierId',
					'customerId',
				]),
				withTenantScope(
					BuyingInvoice.find({ supplierId: { $in: ids } }).sort({
						createdAt: 'desc',
					}),
					tenantId,
				).lean<Array<Record<string, unknown> & { warehouseId?: string }>>(),
				withTenantScope(
					Invoice.find({ customerId: { $in: ids } }).sort({
						createdAt: 'desc',
					}),
					tenantId,
				).lean<Array<Record<string, unknown> & { warehouseId?: string }>>(),
				loadCashCurrencyRates(tenantId),
			],
		)
		const invoices = filterByWarehouseAcl(requestContext, buyingInvoices)
		const sellingInvoicesInScope = filterByWarehouseAcl(
			requestContext,
			sellingInvoices,
		)
		const own = this.invoiceCollaborator.buildSupplierInvoiceSummary(
			invoices,
			actions,
			rates,
		)
		const sellingOwed = this.invoiceCollaborator.buildSupplierInvoiceSummary(
			sellingInvoicesInScope,
			[],
		)

		const mappedSuppliers = mapSuppliers([
			{
				supplierId: supplier.supplierId,
				name: supplier.name,
				internalCode: supplier.internalCode,
				createdAt: supplier.createdAt?.toISOString(),
				updatedAt: supplier.updatedAt?.toISOString(),
				createdBy: supplier.createdBy
					? {
							...supplier.createdBy,
							createdAt:
								supplier.createdBy.createdAt instanceof Date
									? supplier.createdBy.createdAt.toISOString()
									: (supplier.createdAt?.toISOString() ?? ''),
						}
					: undefined,
				updatedBy: supplier.updatedBy
					? {
							...supplier.updatedBy,
							updatedAt: supplier.updatedBy.updatedAt.toISOString(),
						}
					: undefined,
				openingBalances: supplier.openingBalances,
				actions,
			},
		])

		const mapped = mappedSuppliers[0]

		if (!mapped) return null

		return omitPayableIfHidden(
			{
				...mapped,
				invoices,
				sellingInvoices: sellingInvoicesInScope,
				invoiceSummary: {
					totalInvoiced: own.totalInvoiced,
					totalPaid: own.totalPaid,
					outstanding:
						own.totalPayable -
						(sellingOwed.totalInvoiced - sellingOwed.totalPaid) +
						openingBalancePrimary('supplier', supplier.openingBalances, rates),
				},
			},
			requestContext,
		)
	}

	public async postSupplier(
		requestContext: RequestContext,
		requestBody: SupplierRequestBody,
	): Promise<CreateSupplierResponse | null> {
		await ensureSeeIds(requestContext, [SEE.suppliersAdd])
		const { name } = requestBody
		const tenantContext = getTenantContext(requestContext)

		if (!name || !name.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Supplier name is required',
			)
		}

		const existing = await withTenantScope(
			Supplier.findOne({
				name: new RegExp(`^${this.escapeRegex(name)}$`, 'i'),
			}),
			tenantContext.tenantId,
		).lean()

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'supplier already exists in this tenant.',
			)
		}

		const supplierId = resolveSyncClientId(requestBody.supplierId)

		const existingById = await withTenantScope(
			Supplier.findOne({ supplierId }).lean(),
			tenantContext.tenantId,
		)

		if (existingById) {
			return {
				_id: existingById.supplierId,
				supplierId: existingById.supplierId,
			}
		}

		const internalCode = requestBody.internalCode?.trim()
		const supplierData: Record<string, unknown> = {
			supplierId,
			name,
			...(internalCode ? { internalCode } : {}),
		}

		logger.info('Saving supplier to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			supplierId,
			name,
		})

		await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.SUPPLIERS, data: supplierData },
			Supplier,
			requestContext,
		)

		logger.info('Supplier created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			supplierId,
			name,
		})

		await redisCache.del(
			redisCache.buildSupplierListKey(tenantContext.tenantId),
		)

		return {
			_id: supplierId,
			supplierId,
		}
	}

	public async patchOpeningBalance(
		supplierId: string,
		requestBody: { openingBalances?: unknown },
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.suppliersAdd])
		const tenantId = this.getTenantId(requestContext)
		const settings = await CurrencySettings.findOne({ tenantId })
			.select('primaryCurrency secondaryCurrencies')
			.lean()
		const currencies = ratesFromCurrencySettings(settings).map(rate => ({
			currencyId: rate.currencyId,
			code: rate.label,
		}))

		let openingBalances

		try {
			openingBalances = normalizeOpeningBalances(
				requestBody?.openingBalances,
				currencies,
			)
		} catch (error) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				error instanceof Error ? error.message : 'Opening balance is invalid.',
			)
		}

		const updated = await withTenantScope(
			Supplier.findOneAndUpdate(
				{ supplierId },
				{
					$set: {
						openingBalances,
						updatedBy: {
							_id: requestContext.userId as string,
							displayName:
								`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim(),
							updatedAt: new Date(),
						},
					},
				},
				{ new: true },
			),
			tenantId,
		).lean<ISupplier | null>()

		if (!updated) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Supplier not found.',
			)
		}

		await redisCache.del(redisCache.buildSupplierListKey(tenantId))

		return {
			supplierId: updated.supplierId,
			openingBalances: updated.openingBalances ?? [],
		}
	}

	private async findSupplierDeleteBlocks(tenantId: string, ids: string[]) {
		const uniqueIds = [...new Set(ids.filter(Boolean))]
		const blocked = new Map<string, string>()
		const [products, buyingInvoices, sellingInvoices, actions] =
			await Promise.all([
				withTenantScope(
					Product.find({ supplierId: { $in: uniqueIds } })
						.select({ supplierId: 1 })
						.lean(),
					tenantId,
				),
				withTenantScope(
					BuyingInvoice.find({ supplierId: { $in: uniqueIds } })
						.select({ supplierId: 1 })
						.lean(),
					tenantId,
				),
				withTenantScope(
					Invoice.find({ customerId: { $in: uniqueIds } })
						.select({ customerId: 1 })
						.lean(),
					tenantId,
				),
				withTenantScope(
					DailyAction.find({ supplierId: { $in: uniqueIds } })
						.select({ supplierId: 1 })
						.lean(),
					tenantId,
				),
			])

		for (const row of products) {
			if (row.supplierId && !blocked.has(row.supplierId)) {
				blocked.set(row.supplierId, DeleteBlockReason.products)
			}
		}

		for (const row of buyingInvoices) {
			if (row.supplierId && !blocked.has(row.supplierId)) {
				blocked.set(row.supplierId, DeleteBlockReason.buyingInvoice)
			}
		}

		for (const row of sellingInvoices) {
			if (row.customerId && !blocked.has(row.customerId)) {
				blocked.set(row.customerId, DeleteBlockReason.invoice)
			}
		}

		for (const row of actions) {
			if (row.supplierId && !blocked.has(row.supplierId)) {
				blocked.set(row.supplierId, DeleteBlockReason.dailyAction)
			}
		}

		return blocked
	}

	private async withSupplierDeleteFlags<T extends { supplierId: string }>(
		tenantId: string,
		rows: T[],
	) {
		const blocked = await this.findSupplierDeleteBlocks(
			tenantId,
			rows.map(row => row.supplierId),
		)

		return stampDeleteAvailability(rows, row => row.supplierId, blocked)
	}

	public async deleteSupplier(
		supplierId: string,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.suppliersDelete])

		const tenantContext = getTenantContext(requestContext)
		const blocked = await this.findSupplierDeleteBlocks(
			tenantContext.tenantId,
			[supplierId],
		)
		const reason = blocked.get(supplierId)

		if (reason) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				reason,
			)
		}

		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.SUPPLIERS, id: supplierId },
			requestContext,
			Supplier,
		)

		await redisCache.del(
			redisCache.buildSupplierListKey(tenantContext.tenantId),
		)

		return deleteResponse
	}

	public async bulkDeleteSuppliers(
		supplierIds: string[],
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.suppliersDelete])

		const tenantContext = getTenantContext(requestContext)
		const ids = [...new Set(supplierIds.filter(Boolean))]
		const blocked = await this.findSupplierDeleteBlocks(
			tenantContext.tenantId,
			ids,
		)
		const deleted: string[] = []
		const blockedRows: Array<{ supplierId: string; reason: string }> = []

		for (const supplierId of ids) {
			const reason = blocked.get(supplierId)

			if (reason) {
				blockedRows.push({ supplierId, reason })

				continue
			}

			try {
				await this.mongoDbClient.deleteDocument(
					{ collectionName: COLLECTION_NAMES.SUPPLIERS, id: supplierId },
					requestContext,
					Supplier,
				)

				deleted.push(supplierId)
			} catch {
				blockedRows.push({
					supplierId,
					reason: 'Supplier could not be deleted.',
				})
			}
		}

		if (deleted.length) {
			await redisCache.del(
				redisCache.buildSupplierListKey(tenantContext.tenantId),
			)
		}

		return { deleted, blocked: blockedRows }
	}
}
