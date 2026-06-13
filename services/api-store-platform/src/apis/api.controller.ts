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
import { Supplier } from '../models/Supplier'
import { Customer } from '../models/Customer'
import { Currency } from '../models/Currency'
import { Unit } from '../models/Unit'
import User, { IUser } from '../models/User'
import RefreshToken, { IRefreshToken } from '../models/RefreshToken'
import Tenant, { ITenant } from '../models/Tenant'
import UserSettings, { IUserSettings } from '../models/UserSettings'
import { Order } from '../models/Order'
import { Invoice } from '../models/Invoice'
import { Inventory } from '../models/Inventory'
import { Report } from '../models/Report'
import { DailyAction, ActionType } from '../models/DailyAction'
import { ERROR_CODES } from '../shared/errorCodes'
import logger, { EntityType } from '../shared/logger/logger'
import MongodbController from '../shared/mongodb/mongodbController'
import { withTenantScope } from '../shared/mongodb/tenantScopedModel'
import { mapCustomers, mapSuppliers } from './mappings/mapper'
import {
	AddTenantRequestBody,
	AddTenantResponse,
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
	SupplierRequestBody,
	CreateSupplierResponse,
	SupplierDocument,
	CustomerRequestBody,
	CreateCustomerResponse,
	CustomerDocument,
	CurrencyRequestBody,
	CurrencyDocument,
	CreateCurrencyResponse,
	UnitRequestBody,
	UnitDocument,
	CreateUnitResponse,
} from '../shared/types'
import {
	CreateDailyActionResponse,
	CurrenciesResponse,
	CustomerDailyAction,
	CustomersResponse,
	DailyActionRequestBody,
	DailyActionResponse,
	EntryType,
	LoginData,
	SuppliersResponse,
	UnitsResponse,
} from '../shared/types/api'
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
	TenantRole,
} from '../shared/tenant'
import { COLLECTION_NAMES } from '../shared/general'
import { redisCache } from '../shared/cache/redisCache'

type TokenPayload = {
	userId: string
	tenantId: string
	tenantName: string
	role: RequestContext['role']
	tokenVersion: number
}

type ProductFilterQuery = {
	searchText?: string
	supplier?: string[]
	brand?: string[]
	state?: string[]
	category?: string[]
}

type DailyActionFilterQuery = {
	searchText?: string
	entryType?: string[]
	productName?: string[]
	supplier?: string[]
	customer?: string[]
}

type ProductFilterValueOption = {
	value: string
	label: string
}

type ProductFilterValuesResponse = {
	supplier: ProductFilterValueOption[]
	brand: ProductFilterValueOption[]
	state: ProductFilterValueOption[]
	category: ProductFilterValueOption[]
}

type DailyActionFilterValuesResponse = {
	entryType: ProductFilterValueOption[]
	productName: ProductFilterValueOption[]
	supplier: ProductFilterValueOption[]
	customer: ProductFilterValueOption[]
}

type ProductFilterValueSource = {
	supplierId?: string
	supplierName?: string
	brandId?: string
	brandName?: string
	categoryId?: string
	categoryName?: string
	status?: string
}

type DailyActionFilterValueSource = {
	entryType?: string
	productId?: string
	productName?: string
	supplierId?: string
	supplierName?: string
	customerId?: string
	customerName?: string
}

type BudgetOverviewResponse = {
	payments: string
	purchase: string
	currency?: string
	balance: string
}

