import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { BuyingInvoice } from '../../models/BuyingInvoices'
import { Product } from '../../models/Products'
import { Supplier } from '../../models/Supplier'
import { ERROR_CODES } from '../../shared/errorCodes'
import logger, { EntityType } from '../../shared/logger/logger'
import MongodbController from '../../shared/mongodb/mongodbController'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { redisCache } from '../../shared/cache/redisCache'
import { COLLECTION_NAMES } from '../../shared/general'
import { SEE } from '../../shared/seeCatalog'
import { ensureSeeIds } from '../../shared/seePermissions'
import { getTenantContext } from '../../shared/tenant'
import {
	CreateSupplierResponse,
	SupplierDocument,
	SupplierInvoiceSummary,
	SupplierRequestBody,
	RequestContext,
} from '../../shared/types'
import { DailyActionResponse, SuppliersResponse } from '../../shared/types/api'
import { mapSuppliers } from '../mappings/mapper'

export type SupplierInvoiceCollaborator = {
	getDailyActions(requestContext: RequestContext): Promise<DailyActionResponse>
	buildSupplierInvoiceSummary(
		invoices: Array<Record<string, unknown>>,
		supplierEntries?: DailyActionResponse['data'],
	): SupplierInvoiceSummary
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

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

	private resolveSyncClientId(clientId?: string): string {
		const trimmed = clientId?.trim()

		if (trimmed && /^[0-9a-f-]{36}$/i.test(trimmed)) {
			return trimmed
		}

		return uuidv4()
	}

	public async getSuppliers(
		requestContext: RequestContext,
	): Promise<SuppliersResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildSupplierListKey(tenantId)
		const cachedSuppliers =
			await redisCache.getJson<SuppliersResponse>(cacheKey)

		if (cachedSuppliers) {
			return {
				...cachedSuppliers,
				data: cachedSuppliers.data.map(supplier =>
					omitPayableIfHidden(supplier, requestContext),
				),
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

		const invoicesBySupplierId = new Map<
			string,
			Array<Record<string, unknown>>
		>()

		for (const invoice of buyingInvoices) {
			if (!isPlainRecord(invoice)) continue

			const supplierId = String(invoice.supplierId ?? '')

			if (!supplierId) continue

			const existing = invoicesBySupplierId.get(supplierId)

			if (existing) {
				existing.push(invoice)
			} else {
				invoicesBySupplierId.set(supplierId, [invoice])
			}
		}

		const data = suppliers.documents.map((supplier: SupplierDocument) => {
			const actions = dailyActions.data.filter(
				action => action.supplierId === supplier.supplierId,
			)
			const { totalPayable } =
				this.invoiceCollaborator.buildSupplierInvoiceSummary(
					invoicesBySupplierId.get(supplier.supplierId) ?? [],
					actions,
				)

			return {
				supplierId: supplier.supplierId,
				name: supplier.name,
				internalCode: supplier.internalCode,
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

		return {
			...response,
			data: response.data.map(supplier =>
				omitPayableIfHidden(supplier, requestContext),
			),
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

		const dailyActions =
			await this.invoiceCollaborator.getDailyActions(requestContext)
		const actions = dailyActions.data.filter(
			action =>
				action.supplierId === supplier.supplierId ||
				action.supplierId === supplier.internalCode,
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
				actions,
			},
		])

		const mapped = mappedSuppliers[0]

		if (!mapped) return null

		return omitPayableIfHidden(mapped, requestContext)
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

		const supplierId = this.resolveSyncClientId(requestBody.supplierId)

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

		const supplierData: Record<string, unknown> = {
			supplierId,
			name,
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

	private async findSupplierDeleteBlocks(tenantId: string, ids: string[]) {
		const uniqueIds = [...new Set(ids.filter(Boolean))]
		const blocked = new Map<string, string>()
		const [products, buyingInvoices] = await Promise.all([
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
		])

		for (const row of products) {
			if (row.supplierId && !blocked.has(row.supplierId)) {
				blocked.set(
					row.supplierId,
					'This supplier has products and cannot be deleted.',
				)
			}
		}

		for (const row of buyingInvoices) {
			if (row.supplierId && !blocked.has(row.supplierId)) {
				blocked.set(
					row.supplierId,
					'This supplier has buying invoices and cannot be deleted.',
				)
			}
		}

		return blocked
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
