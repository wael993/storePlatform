import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import express from 'express'
import { isAfter } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'

import { config } from '../config/config'
import {
	BusinessLogicError,
	AuthenticationError,
} from '../middleware/errorHandler'
import { Product } from '../models/Products'
import User, { IUser } from '../models/User'
import RefreshToken, { IRefreshToken } from '../models/RefreshToken'
import Tenant, { ITenant } from '../models/Tenant'
import { Order } from '../models/Order'
import { Invoice } from '../models/Invoice'
import { Inventory } from '../models/Inventory'
import { Report } from '../models/Report'
import { ERROR_CODES } from '../shared/errorCodes'
import logger, { EntityType } from '../shared/logger/logger'
import MongodbController from '../shared/mongodb/mongodbController'
import { withTenantScope } from '../shared/mongodb/tenantScopedModel'

import {
	AddTenantRequestBody,
	AddTenantResponse,
	CreateEntityResponse,
	CreateProductResponse,
	InviteTenantUserRequestBody,
	InviteTenantUserResponse,
	InventoryRequestBody,
	InvoiceRequestBody,
	OrderRequestBody,
	ProductDocument,
	ProductRequestBody,
	ReportRequestBody,
	RequestContext,
	TenantSummary,
	TenantUserSummary,
	UpdateTenantUserRequestBody,
	ProductAPI,
} from '../shared/types'
import { LoginData } from '../shared/types/api'
import ProductsMapper from './mappings/ProductsMapper'
import { getTenantPermissions } from '../shared/Permissions'
import {
	validateEmail,
	validatePasswordStrength,
} from '../utils/authValidation'
import {
	ensureTenantAccess,
	getFrontendResourcesForRole,
	getEmailDomain,
	getTenantContext,
	ensureSuperAdmin,
} from '../shared/tenant'
import { COLLECTION_NAMES } from '../shared/general'
import { redisCache } from '../shared/cache/redisCache'
import { log } from 'console'

type TokenPayload = {
	userId: string
	tenantId: string
	tenantName: string
	role: RequestContext['role']
	tokenVersion: number
}

export default class ProductController {
	constructor(
		private productsMapper: ProductsMapper,
		private mongoDbClient: MongodbController,
	) {}

	private getTenantId(requestContext: RequestContext): string {
		return requestContext.tenantId || 'global'
	}

	private async invalidateProductsCache(
		requestContext: RequestContext,
		productId?: string,
	): Promise<void> {
		const tenantId = this.getTenantId(requestContext)
		const listKeyDeleted = await redisCache.del(
			redisCache.buildProductListKey(tenantId),
		)
		if (listKeyDeleted) {
			logger.debug('Product list cache invalidated')
		}

		if (productId) {
			const detailKeyDeleted = await redisCache.del(
				redisCache.buildProductDetailKey(tenantId, productId),
			)
			if (detailKeyDeleted) {
				logger.debug(`Product ${productId} deleted from cache`)
			}
		}

		const patternDeleted = await redisCache.delByPattern(
			redisCache.buildEntityDetailPatternKey('products', tenantId),
		)
		if (patternDeleted > 0) {
			logger.debug(
				`Product cache pattern invalidated: deleted=${patternDeleted}`,
			)
		}
	}

	private async invalidateEntityCache(
		entity: 'orders' | 'invoices' | 'inventory',
		requestContext: RequestContext,
		id?: string,
	): Promise<void> {
		const tenantId = this.getTenantId(requestContext)
		const listKey =
			entity === 'orders'
				? redisCache.buildOrderListKey(tenantId)
				: entity === 'invoices'
					? redisCache.buildInvoiceListKey(tenantId)
					: redisCache.buildInventoryListKey(tenantId)
		const listKeyDeleted = await redisCache.del(listKey)
		if (listKeyDeleted) {
			logger.debug(`${entity} list cache invalidated`)
		}

		if (id) {
			const detailKey =
				entity === 'orders'
					? redisCache.buildOrderDetailKey(tenantId, id)
					: entity === 'invoices'
						? redisCache.buildInvoiceDetailKey(tenantId, id)
						: redisCache.buildInventoryDetailKey(tenantId, id)
			const detailKeyDeleted = await redisCache.del(detailKey)
			if (detailKeyDeleted) {
				logger.debug(`${entity} ${id} deleted from cache`)
			}
		}

		const patternDeleted = await redisCache.delByPattern(
			redisCache.buildEntityDetailPatternKey(entity, tenantId),
		)
		if (patternDeleted > 0) {
			logger.debug(
				`${entity} cache pattern invalidated: deleted=${patternDeleted}`,
			)
		}
	}

	private hashToken(token: string): string {
		return crypto.createHash('sha256').update(token).digest('hex')
	}

