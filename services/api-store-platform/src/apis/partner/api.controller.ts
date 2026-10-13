import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { BuyingInvoice } from '../../models/BuyingInvoices'
import { DailyAction } from '../../models/DailyAction'
import { Invoice } from '../../models/Invoice'
import { Partner } from '../../models/Partner'
import { ERROR_CODES } from '../../shared/errorCodes'
import logger, { EntityType } from '../../shared/logger/logger'
import MongodbController from '../../shared/mongodb/mongodbController'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { filterByWarehouseAcl } from '../../shared/warehouseAccess'
import { redisCache } from '../../shared/cache/redisCache'
import { loadCashCurrencyRates } from '../../shared/cashAccounts/posting'
import type { CostCurrencyRate } from '../../shared/inventoryCost'
import type { CustomerInvoiceSummary } from '../../shared/types'
import { COLLECTION_NAMES } from '../../shared/general'
import { SEE } from '../../shared/seeCatalog'
import { ensureSeeIds } from '../../shared/seePermissions'
import { getTenantContext } from '../../shared/tenant'
import { resolveSyncClientId } from '../../shared/uuid'
import {
	CreatePartnerResponse,
	PartnerDocument,
	PartnerRequestBody,
	RequestContext,
} from '../../shared/types'
import { DailyActionResponse, PartnersResponse } from '../../shared/types/api'
import { filterPartnerRelatedActions, mapPartners } from '../mappings/mapper'

export type PartnerDailyActionCollaborator = {
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
	buildCustomerInvoiceSummary(
		invoices: Array<Record<string, unknown>>,
		customerEntries?: DailyActionResponse['data'],
		rates?: readonly CostCurrencyRate[],
	): CustomerInvoiceSummary
}

export default class PartnerController {
	constructor(
		private mongoDbClient: MongodbController,
		private dailyActions: PartnerDailyActionCollaborator,
	) {}

	private getTenantId(requestContext: RequestContext): string {
		return requestContext.tenantId || 'global'
	}

	private escapeRegex(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	}

	public async getPartners(
		requestContext: RequestContext,
	): Promise<PartnersResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildPartnerListKey(tenantId)
		const cachedPartners = await redisCache.getJson<PartnersResponse>(cacheKey)

		if (cachedPartners) {
			return cachedPartners
		}

