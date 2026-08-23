import { v4 as uuidv4 } from 'uuid'

import { BusinessLogicError } from '../../middleware/errorHandler'
import { Category } from '../../models/Category'
import { Product } from '../../models/Products'
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
	CategoriesResponse,
	CategoryDocument,
	CategoryRequestBody,
	RequestContext,
} from '../../shared/types'

export default class CategoryController {
	constructor(private mongoDbClient: MongodbController) {}

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

	private async invalidateCategoryCache(
		requestContext: RequestContext,
		categoryId: string,
	): Promise<void> {
		const tenantId = this.getTenantId(requestContext)

		await redisCache.del(redisCache.buildCategoryListKey(tenantId))
		await redisCache.del(redisCache.buildProductDetailKey(tenantId, categoryId))

		await redisCache.delByPattern(
			redisCache.buildEntityDetailPatternKey('categories', tenantId),
		)
	}

	public async getCategories(
		requestContext: RequestContext,
	): Promise<CategoriesResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildCategoryListKey(tenantId)
		const cachedCategories =
			await redisCache.getJson<CategoriesResponse>(cacheKey)

		if (cachedCategories) {
			return cachedCategories
		}

		const categories = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.CATEGORIES,
			model: Category,
			sort: { name: 1 },
		})

		const data = categories.documents.map((category: CategoryDocument) => ({
			categoryId: category.categoryId,
			name: category.name,
			description: category.description,
			parentCategoryId: category.parentCategoryId,
			createdAt: category.createdAt?.toISOString?.(),
			updatedAt: category.updatedAt?.toISOString?.(),
			createdBy: category.createdBy,
			updatedBy: category.updatedBy,
		}))

		const response: CategoriesResponse = {
			data,
			totalCount: data.length,
		}

		await redisCache.setJson(cacheKey, response)

		return response
	}

	public async getCategory(
		categoryId: string,
		requestContext: RequestContext,
	): Promise<CategoryDocument | null> {
		return this.mongoDbClient.getDocumentByField<CategoryDocument>(
			requestContext,
			COLLECTION_NAMES.CATEGORIES,
			Category,
			{ fieldName: 'categoryId', fieldValue: categoryId },
		)
	}

	public async postCategory(
		requestBody: CategoryRequestBody,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.categoriesAdd])
		const tenantContext = getTenantContext(requestContext)

		if (!requestBody.name?.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Category name is required',
			)
		}

		const existing = await withTenantScope(
			Category.findOne({
				name: new RegExp(`^${this.escapeRegex(requestBody.name)}$`, 'i'),
			}),
			tenantContext.tenantId,
		).lean()

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Category already exists in this tenant.',
			)
		}

		const categoryId = this.resolveSyncClientId(requestBody.categoryId)

		const existingById = await withTenantScope(
			Category.findOne({ categoryId }).lean(),
			tenantContext.tenantId,
		)

		if (existingById) {
			return {
				_id: String(existingById._id),
				categoryId: existingById.categoryId,
			}
		}

		const categoryData: Record<string, unknown> = {
			categoryId,
			name: requestBody.name.trim(),
			description: requestBody.description?.trim(),
			parentCategoryId: requestBody.parentCategoryId,
		}

		logger.info('saving category to database.....', {
			entity: EntityType.MONGODB,
			categoryId,
			name: categoryData.name,
		})

		await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.CATEGORIES, data: categoryData },
			Category,
			requestContext,
		)

		logger.info('category created successfully.....', {
			entity: EntityType.MONGODB,
			categoryId,
			name: categoryData.name,
		})

		await this.invalidateCategoryCache(requestContext, categoryId)

		return { _id: categoryId }
	}

	private async findCategoryDeleteBlocks(tenantId: string, ids: string[]) {
		const uniqueIds = [...new Set(ids.filter(Boolean))]
		const blocked = new Map<string, string>()
		const products = await withTenantScope(
			Product.find({ categoryId: { $in: uniqueIds } })
				.select({ categoryId: 1 })
				.lean(),
			tenantId,
		)

		for (const row of products) {
			if (row.categoryId && !blocked.has(row.categoryId)) {
				blocked.set(
					row.categoryId,
					'This category has products and cannot be deleted.',
				)
			}
		}

		return blocked
	}

	public async deleteCategory(
		categoryId: string,
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.categoriesDelete])

		const tenantContext = getTenantContext(requestContext)
		const blocked = await this.findCategoryDeleteBlocks(
			tenantContext.tenantId,
			[categoryId],
		)
		const reason = blocked.get(categoryId)

		if (reason) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				reason,
			)
		}

		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.CATEGORIES, id: categoryId },
			requestContext,
			Category,
		)

		await this.invalidateCategoryCache(requestContext, categoryId)

		return deleteResponse
	}

	public async bulkDeleteCategories(
		categoryIds: string[],
		requestContext: RequestContext,
	) {
		await ensureSeeIds(requestContext, [SEE.categoriesDelete])

		const tenantContext = getTenantContext(requestContext)
		const ids = [...new Set(categoryIds.filter(Boolean))]
		const blocked = await this.findCategoryDeleteBlocks(
			tenantContext.tenantId,
			ids,
		)
		const deleted: string[] = []
		const blockedRows: Array<{ categoryId: string; reason: string }> = []

		for (const categoryId of ids) {
			const reason = blocked.get(categoryId)

			if (reason) {
				blockedRows.push({ categoryId, reason })

				continue
			}

			try {
				await this.mongoDbClient.deleteDocument(
					{ collectionName: COLLECTION_NAMES.CATEGORIES, id: categoryId },
					requestContext,
					Category,
				)

				deleted.push(categoryId)
			} catch {
				blockedRows.push({
					categoryId,
					reason: 'Category could not be deleted.',
				})
			}
		}

		if (deleted.length) {
			for (const categoryId of deleted) {
				await this.invalidateCategoryCache(requestContext, categoryId)
			}
		}

		return { deleted, blocked: blockedRows }
	}
}