type BudgetOverviewEntityType = 'customer' | 'supplier'

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

	private escapeRegex(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	}

	private buildCaseInsensitiveRegexList(values?: string[]): RegExp[] {
		if (!values || values.length === 0) {
			return []
		}

		return values
			.map(value => value.trim())
			.filter(Boolean)
			.map(value => new RegExp(`^${this.escapeRegex(value)}$`, 'i'))
	}

	private normalizeFilterOptionValue(value?: string): string | undefined {
		const normalizedValue = value?.trim()
		return normalizedValue ? normalizedValue : undefined
	}

	private addFilterOption(
		optionsMap: Map<string, ProductFilterValueOption>,
		value?: string,
		label?: string,
	): void {
		const normalizedValue = this.normalizeFilterOptionValue(value)
		if (!normalizedValue) {
			return
		}

		const normalizedLabel =
			this.normalizeFilterOptionValue(label) ?? normalizedValue
		const optionKey = normalizedValue.toLowerCase()

		if (!optionsMap.has(optionKey)) {
			optionsMap.set(optionKey, {
				value: normalizedValue,
				label: normalizedLabel,
			})
		}
	}

	private buildSortedFilterOptions(
		optionsMap: Map<string, ProductFilterValueOption>,
	): ProductFilterValueOption[] {
		return Array.from(optionsMap.values()).sort((a, b) =>
			a.label.localeCompare(b.label),
		)
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
			Product.find({ _id: { $in: requestedProductIds } }),
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

	public async getProducts(
		requestContext: RequestContext,
		filters: ProductFilterQuery = {},
		pagination?: { limit?: number; offset?: number },
	) {
		const tenantId = this.getTenantId(requestContext)
		const limit = pagination?.limit || 20
		const offset = pagination?.offset || 0

		const hasFilters =
			Boolean(filters.searchText?.trim()) ||
			Boolean(filters.supplier?.length) ||
			Boolean(filters.brand?.length) ||
			Boolean(filters.state?.length) ||
			Boolean(filters.category?.length)
		const cacheKey = redisCache.buildProductListKey(tenantId)

		if (!hasFilters) {
			const cachedProducts =
				await redisCache.getJson<ProductRequestBody[]>(cacheKey)
			if (cachedProducts) {
				const paginatedCached = cachedProducts.slice(offset, offset + limit)
				return {
					products: paginatedCached,
					totalCount: cachedProducts.length,
				}
			}
		}

		const searchText = filters.searchText?.trim()
		const supplierRegexList = this.buildCaseInsensitiveRegexList(
			filters.supplier,
		)
		const brandRegexList = this.buildCaseInsensitiveRegexList(filters.brand)
		const categoryRegexList = this.buildCaseInsensitiveRegexList(
			filters.category,
		)
		const stateFilterSet = new Set(
			(filters.state ?? []).map(state => state.trim()),
		)

		const productQueryClauses: Record<string, unknown>[] = []

		if (searchText) {
			const searchRegex = new RegExp(this.escapeRegex(searchText), 'i')
			productQueryClauses.push({
				$or: [
					{ name: searchRegex },
					{ id: searchRegex },
					{ productId: searchRegex },
					{ barcode: searchRegex },
				],
			})
		}

		if (supplierRegexList.length > 0) {
			productQueryClauses.push({
				$or: [
					{ supplierId: { $in: supplierRegexList } },
					{ supplierName: { $in: supplierRegexList } },
				],
			})
		}

		if (brandRegexList.length > 0) {
			productQueryClauses.push({
				$or: [
					{ brandId: { $in: brandRegexList } },
					{ brandName: { $in: brandRegexList } },
				],
			})
		}

		if (categoryRegexList.length > 0) {
			productQueryClauses.push({
				$or: [
					{ categoryId: { $in: categoryRegexList } },
					{ categoryName: { $in: categoryRegexList } },
				],
			})
		}

		const mongoQuery =
			productQueryClauses.length > 0 ? { $and: productQueryClauses } : {}

		const products = await withTenantScope(
			Product.find(mongoQuery).sort({ name: 1 }),
			tenantId,
		).lean<ProductAPI[]>()

		const mappedProducts = products
			?.map(product => this.productsMapper.mapProduct(product, requestContext))
			.filter(Boolean) as ProductRequestBody[]

		const filteredProductsByState =
			stateFilterSet.size > 0
				? mappedProducts.filter(product => stateFilterSet.has(product.state))
				: mappedProducts

		const totalCount = filteredProductsByState.length
		const paginatedProducts = filteredProductsByState.slice(
			offset,
			offset + limit,
		)

		logger.debug(
			`Finally ${paginatedProducts.length} products (of ${totalCount} total) after mappings and filters. Page: offset=${offset}, limit=${limit}`,
			{
				entity: EntityType.PRODUCTS,
			},
		)

		if (config.redis.enabled && !hasFilters) {
			logger.debug('Caching product list in Redis', {
				entity: EntityType.CACHE,
				tenantId,
				cacheKey,
			})
			// await redisCache.setJson(cacheKey, mappedProducts)
		}

		return {
			products: paginatedProducts,
			totalCount,
		}
	}

	public async getProductFilterValues(
		requestContext: RequestContext,
	): Promise<ProductFilterValuesResponse> {
		const tenantId = this.getTenantId(requestContext)
		const canAccessSupplierFilter =
			requestContext.role === 'owner' || requestContext.role === 'admin'

		const products = await withTenantScope(
			Product.find({})
				.select(
					'supplierId supplierName brandId brandName categoryId categoryName status',
				)
				.lean<ProductFilterValueSource[]>(),
			tenantId,
		)

		const supplierMap = new Map<string, ProductFilterValueOption>()
		const brandMap = new Map<string, ProductFilterValueOption>()
		const categoryMap = new Map<string, ProductFilterValueOption>()
		const stateMap = new Map<string, ProductFilterValueOption>()

		for (const product of products) {
			if (canAccessSupplierFilter) {
				this.addFilterOption(
					supplierMap,
					product.supplierId || product.supplierName,
					product.supplierName || product.supplierId,
				)
			}
			this.addFilterOption(
				brandMap,
				product.brandId || product.brandName,
				product.brandName || product.brandId,
			)
			this.addFilterOption(
				categoryMap,
				product.categoryId || product.categoryName,
				product.categoryName || product.categoryId,
			)
			this.addFilterOption(stateMap, product.status, product.status)
		}

		return {
			supplier: this.buildSortedFilterOptions(supplierMap),
			brand: this.buildSortedFilterOptions(brandMap),
			state: this.buildSortedFilterOptions(stateMap),
			category: this.buildSortedFilterOptions(categoryMap),
		}
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
			{ barcode: 'barcode', _id: productId },
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
			internalCode,
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

		const productId = uuidv4()
		const productData: ProductDocument = {
			tenantId: tenantContext.tenantId,
			_id: productId,
			productId,
			internalCode,
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
			createdBy: {
				_id: requestContext.userId as string,
				displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
				role: requestContext.user?.role as TenantRole,
			},
			createdAt: new Date(),
			description,
		}

		logger.info('Saving product to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			productId: productData._id,
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
			productId: productData._id,
			name,
		})

		await this.invalidateProductsCache(requestContext, productData._id)

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

		const orders = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.ORDERS,
			model: Order,
			sort: { createdAt: 'desc' },
		})

		await redisCache.setJson(cacheKey, orders.documents)
		return orders.documents
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

		const invoices = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.INVOICES,
			model: Invoice,
			sort: { createdAt: 'desc' },
		})

		await redisCache.setJson(cacheKey, invoices.documents)
		return invoices.documents
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

		const inventory = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.INVENTORY,
			model: Inventory,
			sort: { createdAt: 'desc' },
		})

		await redisCache.setJson(cacheKey, inventory)
		return inventory.documents
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
		const reports = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.REPORTS,
			model: Report,
			sort: { createdAt: 'desc' },
		})

		return reports.documents
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

	public async getDailyActions(
		requestContext: RequestContext,
		filters: DailyActionFilterQuery = {},
	): Promise<DailyActionResponse> {
		const tenantId = this.getTenantId(requestContext)
		const hasFilters =
			Boolean(filters.searchText?.trim()) ||
			Boolean(filters.entryType?.length) ||
			Boolean(filters.productName?.length) ||
			Boolean(filters.supplier?.length) ||
			Boolean(filters.customer?.length)
		const cacheKey = `dailyActions:${tenantId}`

		if (!hasFilters) {
			const cachedDailyActions =
				await redisCache.getJson<DailyActionResponse>(cacheKey)
			if (cachedDailyActions) {
				return cachedDailyActions
			}
		}

		const searchText = filters.searchText?.trim()
		const entryTypeRegexList = this.buildCaseInsensitiveRegexList(
			filters.entryType,
		)
		const productNameRegexList = this.buildCaseInsensitiveRegexList(
			filters.productName,
		)
		const supplierRegexList = this.buildCaseInsensitiveRegexList(
			filters.supplier,
		)
		const customerRegexList = this.buildCaseInsensitiveRegexList(
			filters.customer,
		)
		const dailyActionQueryClauses: Record<string, unknown>[] = []

		if (searchText) {
			const searchRegex = new RegExp(this.escapeRegex(searchText), 'i')
			dailyActionQueryClauses.push({
				$or: [
					{ actionId: searchRegex },
					{ entryType: searchRegex },
					{ productId: searchRegex },
					{ productName: searchRegex },
					{ supplierId: searchRegex },
					{ supplierName: searchRegex },
					{ customerId: searchRegex },
					{ customerName: searchRegex },
					{ invoiceNumber: searchRegex },
				],
			})
		}

		if (entryTypeRegexList.length > 0) {
			dailyActionQueryClauses.push({
				entryType: { $in: entryTypeRegexList },
			})
		}

		if (productNameRegexList.length > 0) {
			dailyActionQueryClauses.push({
				$or: [
					{ productId: { $in: productNameRegexList } },
					{ productName: { $in: productNameRegexList } },
				],
			})
		}

		if (supplierRegexList.length > 0) {
			dailyActionQueryClauses.push({
				$or: [
					{ supplierId: { $in: supplierRegexList } },
					{ supplierName: { $in: supplierRegexList } },
				],
			})
		}

		if (customerRegexList.length > 0) {
			dailyActionQueryClauses.push({
				$or: [
					{ customerId: { $in: customerRegexList } },
					{ customerName: { $in: customerRegexList } },
				],
			})
		}

		const mongoQuery =
			dailyActionQueryClauses.length > 0
				? { $and: dailyActionQueryClauses }
				: {}
		const dailyActions = await withTenantScope(
			DailyAction.find(mongoQuery).sort({ createdAt: 'desc' }),
			tenantId,
		).lean<DailyActionResponse['data']>()

		if (!hasFilters) {
			await redisCache.setJson(cacheKey, {
				data: dailyActions,
				totalCount: dailyActions.length,
			})
		}
		return {
			data: dailyActions,
			totalCount: dailyActions.length,
		}
	}

	public async getDailyActionFilterValues(
		requestContext: RequestContext,
	): Promise<DailyActionFilterValuesResponse> {
		const tenantId = this.getTenantId(requestContext)
		const dailyActions = await withTenantScope(
			DailyAction.find({})
				.select(
					'entryType productId productName supplierId supplierName customerId customerName',
				)
				.lean<DailyActionFilterValueSource[]>(),
			tenantId,
		)

		const entryTypeMap = new Map<string, ProductFilterValueOption>()
		const productNameMap = new Map<string, ProductFilterValueOption>()
		const supplierMap = new Map<string, ProductFilterValueOption>()
		const customerMap = new Map<string, ProductFilterValueOption>()

		for (const dailyAction of dailyActions) {
			this.addFilterOption(
				entryTypeMap,
				dailyAction.entryType,
				dailyAction.entryType,
			)
			this.addFilterOption(
				productNameMap,
				dailyAction.productName || dailyAction.productId,
				dailyAction.productName || dailyAction.productId,
			)
			this.addFilterOption(
				supplierMap,
				dailyAction.supplierId || dailyAction.supplierName,
				dailyAction.supplierName || dailyAction.supplierId,
			)
			this.addFilterOption(
				customerMap,
				dailyAction.customerId || dailyAction.customerName,
				dailyAction.customerName || dailyAction.customerId,
			)
		}

		return {
			entryType: this.buildSortedFilterOptions(entryTypeMap),
			productName: this.buildSortedFilterOptions(productNameMap),
			supplier: this.buildSortedFilterOptions(supplierMap),
			customer: this.buildSortedFilterOptions(customerMap),
		}
	}

	public async getDailyAction(
		actionId: string,
		requestContext: RequestContext,
	) {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = `dailyAction:${tenantId}:${actionId}`
		const cachedAction = await redisCache.getJson<DailyActionResponse>(cacheKey)
		if (cachedAction) {
			return cachedAction
		}

		const dailyAction = await this.mongoDbClient.getDocumentByField(
			requestContext,
			COLLECTION_NAMES.DAILY_ACTIONS,
			DailyAction,
			{ fieldName: 'actionId', fieldValue: actionId },
		)

		if (!dailyAction) {
			return null
		}

		await redisCache.setJson(cacheKey, { data: [dailyAction], totalCount: 1 })
		return { data: [dailyAction], totalCount: 1 }
	}

	public async getBudgetOverview(
		entityType: BudgetOverviewEntityType,
		entityId: string,
		requestContext: RequestContext,
	): Promise<BudgetOverviewResponse | null> {
		const identifiers = await this.getBudgetOverviewIdentifiers(
			entityType,
			entityId,
			requestContext,
		)

		if (!identifiers) {
			return null
		}

		const dailyActions = await this.getDailyActions(requestContext)
		const relevantActions = dailyActions.data.filter(action => {
			if (entityType === 'customer') {
				return action.customerId && identifiers.has(action.customerId)
			}

			return action.supplierId && identifiers.has(action.supplierId)
		})

		const purchaseEntryType =
			entityType === 'customer' ? 'SELLING_ENTRY' : 'BUYING_ENTRY'
		const paymentEntryType =
			entityType === 'customer' ? 'RECEIPT_ENTRY' : 'PAYMENT_ENTRY'

		const purchase = this.sumActionAmounts(relevantActions, purchaseEntryType)
		const payments = this.sumActionAmounts(relevantActions, paymentEntryType)
		const currency =
			relevantActions.find(action => action.currencyName || action.currencyId)
				?.currencyName ??
			relevantActions.find(action => action.currencyId)?.currencyId

		return {
			payments: payments.toFixed(2),
			purchase: purchase.toFixed(2),
			currency,
			balance: (purchase - payments).toFixed(2),
		}
	}

	public async postDailyAction(
		requestBody: DailyActionRequestBody,
		requestContext: RequestContext,
	): Promise<CreateDailyActionResponse> {
		const createdAt = new Date()
		const createdBy = {
			_id: requestContext.userId ?? '',
			displayName:
				`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim(),
			role: requestContext.user?.role,
		}
		const dailyActionData = {
			actionId: uuidv4(),
			entryType: requestBody.entryType,
			productId: requestBody.productId,
			invoiceNumber: requestBody.invoiceNumber,
			invoiceDate: requestBody.invoiceDate
				? new Date(requestBody.invoiceDate)
				: createdAt,
			productName: requestBody.productName,
			supplierId: requestBody.supplierId,
			supplierName: requestBody.supplierName,
			customerId: requestBody.customerId,
			customerName: requestBody.customerName,
			currencyId: requestBody.currencyId,
			currencyName: requestBody.currencyName,
			unitId: requestBody.unitId,
			unitName: requestBody.unitName,
			weight: requestBody.weight,
			singleUnitPrice: requestBody.singleUnitPrice,
			totalPrice: requestBody.totalPrice,
			createdBy,
			createdAt,
		}

		const createDailyActionResponse = await this.mongoDbClient.createDocument(
			{
				collectionName: COLLECTION_NAMES.DAILY_ACTIONS,
				data: dailyActionData,
			},
			DailyAction,
			requestContext,
		)

		await this.invalidateDailyActionsCache(
			requestContext,
			dailyActionData.actionId,
		)

		return { _id: createDailyActionResponse._id }
	}

	public async patchDailyAction(
		actionId: string,
		requestBody: Partial<{
			type: ActionType
			salesArea: string
			locationCustomer: string
			shopTerminal: string
			promotionSpace: string
			amount: number
			description: string
			reference: string
			invoiceNumber: string
		}>,
		requestContext: RequestContext,
	) {
		const updateResponse = await this.mongoDbClient.updateDocument(
			{ collectionName: COLLECTION_NAMES.DAILY_ACTIONS, id: actionId },
			requestContext,
			DailyAction,
			requestBody,
		)

		await this.invalidateDailyActionsCache(requestContext, actionId)
		return updateResponse
	}

	public async deleteDailyAction(
		actionId: string,
		requestContext: RequestContext,
	) {
		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.DAILY_ACTIONS, id: actionId },
			requestContext,
			DailyAction,
		)

		await this.invalidateDailyActionsCache(requestContext, actionId)
		return deleteResponse
	}

	private async invalidateDailyActionsCache(
		requestContext: RequestContext,
		actionId?: string,
	): Promise<void> {
		const tenantId = this.getTenantId(requestContext)
		const listKey = `dailyActions:${tenantId}`
		const listKeyDeleted = await redisCache.del(listKey)
		if (listKeyDeleted) {
			logger.debug('Daily actions list cache invalidated')
		}

		await Promise.all([
			redisCache.del(redisCache.buildCustomerListKey(tenantId)),
			redisCache.del(redisCache.buildSupplierListKey(tenantId)),
		])

		if (actionId) {
			const detailKey = `dailyAction:${tenantId}:${actionId}`
			const detailKeyDeleted = await redisCache.del(detailKey)
			if (detailKeyDeleted) {
				logger.debug(`Daily action ${actionId} deleted from cache`)
			}
		}
	}

	private async getBudgetOverviewIdentifiers(
		entityType: BudgetOverviewEntityType,
		entityId: string,
		requestContext: RequestContext,
	): Promise<Set<string> | null> {
		if (entityType === 'customer') {
			let customer =
				await this.mongoDbClient.getDocumentByField<CustomerDocument>(
					requestContext,
					COLLECTION_NAMES.CUSTOMERS,
					Customer,
					{ fieldName: 'customerId', fieldValue: entityId },
				)

			if (!customer) {
				customer =
					await this.mongoDbClient.getDocumentByField<CustomerDocument>(
						requestContext,
						COLLECTION_NAMES.CUSTOMERS,
						Customer,
						{ fieldName: 'internalCode', fieldValue: entityId },
					)
			}

			if (!customer) {
				return null
			}

			return new Set(
				[customer.customerId, customer.internalCode].filter(
					(value): value is string => Boolean(value),
				),
			)
		}

		let supplier =
			await this.mongoDbClient.getDocumentByField<SupplierDocument>(
				requestContext,
				COLLECTION_NAMES.SUPPLIERS,
				Supplier,
				{ fieldName: 'supplierId', fieldValue: entityId },
			)

		if (!supplier) {
			supplier = await this.mongoDbClient.getDocumentByField<SupplierDocument>(
				requestContext,
				COLLECTION_NAMES.SUPPLIERS,
				Supplier,
				{ fieldName: 'internalCode', fieldValue: entityId },
			)
		}

		if (!supplier) {
			return null
		}

		return new Set(
			[supplier.supplierId, supplier.internalCode].filter(
				(value): value is string => Boolean(value),
			),
		)
	}

	private parseActionAmount(
		action: DailyActionResponse['data'][number],
	): number {
		const rawAmount = action.totalPrice ?? action.singleUnitPrice ?? '0'
		return parseFloat(rawAmount.replace(/,/g, '')) || 0
	}

	private sumActionAmounts(
		actions: DailyActionResponse['data'],
		entryType: EntryType,
	): number {
		return actions.reduce((sum, action) => {
			if (action.entryType !== entryType) {
				return sum
			}

			return sum + this.parseActionAmount(action)
		}, 0)
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

	public async getUserSettings(
		request: any,
		response: express.Response,
	): Promise<void> {
		try {
			const { tenantId, userId } = request.user

			if (!tenantId || !userId) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Missing tenantId or userId',
				)
			}

			let userSettings = await UserSettings.findOne({
				tenantId,
				userId,
			})

			if (!userSettings) {
				userSettings = await UserSettings.create({
					tenantId,
					userId,
					productsPerPage: 20,
					displayLanguage: 'en',
				})
			}

			response.status(200).json(userSettings)
		} catch (error: any) {
			logger.error('Error fetching user settings', error)
			throw error
		}
	}

	public async patchUserSettings(
		request: any,
		response: express.Response,
	): Promise<void> {
		try {
			const { tenantId, userId } = request.user
			const { productsPerPage, displayLanguage } = request.body

			if (!tenantId || !userId) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'Missing tenantId or userId',
				)
			}

			const updateData: Partial<IUserSettings> = {}

			if (productsPerPage !== undefined) {
				updateData.productsPerPage = productsPerPage
			}

			if (displayLanguage !== undefined) {
				updateData.displayLanguage = displayLanguage
			}

			const userSettings = await UserSettings.findOneAndUpdate(
				{ tenantId, userId },
				updateData,
				{ new: true, upsert: true },
			)

			response.status(200).json(userSettings)
		} catch (error: any) {
			logger.error('Error updating user settings', error)
			throw error
		}
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

		const dailyActions = await this.getDailyActions(requestContext)
		const data = suppliers.documents.map((supplier: SupplierDocument) => ({
			supplierId: supplier.supplierId,
			name: supplier.name,
			internalCode: supplier.internalCode,
			createdAt: supplier.createdAt?.toISOString(),
			updatedAt: supplier.updatedAt?.toISOString(),
			createdBy: supplier.createdBy as any,
			updatedBy: supplier.updatedBy
				? {
						...supplier.updatedBy,
						updatedAt: supplier.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
			actions: dailyActions.data.filter(
				action =>
					action.supplierId === supplier.supplierId ||
					action.supplierId === supplier.internalCode,
			),
		}))

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

		const dailyActions = await this.getDailyActions(requestContext)
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
				createdBy: supplier.createdBy as any,
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

		if (!!existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'supplier already exists in this tenant.',
			)
		}

		const supplierData: SupplierDocument = {
			tenantId: tenantContext.tenantId,
			_id: uuidv4(),
			supplierId: uuidv4(),
			name: name,
			internalCode: internalCode?.trim() || undefined,
			createdBy: {
				_id: requestContext.userId as string,
				displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
				role: requestContext.user?.role as TenantRole,
			},
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		logger.info('Saving supplier to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			supplierId: supplierData._id,
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
			supplierId: supplierData._id,
			name,
		})

		//await this.invalidateSuppliersCache(requestContext, supplierData._id)

		return {
			_id: createSupplierResponse._id,
		}
	}

	public async getCustomers(
		requestContext: RequestContext,
	): Promise<CustomersResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildCustomerListKey(tenantId)
		const cachedCustomers =
			await redisCache.getJson<CustomersResponse>(cacheKey)
		if (cachedCustomers) {
			return cachedCustomers
		}
		const customers = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.CUSTOMERS,
			model: Customer,
			sort: { createdAt: 'desc' },
		})
		const dailyActions = await this.getDailyActions(requestContext)

		// Group actions by customerId
		const actionsByCustomer = new Map<string, CustomerDailyAction[]>()

		for (const action of dailyActions.data) {
			if (action.entryType === 'BUYING_ENTRY') continue
			const customerActions =
				actionsByCustomer.get(action.customerId ?? '') ?? []

			customerActions.push(action)

			actionsByCustomer.set(action.customerId ?? '', customerActions)
		}

		const data = customers.documents.map(customer => {
			return {
				...customer,
				actions: actionsByCustomer.get(customer.internalCode) ?? [],
			}
		})

		const mappedCustomers = mapCustomers(data)

		const response: CustomersResponse = {
			data: mappedCustomers,
			totalCount: mappedCustomers.length,
		}

		await redisCache.setJson(cacheKey, response)
		return response
	}

	public async getCustomer(
		customerId: string,
		requestContext: RequestContext,
	): Promise<CustomersResponse['data'][number] | null> {
		let customer =
			await this.mongoDbClient.getDocumentByField<CustomerDocument>(
				requestContext,
				COLLECTION_NAMES.CUSTOMERS,
				Customer,
				{ fieldName: 'customerId', fieldValue: customerId },
			)

		if (!customer) {
			customer = await this.mongoDbClient.getDocumentByField<CustomerDocument>(
				requestContext,
				COLLECTION_NAMES.CUSTOMERS,
				Customer,
				{ fieldName: 'internalCode', fieldValue: customerId },
			)
		}

		if (!customer) {
			return null
		}

		const dailyActions = await this.getDailyActions(requestContext)
		const actions = dailyActions.data.filter(
			action =>
				action.entryType !== 'BUYING_ENTRY' &&
				action.customerId === (customer.internalCode ?? customer.customerId),
		)

		const mappedCustomers = mapCustomers([
			{
				customerId: customer.customerId ?? customer.internalCode ?? customerId,
				name: customer.name,
				sold: 0,
				internalCode: customer.internalCode,
				createdAt: customer.createdAt?.toISOString(),
				updatedAt: customer.updatedAt?.toISOString(),
				createdBy: customer.createdBy as any,
				updatedBy: customer.updatedBy
					? {
							...customer.updatedBy,
							updatedAt: customer.updatedBy.updatedAt.toISOString(),
						}
					: undefined,
				actions,
			},
		])

		return mappedCustomers[0]
	}

	public async postCustomer(
		requestContext: RequestContext,
		requestBody: CustomerRequestBody,
	): Promise<CreateCustomerResponse | null> {
		const { name, internalCode } = requestBody
		const tenantContext = getTenantContext(requestContext)

		if (!name || !name.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Customer name is required',
			)
		}

		const existing = await withTenantScope(
			Customer.findOne({
				name: new RegExp(`^${this.escapeRegex(name)}$`, 'i'),
			}),
			tenantContext.tenantId,
		).lean()

		if (!!existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Customer already exists in this tenant.',
			)
		}

		const customerData: CustomerDocument = {
			tenantId: tenantContext.tenantId,
			_id: uuidv4(),
			customerId: uuidv4(),
			internalCode: internalCode?.trim() || undefined,
			name,
			createdBy: {
				_id: requestContext.userId as string,
				displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
				role: requestContext.user?.role as TenantRole,
			},
			updatedBy: {
				_id: requestContext.userId as string,
				displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
				role: requestContext.user?.role as TenantRole,
				updatedAt: new Date(),
			},
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		logger.info('Saving customer to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			customerId: customerData.customerId,
			name,
		})

		const createCustomerResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.CUSTOMERS, data: customerData },
			Customer,
			requestContext,
		)
		console.log(
			'🚀 ~ ProductController ~ postCustomer ~ createCustomerResponse:',
			createCustomerResponse,
		)

		logger.info('Customer created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			customerId: customerData.customerId,
			name,
		})

		return {
			_id: createCustomerResponse._id,
		}
	}

	public async getCurrencies(
		requestContext: RequestContext,
	): Promise<CurrenciesResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildCurrencyListKey(tenantId)
		const cachedCurrencies =
			await redisCache.getJson<CurrenciesResponse>(cacheKey)
		if (cachedCurrencies) {
			return cachedCurrencies
		}
		const currencies = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.CURRENCIES,
			model: Currency,
			sort: { createdAt: 'desc' },
		})

		const response: CurrenciesResponse = {
			data: currencies.documents,
			totalCount: currencies.documents.length,
		}
		await redisCache.setJson(cacheKey, response)
		return response
	}

	public async postCurrency(
		requestContext: RequestContext,
		requestBody: CurrencyRequestBody,
	): Promise<CreateCurrencyResponse | null> {
		const { name, internalCode } = requestBody
		const tenantContext = getTenantContext(requestContext)

		if (!name || !name.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Currency name is required',
			)
		}

		const existing = await withTenantScope(
			Currency.findOne({
				name: new RegExp(`^${this.escapeRegex(name)}$`, 'i'),
			}),
			tenantContext.tenantId,
		).lean()

		if (!!existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Currency already exists in this tenant.',
			)
		}

		const currencyData: CurrencyDocument = {
			tenantId: tenantContext.tenantId,
			_id: uuidv4(),
			name: name,
			currencyId: uuidv4(),
			internalCode: internalCode?.trim() || undefined,
			createdBy: {
				_id: requestContext.userId as string,
				displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
				role: requestContext.user?.role as TenantRole,
			},
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		logger.info('Saving currency to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			currencyId: currencyData.currencyId,
			name,
		})

		const createCurrencyResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.CURRENCIES, data: currencyData },
			Currency,
			requestContext,
		)

		logger.info('Currency created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			currencyId: currencyData.currencyId,
			name,
		})

		return {
			_id: createCurrencyResponse._id,
		}
	}

	public async getUnits(
		requestContext: RequestContext,
	): Promise<UnitsResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildUnitListKey(tenantId)
		const cachedUnits = await redisCache.getJson<UnitsResponse>(cacheKey)
		if (cachedUnits) {
			return cachedUnits
		}
		const units = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.UNITS,
			model: Unit,
			sort: { createdAt: 'desc' },
		})

		const response: UnitsResponse = {
			data: units.documents,
			totalCount: units.documents.length,
		}
		await redisCache.setJson(cacheKey, response)
		return response
	}

	public async postUnit(
		requestContext: RequestContext,
		requestBody: UnitRequestBody,
	): Promise<CreateUnitResponse | null> {
		const { name, internalCode } = requestBody
		const tenantContext = getTenantContext(requestContext)

		if (!name || !name.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Unit name is required',
			)
		}

		const existing = await withTenantScope(
			Unit.findOne({
				name: new RegExp(`^${this.escapeRegex(name)}$`, 'i'),
			}),
			tenantContext.tenantId,
		).lean()

		if (!!existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Unit already exists in this tenant.',
			)
		}

		const unitData: UnitDocument = {
			tenantId: tenantContext.tenantId,
			_id: uuidv4(),
			unitId: uuidv4(),
			name: name,
			internalCode: internalCode?.trim() || undefined,
			createdBy: {
				_id: requestContext.userId as string,
				displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
				role: requestContext.user?.role as TenantRole,
			},
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		logger.info('Saving unit to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			unitId: unitData.unitId,
			name,
		})

		const createUnitResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.UNITS, data: unitData },
			Unit,
			requestContext,
		)

		logger.info('Unit created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			unitId: unitData._id,
			name,
		})

		return {
			_id: createUnitResponse._id,
		}
	}
}