		const partners = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.PARTNERS,
			model: Partner,
			sort: { createdAt: 'desc' },
		})
		const dailyActions = await this.dailyActions.getDailyActions(requestContext)

		const data = partners.documents.map((partner: PartnerDocument) => ({
			partnerId: partner.partnerId,
			name: partner.name,
			internalCode: partner.internalCode,
			createdAt: partner.createdAt?.toISOString(),
			updatedAt: partner.updatedAt?.toISOString(),
			createdBy: partner.createdBy
				? {
						...partner.createdBy,
						createdAt:
							partner.createdBy.createdAt instanceof Date
								? partner.createdBy.createdAt.toISOString()
								: (partner.createdAt?.toISOString() ?? ''),
					}
				: undefined,
			updatedBy: partner.updatedBy
				? {
						...partner.updatedBy,
						updatedAt: partner.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
			partnerEntries: filterPartnerRelatedActions(dailyActions.data, partner),
		}))

		const mappedPartners = mapPartners(data)
		const response: PartnersResponse = {
			data: mappedPartners,
			totalCount: mappedPartners.length,
		}

		await redisCache.setJson(cacheKey, response)

		return response
	}

	public async getPartner(
		partnerId: string,
		requestContext: RequestContext,
	): Promise<PartnersResponse['data'][number] | null> {
		const partner =
			await this.mongoDbClient.getDocumentByField<PartnerDocument>(
				requestContext,
				COLLECTION_NAMES.PARTNERS,
				Partner,
				{ fieldName: 'partnerId', fieldValue: partnerId },
			)

		if (!partner) {
			return null
		}

		const ids = [partner.partnerId, partner.internalCode].filter(
			(id): id is string => Boolean(id),
		)
		const tenantId = this.getTenantId(requestContext)
		const [partnerEntries, sellingInvoices, buyingInvoices, rates] =
			await Promise.all([
				this.dailyActions.getPartyEntries(requestContext, ids, ['partnerId']),
				withTenantScope(
					Invoice.find({ customerId: { $in: ids } }).sort({
						createdAt: 'desc',
					}),
					tenantId,
				).lean<Array<Record<string, unknown> & { warehouseId?: string }>>(),
				withTenantScope(
					BuyingInvoice.find({ supplierId: { $in: ids } }).sort({
						createdAt: 'desc',
					}),
					tenantId,
				).lean<Array<Record<string, unknown> & { warehouseId?: string }>>(),
				loadCashCurrencyRates(tenantId),
			])

		const invoices = filterByWarehouseAcl(requestContext, sellingInvoices)
		const buyingInvoicesInScope = filterByWarehouseAcl(
			requestContext,
			buyingInvoices,
		)
		const own = this.dailyActions.buildCustomerInvoiceSummary(
			invoices,
			partnerEntries,
			rates,
		)
		const buyingOwed = this.dailyActions.buildCustomerInvoiceSummary(
			buyingInvoicesInScope,
			[],
		)

		const mappedPartners = mapPartners([
			{
				partnerId: partner.partnerId,
				name: partner.name,
				internalCode: partner.internalCode,
				createdAt: partner.createdAt?.toISOString(),
				updatedAt: partner.updatedAt?.toISOString(),
				createdBy: partner.createdBy
					? {
							...partner.createdBy,
							createdAt:
								partner.createdBy.createdAt instanceof Date
									? partner.createdBy.createdAt.toISOString()
									: (partner.createdAt?.toISOString() ?? ''),
						}
					: undefined,
				updatedBy: partner.updatedBy
					? {
							...partner.updatedBy,
							updatedAt: partner.updatedBy.updatedAt.toISOString(),
						}
					: undefined,
				partnerEntries,
			},
		])

		const mapped = mappedPartners[0]

		if (!mapped) return null

		return {
			...mapped,
			sellingInvoices: invoices,
			buyingInvoices: buyingInvoicesInScope,
			invoiceSummary: {
				totalInvoiced: own.totalInvoiced,
				totalPaid: own.totalPaid,
				outstanding:
					own.totalReceivable -
					(buyingOwed.totalInvoiced - buyingOwed.totalPaid),
			},
		}
	}

	public async postPartner(
		requestContext: RequestContext,
		requestBody: PartnerRequestBody,
	): Promise<CreatePartnerResponse | null> {
		await ensureSeeIds(requestContext, [SEE.partnersAdd])
		const { name, internalCode } = requestBody
		const tenantContext = getTenantContext(requestContext)

		if (!name || !name.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Partner name is required',
			)
		}

		const existing = await withTenantScope(
			Partner.findOne({
				name: new RegExp(`^${this.escapeRegex(name)}$`, 'i'),
			}),
			tenantContext.tenantId,
		).lean()

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'partner already exists in this tenant.',
			)
		}

		const partnerId = resolveSyncClientId(requestBody.partnerId)

		const existingById = await withTenantScope(
			Partner.findOne({ partnerId }).lean(),
			tenantContext.tenantId,
		)

		if (existingById) {
			return {
				_id: String(existingById._id),
				partnerId: existingById.partnerId,
			}
		}

		const partnerData: Record<string, unknown> = {
			tenantId: tenantContext.tenantId,
			_id: uuidv4(),
			partnerId,
			name,
			internalCode: internalCode?.trim() || undefined,
			createdBy: {
				_id: requestContext.userId ?? '',
				displayName:
					`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim(),
				role: requestContext.user?.role ?? requestContext.role,
			},
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		logger.info('Saving partner to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			partnerId: partnerData._id,
			name,
		})

		const createPartnerResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.PARTNERS, data: partnerData },
			Partner,
			requestContext,
		)

		logger.info('Partner created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			partnerId: partnerData._id,
			name,
		})

		await redisCache.del(redisCache.buildPartnerListKey(tenantContext.tenantId))

		return {
			_id: createPartnerResponse._id,
		}
	}

	private async findPartnerDeleteBlocks(tenantId: string, ids: string[]) {
		const uniqueIds = [...new Set(ids.filter(Boolean))]
		const blocked = new Map<string, string>()
		const [actions, sellingInvoices, buyingInvoices] = await Promise.all([
			withTenantScope(
				DailyAction.find({ partnerId: { $in: uniqueIds } })
					.select({ partnerId: 1 })
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
				BuyingInvoice.find({ supplierId: { $in: uniqueIds } })
					.select({ supplierId: 1 })
					.lean(),
				tenantId,
			),
		])

		for (const row of actions) {
			if (row.partnerId && !blocked.has(row.partnerId)) {
				blocked.set(
					row.partnerId,
					'This partner has daily actions and cannot be deleted.',
				)
			}
		}

		for (const row of sellingInvoices) {
			if (row.customerId && !blocked.has(row.customerId)) {
				blocked.set(
					row.customerId,
					'This partner has selling invoices and cannot be deleted.',
				)
			}
		}

		for (const row of buyingInvoices) {
			if (row.supplierId && !blocked.has(row.supplierId)) {
				blocked.set(
					row.supplierId,
					'This partner has buying invoices and cannot be deleted.',
				)
			}
		}

		return blocked
	}

	public async deletePartner(
		partnerId: string,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.partnersDelete])

		const tenantContext = getTenantContext(requestContext)
		const blocked = await this.findPartnerDeleteBlocks(tenantContext.tenantId, [
			partnerId,
		])
		const reason = blocked.get(partnerId)

		if (reason) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				reason,
			)
		}

		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.PARTNERS, id: partnerId },
			requestContext,
			Partner,
		)

		await redisCache.del(redisCache.buildPartnerListKey(tenantContext.tenantId))

		return deleteResponse
	}

	public async bulkDeletePartners(
		partnerIds: string[],
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.partnersDelete])

		const tenantContext = getTenantContext(requestContext)
		const ids = [...new Set(partnerIds.filter(Boolean))]
		const blocked = await this.findPartnerDeleteBlocks(
			tenantContext.tenantId,
			ids,
		)
		const deleted: string[] = []
		const blockedRows: Array<{ partnerId: string; reason: string }> = []

		for (const partnerId of ids) {
			const reason = blocked.get(partnerId)

			if (reason) {
				blockedRows.push({ partnerId, reason })

				continue
			}

			try {
				await this.mongoDbClient.deleteDocument(
					{ collectionName: COLLECTION_NAMES.PARTNERS, id: partnerId },
					requestContext,
					Partner,
				)

				deleted.push(partnerId)
			} catch {
				blockedRows.push({
					partnerId,
					reason: 'Partner could not be deleted.',
				})
			}
		}

		if (deleted.length) {
			await redisCache.del(
				redisCache.buildPartnerListKey(tenantContext.tenantId),
			)
		}

		return { deleted, blocked: blockedRows }
	}
}