	private normalizeOptionalNumberField(
		value: unknown,
		fieldName: string,
	): number {
		if (typeof value === 'number') {
			if (Number.isNaN(value) || value < 0) {
				throw new BusinessLogicError(
					ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
					`Invalid value for ${fieldName}.`,
				)
			}

			return value
		}

		if (typeof value === 'string') {
			const parsedNumber = Number(value.split(',').join('').trim())

			if (Number.isNaN(parsedNumber) || parsedNumber < 0) {
				throw new BusinessLogicError(
					ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
					`Invalid value for ${fieldName}.`,
				)
			}

			return parsedNumber
		}

		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			`Invalid value for ${fieldName}.`,
		)
	}

	private normalizeOptionalStringField(
		value: unknown,
		fieldName: string,
	): string {
		if (typeof value !== 'string') {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				`Invalid value for ${fieldName}.`,
			)
		}

		const trimmedValue = value.trim()

		if (!trimmedValue) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				`Invalid value for ${fieldName}.`,
			)
		}

		return trimmedValue
	}

	private normalizeProductPatchRequest(
		requestBody: Partial<Omit<ProductDocument, '_id'>>,
	): Partial<Omit<ProductDocument, '_id'>> {
		const normalizedRequestBody = {
			...requestBody,
		} as any

		if (normalizedRequestBody.price?.wholesale !== undefined) {
			normalizedRequestBody.price.wholesale = this.normalizeOptionalNumberField(
				normalizedRequestBody.price.wholesale,
				'price.wholesale',
			)
		}

		if (normalizedRequestBody.price?.discount !== undefined) {
			normalizedRequestBody.price.discount = this.normalizeOptionalNumberField(
				normalizedRequestBody.price.discount,
				'price.discount',
			)
		}

		if (normalizedRequestBody.stock?.quantity !== undefined) {
			normalizedRequestBody.stock.quantity = this.normalizeOptionalNumberField(
				normalizedRequestBody.stock.quantity,
				'stock.quantity',
			)
		}

		if (normalizedRequestBody.stock?.minQuantity !== undefined) {
			normalizedRequestBody.stock.minQuantity =
				this.normalizeOptionalNumberField(
					normalizedRequestBody.stock.minQuantity,
					'stock.minQuantity',
				)
		}

		if (normalizedRequestBody.location?.warehouse !== undefined) {
			normalizedRequestBody.location.warehouse =
				this.normalizeOptionalStringField(
					normalizedRequestBody.location.warehouse,
					'location.warehouse',
				)
		}

		if (normalizedRequestBody.location?.shelf !== undefined) {
			normalizedRequestBody.location.shelf = this.normalizeOptionalStringField(
				normalizedRequestBody.location.shelf,
				'location.shelf',
			)
		}

		return normalizedRequestBody
	}

	private getClientInfo(req: express.Request): {
		ip: string
		userAgent: string
	} {
		const ip =
			(req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
			req.socket.remoteAddress ||
			'unknown'
		const userAgent = req.headers['user-agent'] || 'unknown'
		return { ip, userAgent }
	}

	private generateAccessToken(
		user: {
			_id: any
			role: RequestContext['role']
			tokenVersion: number
			tenantId: string
		},
		tenantName: string,
	): string {
		return jwt.sign(
			{
				userId: user._id.toString(),
				role: user.role,
				tokenVersion: user.tokenVersion,
				tenantId: user.tenantId,
				tenantName,
			},
			config.jwtSecure as string,
			{ expiresIn: '15m' },
		)
	}

	private async createAndStoreRefreshToken(
		userId: string,
		tenantId: string,
		ip: string,
		userAgent: string,
	): Promise<string> {
		const rawToken = crypto.randomBytes(64).toString('hex')
		const tokenHash = this.hashToken(rawToken)
		const expiresAt = new Date(
			Date.now() + config.refreshTokenTTLDays * 24 * 60 * 60 * 1000,
		)

		await RefreshToken.create({
			tenantId,
			userId,
			tokenHash,
			ip,
			userAgent,
			expiresAt,
		})

		return rawToken
	}

	private async requireTenantByEmail(email: string) {
		const domain = getEmailDomain(email)
		const tenant = (await Tenant.findOne({ domain }).lean()) as ITenant | null

		if (!tenant) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
				'No tenant found for this email domain.',
			)
		}

		if (tenant.status !== 'active') {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INACTIVE_TENANT,
				'Tenant is inactive. Contact the platform admin.',
			)
		}

		return tenant
	}

	private mapTenantUser(user: IUser): TenantUserSummary {
		return {
			_id: String(user._id),
			userId: user.userId,
			displayName: user.displayName,
			email: user.email,
			role: user.role,
			firstName: user.user.firstName,
			lastName: user.user.lastName,
			// isInternal: user.user.isInternal,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		}
	}

	private createTemporaryPassword(): string {
		return crypto.randomBytes(12).toString('base64url')
	}

	private createTenantIdFromDomain(domain: string): string {
		return domain.replace(/\./g, '-').toLowerCase()
	}

	private async requireTenantById(tenantId: string): Promise<ITenant> {
		const tenant = (await Tenant.findOne({
			tenantId,
			status: 'active',
		}).lean()) as ITenant | null
		if (!tenant) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Tenant is not active.',
			)
		}

		return tenant
	}

	private async ensureProductsBelongToTenant(
		requestContext: RequestContext,
		items: OrderRequestBody['items'],
	) {
		const tenantContext = getTenantContext(requestContext)
		const requestedProductIds = items.map(item => item.productId)
		const products = await withTenantScope(
			Product.find({ productId: { $in: requestedProductIds } }),
			tenantContext.tenantId,
		).lean()

		if (products.length !== requestedProductIds.length) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Order items must reference products from the same tenant.',
			)
		}
	}

	private async ensureOrderBelongsToTenant(
		requestContext: RequestContext,
		orderId?: string,
	) {
		if (!orderId) {
			return
		}

		const order = await this.mongoDbClient.getDocumentByField(
			requestContext,
			COLLECTION_NAMES.ORDERS,
			Order,
			{
				fieldName: 'orderId',
				fieldValue: orderId,
			},
		)
		if (!order) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Invoice must reference an order from the same tenant.',
			)
		}
	}

	private async ensureInventoryProductBelongsToTenant(
		requestContext: RequestContext,
		productId: string,
	) {
		const product = await this.mongoDbClient.getDocumentByField(
			requestContext,
			COLLECTION_NAMES.PRODUCTS,
			Product,
			{ fieldName: 'productId', fieldValue: productId },
		)
		if (!product) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Inventory must reference a product from the same tenant.',
			)
		}
	}

	public async validateUser(request: any, token: string) {
		const decoded = jwt.verify(
			token,
			config.jwtSecure as string,
		) as TokenPayload

		const user = (await withTenantScope(
			User.findOne({ _id: decoded.userId }),
			decoded.tenantId,
		).lean()) as IUser | null

		if (!user) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
				'User not found.',
			)
		}

		if (decoded.tokenVersion !== user.tokenVersion) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.TOKEN_EXPIRED,
				'Token has been revoked. Please log in again.',
			)
		}

		request.user = {
			userId: String(user._id),
			tenantId: user.tenantId,
			tenantName: decoded.tenantName,
			firstName: user.user.firstName,
			lastName: user.user.lastName,
			email: user.email,
			role: user.role,
			permissions: {},
		}

		return request.user
	}

	public async login(requestBody: LoginData, req: express.Request) {
		const { email: loginEmail, password: loginPassword } = requestBody
		const { ip, userAgent } = this.getClientInfo(req)

		if (!loginEmail || !loginPassword) {
			logger.warn('Login attempt with missing fields', { ip })
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Email and password are required.',
			)
		}

		const emailError = validateEmail(loginEmail)
		if (emailError) {
			logger.warn('Login attempt with invalid email format', {
				ip,
				email: loginEmail,
			})
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.INVALID_EMAIL_FORMAT,
				emailError,
			)
		}

		const passwordError = validatePasswordStrength(loginPassword)
		if (passwordError) {
			logger.warn('Login attempt with weak password', { ip })
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.WEAK_PASSWORD,
				passwordError,
			)
		}

		const tenant = await this.requireTenantByEmail(loginEmail)
		const user = (await withTenantScope(
			User.findOne({ email: loginEmail.toLowerCase() }),
			tenant.tenantId,
		).lean()) as IUser | null

		if (!user) {
			logger.warn('Failed login: user not found', {
				ip,
				email: loginEmail,
				tenantId: tenant.tenantId,
			})
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
				'Invalid email or password.',
			)
		}

		const isValid = await bcrypt.compare(loginPassword, user.password)
		if (!isValid) {
			logger.warn('Failed login: wrong password', {
				ip,
				userId: user._id,
				tenantId: tenant.tenantId,
			})
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
				'Invalid email or password.',
			)
		}

		if (!config.jwtSecure || !config.refreshSecret) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.NO_BEARER_TOKEN,
				'Server configuration error.',
			)
		}

		const accessToken = this.generateAccessToken(user, tenant.name)
		const refreshToken = await this.createAndStoreRefreshToken(
			String(user._id),
			user.tenantId,
			ip,
			userAgent,
		)

		logger.info('Successful login', {
			userId: user._id,
			tenantId: tenant.tenantId,
			ip,
			userAgent,
		})

		return {
			accessToken,
			refreshToken,
			userId: user._id,
			tenantId: user.tenantId,
			tenantName: tenant.name,
			email: user.email,
			role: user.role,
			firstName: user.user.firstName,
			lastName: user.user.lastName,
		}
	}

	public async refresh(req: express.Request) {
		const rawToken = req.cookies?.refreshToken
		const { ip, userAgent } = this.getClientInfo(req)

		if (!rawToken) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_REFRESH_TOKEN,
				'No refresh token provided.',
			)
		}

		const tokenHash = this.hashToken(rawToken)
		const storedToken = (await RefreshToken.findOneAndDelete({
			tokenHash,
		}).lean()) as IRefreshToken | null

		if (!storedToken) {
			logger.warn('Refresh token reuse detected — revoking all sessions', {
				ip,
			})
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_REFRESH_TOKEN,
				'Invalid refresh token. Please log in again.',
			)
		}

		if (isAfter(new Date(), storedToken.expiresAt)) {
			logger.warn('Expired refresh token used', {
				userId: storedToken.userId,
				tenantId: storedToken.tenantId,
				ip,
			})
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.TOKEN_EXPIRED,
				'Refresh token has expired. Please log in again.',
			)
		}

		const user = (await withTenantScope(
			User.findOne({ _id: storedToken.userId }),
			storedToken.tenantId,
		).lean()) as IUser | null

		if (!user) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
				'User not found.',
			)
		}

		const tenant = (await Tenant.findOne({
			tenantId: storedToken.tenantId,
		}).lean()) as ITenant | null
		if (!tenant) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INACTIVE_TENANT,
				'Tenant is inactive. Contact the platform admin.',
			)
		}

		if (tenant.status !== 'active') {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INACTIVE_TENANT,
				'Tenant is inactive. Contact the platform admin.',
			)
		}

		if (storedToken.ip !== ip) {
			logger.warn('IP address changed during refresh', {
				userId: user._id,
				tenantId: user.tenantId,
				previousIp: storedToken.ip,
				newIp: ip,
			})
		}

		const accessToken = this.generateAccessToken(user, tenant.name)
		const newRefreshToken = await this.createAndStoreRefreshToken(
			String(user._id),
			user.tenantId,
			ip,
			userAgent,
		)

		logger.info('Token refreshed', {
			userId: user._id,
			tenantId: user.tenantId,
			ip,
		})

		return {
			accessToken,
			refreshToken: newRefreshToken,
			tenantId: user.tenantId,
			tenantName: tenant.name,
			role: user.role,
		}
	}

	public async logout(req: express.Request) {
		const rawToken = req.cookies?.refreshToken
		if (!rawToken) {
			return
		}

		const tokenHash = this.hashToken(rawToken)
		const deleted = await RefreshToken.findOneAndDelete({ tokenHash }).lean()

		if (deleted) {
			logger.info('User logged out (current device)', {
				userId: deleted.userId,
				tenantId: deleted.tenantId,
			})
		}
	}

	public async logoutAll(req: express.Request) {
		const rawToken = req.cookies?.refreshToken
		if (!rawToken) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_REFRESH_TOKEN,
				'No refresh token provided.',
			)
		}

		const tokenHash = this.hashToken(rawToken)
		const storedToken = await RefreshToken.findOne({ tokenHash }).lean()

		if (!storedToken) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_REFRESH_TOKEN,
				'Invalid refresh token.',
			)
		}

		const result = await RefreshToken.deleteMany({
			userId: storedToken.userId,
			tenantId: storedToken.tenantId,
		})

		logger.info('User logged out from all devices', {
			userId: storedToken.userId,
			tenantId: storedToken.tenantId,
			sessionsRevoked: result.deletedCount,
		})

		return { sessionsRevoked: result.deletedCount }
	}

	public async getProducts(requestContext: RequestContext) {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildProductListKey(tenantId)
		const cachedProducts =
			await redisCache.getJson<ProductRequestBody[]>(cacheKey)
		if (cachedProducts) {
			return cachedProducts
		}

		const products = await this.mongoDbClient.listDocuments<ProductAPI>(
			requestContext,
			'products',
			Product,
			{ name: 1 },
		)

		const mappedProducts = products
			?.map(product => this.productsMapper.mapProduct(product, requestContext))
			.filter(Boolean) as ProductRequestBody[]

		logger.debug(
			`Finally ${mappedProducts.length} products after mappings and filters.`,
			{
				entity: EntityType.PRODUCTS,
			},
		)

		if (config.redis.enabled) {
			logger.debug('Caching product list in Redis', {
				entity: EntityType.CACHE,
				tenantId,
				cacheKey,
			})
			// await redisCache.setJson(cacheKey, mappedProducts)
		}

		return mappedProducts
	}

	public async getProduct(
		productId: string,
		requestContext: RequestContext,
	): Promise<ProductRequestBody | null> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildProductDetailKey(tenantId, productId)
		const cachedProduct = await redisCache.getJson<ProductRequestBody>(cacheKey)
		if (cachedProduct) {
			return cachedProduct
		}

		const product = await this.mongoDbClient.getDocumentByField<ProductAPI>(
			requestContext,
			COLLECTION_NAMES.PRODUCTS,
			Product,
			{ barcode: 'barcode', productId },
		)

		if (!product) {
			return null
		}

		const mappedProduct = this.productsMapper.mapProduct(
			product,
			requestContext,
		)
		await redisCache.setJson(cacheKey, mappedProduct)
		return mappedProduct
	}

	public async postProduct(
		requestBody: ProductRequestBody,
		requestContext: RequestContext,
	): Promise<CreateProductResponse | null> {
		const tenantContext = getTenantContext(requestContext)
		const {
			barcode,
			name,
			price,
			stock,
			description,
			productFactoryCode,
			categoryId,
			brandId,
			images,
			unit,
			tax,
			supplierId,
			location,
			attributes,
			status,
		} = requestBody

		if (!name) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Product name is required',
			)
		}
		if (!barcode) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Product barcode is required',
			)
		}
		if (
			price.wholesale === undefined ||
			price.wholesale === null ||
			price.retailSale === undefined ||
			price.retailSale === null
		) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Product price is required',
			)
		}

		if (stock.quantity === undefined || stock.quantity === null) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Product stock is required',
			)
		}

		const existing = await withTenantScope(
			Product.findOne({ $or: [{ name }, { barcode }] }),
			tenantContext.tenantId,
		).lean()

		if (!!existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Product already exists in this tenant.',
			)
		}

		const now = new Date()
		const createdBy = {
			_id: requestContext.userId as string,
			displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
			role: requestContext.user?.role,
			createdAt: now,
		}

		const productData: ProductDocument = {
			tenantId: tenantContext.tenantId,
			productId: uuidv4(),
			productFactoryCode,
			name,
			barcode,
			categoryId,
			brandId,
			images,
			unit,
			price,
			stock,
			tax,
			supplierId,
			location,
			attributes,
			status: status ?? 'active',
			createdBy,
			createdAt: now,
			description,
		}

		logger.info('Saving product to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			productId: productData.productId,
			name,
		})

		const createProductResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.PRODUCTS, data: productData },
			Product,
			requestContext,
		)

		logger.info('Product created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			productId: productData.productId,
			name,
		})

		await this.invalidateProductsCache(requestContext, productData.productId)

		return { _id: createProductResponse._id }
	}

	public async patchProduct(
		productId: string,
		requestBody: Partial<Omit<ProductDocument, '_id'>>,
		requestContext: RequestContext,
	) {
		const normalizedRequestBody = this.normalizeProductPatchRequest(requestBody)

		const {
			tenantId,
			productId: nextProductId,
			createdAt,
			createdBy,
			...allowedUpdates
		} = normalizedRequestBody as any
		void tenantId
		void nextProductId
		void createdAt
		void createdBy

		if (Object.keys(allowedUpdates).length === 0) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'No valid fields to update.',
			)
		}

		allowedUpdates.updatedBy = {
			_id: requestContext.userId as string,
			displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
			updatedAt: new Date(),
		}

		const updateResponse = await this.mongoDbClient.updateDocument(
			{
				collectionName: COLLECTION_NAMES.PRODUCTS,
				id: productId,
			},
			requestContext,
			Product,
			allowedUpdates,
		)

		await this.invalidateProductsCache(requestContext, productId)
		return updateResponse
	}

	public async deleteProduct(
		productId: string,
		requestContext: RequestContext,
	) {
		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.PRODUCTS, id: productId },
			requestContext,
			Product,
		)

		await this.invalidateProductsCache(requestContext, productId)
		return deleteResponse
	}

	public async getOrders(requestContext: RequestContext) {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildOrderListKey(tenantId)
		const cachedOrders = await redisCache.getJson<any[]>(cacheKey)
		if (cachedOrders) {
			return cachedOrders
		}

		const orders = await this.mongoDbClient.listDocuments(
			requestContext,
			COLLECTION_NAMES.ORDERS,
			Order,
			{
				createdAt: -1,
			},
		)

		await redisCache.setJson(cacheKey, orders)
		return orders
	}

	public async getOrder(orderId: string, requestContext: RequestContext) {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildOrderDetailKey(tenantId, orderId)
		const cachedOrder = await redisCache.getJson<any>(cacheKey)
		if (cachedOrder) {
			return cachedOrder
		}

		const order = await this.mongoDbClient.getDocumentByField(
			requestContext,
			COLLECTION_NAMES.ORDERS,
			Order,
			{ fieldName: 'orderId', fieldValue: orderId },
		)

		if (!order) {
			return null
		}

		await redisCache.setJson(cacheKey, order)
		return order
	}

	public async postOrder(
		requestBody: OrderRequestBody,
		requestContext: RequestContext,
	) {
		await this.ensureProductsBelongToTenant(requestContext, requestBody.items)
		const orderData = {
			orderId: uuidv4(),
			orderNumber: requestBody.orderNumber,
			status: requestBody.status ?? 'draft',
			items: requestBody.items,
			totalAmount: requestBody.totalAmount,
		}
		const createOrderResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.ORDERS, data: orderData },
			Order,
			requestContext,
		)

		await this.invalidateEntityCache(
			'orders',
			requestContext,
			orderData.orderId,
		)

		return { _id: createOrderResponse._id }
	}

	public async patchOrder(
		orderId: string,
		requestBody: Partial<OrderRequestBody>,
		requestContext: RequestContext,
	) {
		if (requestBody.items) {
			await this.ensureProductsBelongToTenant(requestContext, requestBody.items)
		}
		const updateResponse = await this.mongoDbClient.updateDocument(
			{ collectionName: COLLECTION_NAMES.ORDERS, id: orderId },
			requestContext,
			Order,
			requestBody,
		)

		await this.invalidateEntityCache('orders', requestContext, orderId)
		return updateResponse
	}

	public async deleteOrder(orderId: string, requestContext: RequestContext) {
		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.ORDERS, id: orderId },
			requestContext,
			Order,
		)

		await this.invalidateEntityCache('orders', requestContext, orderId)
		return deleteResponse
	}

	public async getInvoices(requestContext: RequestContext) {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildInvoiceListKey(tenantId)
		const cachedInvoices = await redisCache.getJson<any[]>(cacheKey)
		if (cachedInvoices) {
			return cachedInvoices
		}

		const invoices = await this.mongoDbClient.listDocuments(
			requestContext,
			COLLECTION_NAMES.INVOICES,
			Invoice,
			{
				createdAt: -1,
			},
		)

		await redisCache.setJson(cacheKey, invoices)
		return invoices
	}

	public async getInvoice(invoiceId: string, requestContext: RequestContext) {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildInvoiceDetailKey(tenantId, invoiceId)
		const cachedInvoice = await redisCache.getJson<any>(cacheKey)
		if (cachedInvoice) {
			return cachedInvoice
		}

		const invoice = await this.mongoDbClient.getDocumentByField(
			requestContext,
			COLLECTION_NAMES.INVOICES,
			Invoice,
			{ fieldName: 'invoiceId', fieldValue: invoiceId },
		)

		if (!invoice) {
			return null
		}

		await redisCache.setJson(cacheKey, invoice)
		return invoice
	}

	public async postInvoice(
		requestBody: InvoiceRequestBody,
		requestContext: RequestContext,
	) {
		await this.ensureOrderBelongsToTenant(requestContext, requestBody.orderId)
		const invoiceData = {
			invoiceId: uuidv4(),
			invoiceNumber: requestBody.invoiceNumber,
			orderId: requestBody.orderId,
			status: requestBody.status ?? 'pending',
			amount: requestBody.amount,
			issuedAt: requestBody.issuedAt,
		}

		const createInvoiceResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.INVOICES, data: invoiceData },
			Invoice,
			requestContext,
		)

		await this.invalidateEntityCache(
			'invoices',
			requestContext,
			invoiceData.invoiceId,
		)

		return { _id: createInvoiceResponse._id }
	}

	public async patchInvoice(
		invoiceId: string,
		requestBody: Partial<InvoiceRequestBody>,
		requestContext: RequestContext,
	) {
		await this.ensureOrderBelongsToTenant(requestContext, requestBody.orderId)
		const updateResponse = await this.mongoDbClient.updateDocument(
			{ collectionName: COLLECTION_NAMES.INVOICES, id: invoiceId },
			requestContext,
			Invoice,
			requestBody,
		)

		await this.invalidateEntityCache('invoices', requestContext, invoiceId)
		return updateResponse
	}

	public async deleteInvoice(
		invoiceId: string,
		requestContext: RequestContext,
	) {
		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.INVOICES, id: invoiceId },
			requestContext,
			Invoice,
		)

		await this.invalidateEntityCache('invoices', requestContext, invoiceId)
		return deleteResponse
	}

	public async getInventory(requestContext: RequestContext) {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildInventoryListKey(tenantId)
		const cachedInventory = await redisCache.getJson<any[]>(cacheKey)
		if (cachedInventory) {
			return cachedInventory
		}

		const inventory = await this.mongoDbClient.listDocuments(
			requestContext,
			COLLECTION_NAMES.INVENTORY,
			Inventory,
			{
				updatedAt: -1,
			},
		)

		await redisCache.setJson(cacheKey, inventory)
		return inventory
	}

	public async getInventoryItem(
		inventoryId: string,
		requestContext: RequestContext,
	) {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildInventoryDetailKey(tenantId, inventoryId)
		const cachedInventoryItem = await redisCache.getJson<any>(cacheKey)
		if (cachedInventoryItem) {
			return cachedInventoryItem
		}

		const inventoryItem = await this.mongoDbClient.getDocumentByField(
			requestContext,
			COLLECTION_NAMES.INVENTORY,
			Inventory,
			{ fieldName: 'inventoryId', fieldValue: inventoryId },
		)

		if (!inventoryItem) {
			return null
		}

		await redisCache.setJson(cacheKey, inventoryItem)
		return inventoryItem
	}

	public async postInventory(
		requestBody: InventoryRequestBody,
		requestContext: RequestContext,
	) {
		await this.ensureInventoryProductBelongsToTenant(
			requestContext,
			requestBody.productId,
		)
		const inventoryData = {
			inventoryId: uuidv4(),
			productId: requestBody.productId,
			onHand: requestBody.onHand,
			reserved: requestBody.reserved ?? 0,
			reorderLevel: requestBody.reorderLevel ?? 0,
		}
		const createInventoryResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.INVENTORY, data: inventoryData },
			Inventory,
			requestContext,
		)

		await this.invalidateEntityCache(
			'inventory',
			requestContext,
			inventoryData.inventoryId,
		)

		return { _id: createInventoryResponse._id }
	}

	public async patchInventory(
		inventoryId: string,
		requestBody: Partial<InventoryRequestBody>,
		requestContext: RequestContext,
	) {
		if (requestBody.productId) {
			await this.ensureInventoryProductBelongsToTenant(
				requestContext,
				requestBody.productId,
			)
		}
		const updateResponse = await this.mongoDbClient.updateDocument(
			{ collectionName: COLLECTION_NAMES.INVENTORY, id: inventoryId },
			requestContext,
			Inventory,
			requestBody,
		)

		await this.invalidateEntityCache('inventory', requestContext, inventoryId)
		return updateResponse
	}

	public async deleteInventory(
		inventoryId: string,
		requestContext: RequestContext,
	) {
		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.INVENTORY, id: inventoryId },
			requestContext,
			Inventory,
		)

		await this.invalidateEntityCache('inventory', requestContext, inventoryId)
		return deleteResponse
	}

	public async getReports(requestContext: RequestContext) {
		return this.mongoDbClient.listDocuments(
			requestContext,
			COLLECTION_NAMES.REPORTS,
			Report,
			{
				createdAt: -1,
			},
		)
	}

	public async getReport(reportId: string, requestContext: RequestContext) {
		return this.mongoDbClient.getDocumentByField(
			requestContext,
			COLLECTION_NAMES.REPORTS,
			Report,
			{ fieldName: 'reportId', fieldValue: reportId },
		)
	}

	public async postReport(
		requestBody: ReportRequestBody,
		requestContext: RequestContext,
	) {
		const reportData = {
			reportId: uuidv4(),
			name: requestBody.name,
			type: requestBody.type,
			periodStart: requestBody.periodStart,
			periodEnd: requestBody.periodEnd,
			data: requestBody.data,
		}
		const createReportResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.REPORTS, data: reportData },
			Report,
			requestContext,
		)

		return { _id: createReportResponse._id }
	}

	public async patchReport(
		reportId: string,
		requestBody: Partial<ReportRequestBody>,
		requestContext: RequestContext,
	) {
		return this.mongoDbClient.updateDocument(
			{ collectionName: COLLECTION_NAMES.REPORTS, id: reportId },
			requestContext,
			Report,
			requestBody,
		)
	}

	public async deleteReport(reportId: string, requestContext: RequestContext) {
		return this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.REPORTS, id: reportId },
			requestContext,
			Report,
		)
	}

	public async getTenantUsers(
		requestContext: RequestContext,
	): Promise<TenantUserSummary[]> {
		await ensureTenantAccess(requestContext, COLLECTION_NAMES.USERS, 'read')
		const tenantContext = getTenantContext(requestContext)

		const users = (await withTenantScope(
			User.find({}, { password: 0, tokenVersion: 0 }).sort({ createdAt: -1 }),
			tenantContext.tenantId,
		).lean()) as unknown as IUser[]

		return users.map(user => this.mapTenantUser(user))
	}

	public async getUserFrontendResources(
		userId: string,
		requestContext: RequestContext,
	): Promise<{
		frontendResources: Array<{
			path: string
			access: boolean
			allowedActions: string[]
		}>
	}> {
		if (!userId) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'userId is required.',
			)
		}

		const tenantContext = getTenantContext(requestContext)

		if (requestContext.userId && requestContext.userId !== userId) {
			await ensureTenantAccess(requestContext, COLLECTION_NAMES.USERS, 'read')
		}

		const user = (await withTenantScope(
			User.findOne({ _id: userId }, { role: 1 }),
			tenantContext.tenantId,
		).lean()) as Pick<IUser, 'role'> | null

		if (!user) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_READ_ERROR,
				'User not found.',
			)
		}

		const frontendResourceMap = await getFrontendResourcesForRole(user.role)
		const frontendResources = Object.entries(frontendResourceMap || {}).map(
			([path, permission]) => ({
				path,
				access: Boolean(permission?.access),
				allowedActions: permission?.allowedActions || [],
			}),
		)

		return { frontendResources }
	}

	public async inviteTenantUser(
		requestBody: InviteTenantUserRequestBody,
		requestContext: RequestContext,
	): Promise<InviteTenantUserResponse> {
		await ensureTenantAccess(requestContext, COLLECTION_NAMES.USERS, 'create')
		const tenantContext = getTenantContext(requestContext)

		const { firstName, lastName, email, role } = requestBody

		if (!firstName || !lastName || !email || !role) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'firstName, lastName, email and role are required.',
			)
		}

		const emailError = validateEmail(email)
		if (emailError) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.INVALID_EMAIL_FORMAT,
				emailError,
			)
		}

		if (role === 'super_admin') {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'super_admin role can only be created from super-admin controls.',
			)
		}

		const tenant = await this.requireTenantById(tenantContext.tenantId)
		if (getEmailDomain(email) !== tenant.domain) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				`User email domain must match tenant domain ${tenant.domain}.`,
			)
		}

		const existing = (await withTenantScope(
			User.findOne({ email: email.toLowerCase() }),
			tenantContext.tenantId,
		).lean()) as IUser | null

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'User already exists in this tenant.',
			)
		}

		const temporaryPassword = this.createTemporaryPassword()
		const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

		const created = await User.create({
			tenantId: tenantContext.tenantId,
			userId: uuidv4(),
			displayName: `${firstName} ${lastName}`,
			user: {
				firstName,
				lastName,
			},
			email: email.toLowerCase(),
			password: hashedPassword,
			role,
			avatarColorId: Math.floor(Math.random() * 1000000),
		})

		return {
			_id: created.id,
			email: created.email,
			tenantId: tenantContext.tenantId,
			role: created.role,
			temporaryPassword,
		}
	}

	public async patchTenantUser(
		userId: string,
		requestBody: UpdateTenantUserRequestBody,
		requestContext: RequestContext,
	): Promise<TenantUserSummary> {
		const updated = await this.mongoDbClient.updateTenantUser(
			userId,
			requestBody,
			requestContext,
		)

		return this.mapTenantUser(updated)
	}

	public async deleteTenantUser(
		userId: string,
		requestContext: RequestContext,
	): Promise<void> {
		await this.mongoDbClient.deleteTenantUser(userId, requestContext)
	}

	public async changePassword(
		requestBody: { currentPassword: string; newPassword: string },
		requestContext: RequestContext,
	): Promise<void> {
		const { currentPassword, newPassword } = requestBody

		if (!currentPassword || !newPassword) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'currentPassword and newPassword are required.',
			)
		}

		const passwordError = validatePasswordStrength(newPassword)
		if (passwordError) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.WEAK_PASSWORD,
				passwordError,
			)
		}

		const tenantContext = getTenantContext(requestContext)

		const user = (await withTenantScope(
			User.findById(requestContext.userId),
			tenantContext.tenantId,
		).lean()) as IUser | null

		if (!user) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
				'User not found.',
			)
		}

		const isValid = await bcrypt.compare(currentPassword, user.password)
		if (!isValid) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Current password is incorrect.',
			)
		}

		const hashed = await bcrypt.hash(newPassword, 12)

		await withTenantScope(
			User.findByIdAndUpdate(requestContext.userId, {
				$set: { password: hashed, tokenVersion: (user.tokenVersion ?? 0) + 1 },
			}),
			tenantContext.tenantId,
		)

		// Revoke all refresh tokens so the user must log in again on other devices
		await RefreshToken.deleteMany({
			userId: user._id,
			tenantId: tenantContext.tenantId,
		})
	}

	public async getTenants(
		requestContext: RequestContext,
	): Promise<TenantSummary[]> {
		ensureSuperAdmin(requestContext)

		const tenants = (await Tenant.find()
			.sort({ createdAt: -1 })
			.lean()) as ITenant[]

		return tenants.map(tenant => ({
			tenantId: tenant.tenantId,
			name: tenant.name,
			domain: tenant.domain,
			status: tenant.status,
			createdAt: tenant.createdAt,
			updatedAt: tenant.updatedAt,
			permissions: getTenantPermissions(tenant),
		}))
	}

	public async patchTenant(
		tenantId: string,
		requestBody: { tenantName?: string; status?: 'active' | 'inactive' },
		requestContext: RequestContext,
	): Promise<ITenant> {
		ensureSuperAdmin(requestContext)

		const tenant = (await Tenant.findOne({ tenantId }).lean()) as ITenant | null
		if (!tenant) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Tenant not found.',
			)
		}

		const permissions = getTenantPermissions(tenant)
		if (!permissions.canUpdate) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				permissions.reason || 'Tenant cannot be modified.',
			)
		}

		const updates: Record<string, unknown> = {}
		if (requestBody.tenantName?.trim()) {
			const nextTenantName = requestBody.tenantName.trim()
			const conflictingTenant = await Tenant.findOne({
				name: nextTenantName,
				tenantId: { $ne: tenantId },
			}).lean()

			if (conflictingTenant) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Tenant already exists with the same name.',
				)
			}

			updates.name = nextTenantName
		}

		if (requestBody.status) {
			updates.status = requestBody.status
		}

		if (Object.keys(updates).length === 0) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'No fields provided for update.',
			)
		}

		const updated = (await Tenant.findOneAndUpdate(
			{ tenantId },
			{ $set: updates },
			{ new: true, runValidators: true },
		).lean()) as ITenant | null

		if (!updated) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Tenant not found.',
			)
		}

		return updated
	}

	public async deleteTenant(
		tenantId: string,
		requestContext: RequestContext,
	): Promise<void> {
		ensureSuperAdmin(requestContext)

		const tenant = (await Tenant.findOne({ tenantId }).lean()) as ITenant | null
		if (!tenant) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
				'Tenant not found.',
			)
		}

		const permissions = getTenantPermissions(tenant)
		if (!permissions.canDelete) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				permissions.reason || 'Tenant cannot be deleted.',
			)
		}

		await Promise.all([
			User.deleteMany({ tenantId }),
			RefreshToken.deleteMany({ tenantId }),
			Product.deleteMany({ tenantId }),
			Order.deleteMany({ tenantId }),
			Invoice.deleteMany({ tenantId }),
			Inventory.deleteMany({ tenantId }),
			Report.deleteMany({ tenantId }),
		])

		await Tenant.deleteOne({ tenantId })
	}

	public async addTenant(
		requestBody: AddTenantRequestBody,
		requestContext: RequestContext,
	): Promise<AddTenantResponse> {
		ensureSuperAdmin(requestContext)
		const {
			tenantName,
			tenantDomain,
			ownerFirstName,
			ownerLastName,
			ownerEmail,
			ownerPassword,
		} = requestBody

		if (
			!tenantName ||
			!tenantDomain ||
			!ownerFirstName ||
			!ownerLastName ||
			!ownerEmail ||
			!ownerPassword
		) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'All tenant and owner fields are required.',
			)
		}

		const ownerEmailError = validateEmail(ownerEmail)
		if (ownerEmailError) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.INVALID_EMAIL_FORMAT,
				ownerEmailError,
			)
		}

		const normalizedDomain = tenantDomain.trim().toLowerCase()
		const normalizedOwnerEmail = ownerEmail.trim().toLowerCase()
		if (getEmailDomain(normalizedOwnerEmail) !== normalizedDomain) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Owner email domain must match tenant domain.',
			)
		}

		const existingTenant = await Tenant.findOne({
			$or: [{ name: tenantName.trim() }, { domain: normalizedDomain }],
		}).lean()

		if (existingTenant) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Tenant already exists with the same name or domain.',
			)
		}

		const tenantId = this.createTenantIdFromDomain(normalizedDomain)
		const tenantIdConflict = await Tenant.findOne({ tenantId }).lean()
		if (tenantIdConflict) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Tenant ID conflict detected. Choose a different domain.',
			)
		}

		const ownerPasswordError = validatePasswordStrength(ownerPassword)
		if (ownerPasswordError) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.WEAK_PASSWORD,
				ownerPasswordError,
			)
		}

		const hashedPassword = await bcrypt.hash(ownerPassword, 10)

		const tenant = await Tenant.create({
			tenantId,
			name: tenantName.trim(),
			domain: normalizedDomain,
			status: 'active',
		})

		const owner = await User.create({
			tenantId,
			userId: uuidv4(),
			displayName: `${ownerFirstName.trim()} ${ownerLastName.trim()}`,
			user: {
				firstName: ownerFirstName.trim(),
				lastName: ownerLastName.trim(),
				// isInternal: true,
			},
			email: normalizedOwnerEmail,
			password: hashedPassword,
			role: 'owner',
			avatarColorId: Math.floor(Math.random() * 1000000),
		})

		return {
			tenantId: tenant.tenantId,
			tenantName: tenant.name,
			tenantDomain: tenant.domain,
			ownerUserId: owner.userId,
		}
	}
}
