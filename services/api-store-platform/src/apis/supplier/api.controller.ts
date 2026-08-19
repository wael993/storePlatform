import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { BuyingInvoice } from '../../models/BuyingInvoices'
import { Supplier } from '../../models/Supplier'
import { ERROR_CODES } from '../../shared/errorCodes'
import logger, { EntityType } from '../../shared/logger/logger'
import MongodbController from '../../shared/mongodb/mongodbController'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { redisCache } from '../../shared/cache/redisCache'
import { COLLECTION_NAMES } from '../../shared/general'
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
			return cachedSuppliers
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
				action =>
					action.supplierId === supplier.supplierId ||
					action.supplierId === supplier.internalCode,
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

		return response
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

		return mappedSuppliers[0]
	}

	public async postSupplier(
		requestContext: RequestContext,
		requestBody: SupplierRequestBody,
	): Promise<CreateSupplierResponse | null> {
		const { name, internalCode } = requestBody
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
				_id: String(existingById._id),
				supplierId: existingById.supplierId,
			}
		}

		const supplierData: Record<string, unknown> = {
			supplierId,
			name,
			internalCode: internalCode?.trim() || undefined,
		}

		logger.info('Saving supplier to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			supplierId,
			name,
		})

		const createSupplierResponse = await this.mongoDbClient.createDocument(
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
			_id: createSupplierResponse._id,
		}
	}
}
