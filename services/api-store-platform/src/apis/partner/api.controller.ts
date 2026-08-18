import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { Partner } from '../../models/Partner'
import { ERROR_CODES } from '../../shared/errorCodes'
import logger, { EntityType } from '../../shared/logger/logger'
import MongodbController from '../../shared/mongodb/mongodbController'
import { withTenantScope } from '../../shared/mongodb/tenantScopedModel'
import { redisCache } from '../../shared/cache/redisCache'
import { COLLECTION_NAMES } from '../../shared/general'
import { getTenantContext } from '../../shared/tenant'
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
	): Promise<DailyActionResponse>
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

	private resolveSyncClientId(clientId?: string): string {
		const trimmed = clientId?.trim()

		if (trimmed && /^[0-9a-f-]{36}$/i.test(trimmed)) {
			return trimmed
		}

		return uuidv4()
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
			relatedActions: filterPartnerRelatedActions(dailyActions.data, partner),
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
		const partner = await this.mongoDbClient.getDocumentByField<PartnerDocument>(
			requestContext,
			COLLECTION_NAMES.PARTNERS,
			Partner,
			{ fieldName: 'partnerId', fieldValue: partnerId },
		)

		if (!partner) {
			return null
		}

		const dailyActions = await this.dailyActions.getDailyActions(requestContext)

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
				relatedActions: filterPartnerRelatedActions(dailyActions.data, partner),
			},
		])

		return mappedPartners[0]
	}

	public async postPartner(
		requestContext: RequestContext,
		requestBody: PartnerRequestBody,
	): Promise<CreatePartnerResponse | null> {
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

		const partnerId = this.resolveSyncClientId(requestBody.partnerId)

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
}
