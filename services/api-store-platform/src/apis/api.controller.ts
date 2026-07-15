import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import express from 'express'
import { isAfter } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import mongoose from 'mongoose'

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
import { Expense } from '../models/Expense'
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
import {
	filterCustomerRelatedActions,
	filterPartnerRelatedActions,
	filterProductRelatedActions,
	mapCustomer,
	mapCustomers,
	mapPartners,
	mapProductAction,
	mapSuppliers,
	mapTenantSummary,
} from './mappings/mapper'
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
	ProductCatalogItem,
	ProductCatalogResponse,
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
	ExpenseRequestBody,
	CreateExpenseResponse,
	ExpenseDocument,
	CurrencyRequestBody,
	CurrencyDocument,
	CreateCurrencyResponse,
	UnitRequestBody,
	UnitDocument,
	CreateUnitResponse,
	PartnerRequestBody,
	PartnerDocument,
	CreatePartnerResponse,
	InventoryDocument,
	CategoryRequestBody,
	CategoryDocument,
	SellingInvoicesListResponse,
	SellingInvoicesQueryParams,
	CategoriesResponse,
	BrandRequestBody,
	ShelfRequestBody,
	WarehouseRequestBody,
	BrandDocument,
	ShelfDocument,
	WarehouseDocument,
	CreateBrandResponse,
	CreateShelfResponse,
	CreateWarehouseResponse,
	SellingInvoicesSummary,
	SyncBootstrapResponse,
	SyncPushRequestBody,
	SyncPushResponse,
	SyncPushResult,
} from '../shared/types'
import {
	CreateDailyActionResponse,
	CurrenciesResponse,
	CustomerResponse,
	CustomersResponse,
	DailyActionRequestBody,
	DailyActionResponse,
	EntryType,
	ExpensesResponse,
	LoginData,
	PartnersResponse,
	SuppliersResponse,
	UnitsResponse,
	BrandsResponse,
	ShelvesResponse,
	WarehousesResponse,
} from '../shared/types/api'
import ProductsMapper, {
	ProductRelationLookups,
} from './mappings/ProductsMapper'
import { getTenantPermissions } from '../shared/Permissions'
import {
	DEFAULT_TENANT_ACCESSIBLE_PAGES,
	sanitizeAccessiblePages,
	TenantAccessiblePage,
} from '../shared/constants/tenantAccessiblePages'
import { resolveAccessiblePagesForTenant } from '../shared/constants/tenantPageAccess'
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
import type { Workbook } from 'exceljs'
import { generateDailyActionsExcel } from '../shared/files/excel'
import { Partner } from '../models/Partner'
import { DailyActionType, TargetType } from '../shared/globalEnums'
import { Category } from '../models/Category'
import { Brand } from '../models/Brand'
import { Shelf } from '../models/Shelf'
import { Warehouse } from '../models/Warehaus'
import { StockMoving } from '../models/StockMovings'
import { SyncMutation } from '../models/SyncMutation'
import { OfflineSyncState } from '../models/OfflineSyncState'

const OFFLINE_INVOICE_NUMBER_BLOCK = 500

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
	partner?: string[]
	customer?: string[]
	invoiceDateFrom?: string
	invoiceDateTo?: string
}

type FilterValueOption = {
	value: string
	label: string
}

type ProductFilterValuesResponse = {
	supplier: FilterValueOption[]
	brand: FilterValueOption[]
	state: FilterValueOption[]
	category: FilterValueOption[]
}

type DailyActionFilterValuesResponse = {
	entryType: FilterValueOption[]
	productName: FilterValueOption[]
	supplier: FilterValueOption[]
	partner: FilterValueOption[]
	customer: FilterValueOption[]
	expense: FilterValueOption[]
}

type ProductFilterValueSource = {
	supplierId?: string
	brandId?: string
	categoryId?: string
	status?: string
}

type DailyActionFilterValueSource = {
	entryType?: string
	productId?: string
	productName?: string
	supplierId?: string
	supplierName?: string
	partnerId?: string
	partnerName?: string
	customerId?: string
	customerName?: string
	expenseId?: string
	expenseName?: string
}

const getInvoiceDateBoundary = (
	dateValue: string | undefined,
	boundary: 'start' | 'end',
): Date | undefined => {
	const trimmedDateValue = dateValue?.trim()

	if (!trimmedDateValue) return undefined

	const isDateOnlyValue = /^\d{4}-\d{2}-\d{2}$/.test(trimmedDateValue)
	const date = isDateOnlyValue
		? new Date(
				`${trimmedDateValue}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`,
			)
		: new Date(trimmedDateValue)

	return Number.isNaN(date.getTime()) ? undefined : date
}

type BudgetOverviewResponse = {
	sumBuyingWeight?: string
	sumSellingWeight?: string
	payments: string
	purchase: string
	balance: string
	currency?: string
}

export default class ProductController {
	constructor(
		private productsMapper: ProductsMapper,
		private mongoDbClient: MongodbController,
	) {}

	private getTenantId(requestContext: RequestContext): string {
		return requestContext.tenantId || 'global'
	}

	private async getProductRelationLookups(
		requestContext: RequestContext,
	): Promise<ProductRelationLookups> {
		const [
			categoriesResponse,
			suppliersResponse,
			brandsResponse,
			shelvesResponse,
			warehousesResponse,
		] = await Promise.all([
			this.getCategories(requestContext),
			this.getSuppliers(requestContext),
			this.getBrands(requestContext),
			this.getShelves(requestContext),
			this.getWarehouses(requestContext),
		])

		return {
			categoryNameById: new Map(
				categoriesResponse.data.map(category => [
					category.categoryId,
					category.name,
				]),
			),
			supplierNameById: new Map(
				suppliersResponse.data.map(supplier => [
					supplier.supplierId,
					supplier.name,
				]),
			),
			brandNameById: new Map(
				brandsResponse.data.map(brand => [brand.brandId, brand.name]),
			),
			shelfNameById: new Map(
				shelvesResponse.data.map(shelf => [shelf.shelfId, shelf.name]),
			),
			warehouseNameById: new Map(
				warehousesResponse.data.map(warehouse => [
					warehouse.warehouseId,
					warehouse.name,
				]),
			),
		}
	}

	private async invalidateEntityCache(
		entity: 'orders' | 'invoices' | 'inventory' | 'products' | 'categories',
		requestContext: RequestContext,
		id?: string,
	): Promise<void> {
		const tenantId = this.getTenantId(requestContext)

		const listKey =
			entity === 'orders'
				? redisCache.buildOrderListKey(tenantId)
				: entity === 'invoices'
					? redisCache.buildInvoiceListKey(tenantId)
					: entity === 'inventory'
						? redisCache.buildInventoryListKey(tenantId)
						: entity === 'categories'
							? redisCache.buildCategoryListKey(tenantId)
							: redisCache.buildProductListKey(tenantId)

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
						: entity === 'inventory'
							? redisCache.buildInventoryDetailKey(tenantId, id)
							: redisCache.buildProductDetailKey(tenantId, id)

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

	private async invalidateAllTenantListCaches(tenantId: string): Promise<void> {
		await Promise.all([
			redisCache.del(redisCache.buildProductListKey(tenantId)),
			redisCache.del(redisCache.buildInventoryListKey(tenantId)),
			redisCache.del(redisCache.buildInvoiceListKey(tenantId)),
			redisCache.del(redisCache.buildCustomerListKey(tenantId)),
			redisCache.del(redisCache.buildSupplierListKey(tenantId)),
			redisCache.del(redisCache.buildPartnerListKey(tenantId)),
			redisCache.del(redisCache.buildCategoryListKey(tenantId)),
			redisCache.del(redisCache.buildBrandListKey(tenantId)),
			redisCache.del(redisCache.buildShelfListKey(tenantId)),
			redisCache.del(redisCache.buildWarehouseListKey(tenantId)),
			redisCache.del(redisCache.buildCurrencyListKey(tenantId)),
			redisCache.del(redisCache.buildUnitListKey(tenantId)),
			redisCache.del(redisCache.buildExpenseListKey(tenantId)),
			redisCache.del(`dailyActions:${tenantId}`),
		])
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
		optionsMap: Map<string, FilterValueOption>,
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
		optionsMap: Map<string, FilterValueOption>,
	): FilterValueOption[] {
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
			userId: string
			role: RequestContext['role']
			tokenVersion: number
			tenantId: string
		},
		tenantName: string,
	): string {
		return jwt.sign(
			{
				userId: user.userId,
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
		}
	}

	private resolveAccessiblePagesForAuth(tenant: ITenant): string[] {
		return resolveAccessiblePagesForTenant(tenant)
	}

	private resolveOfflineEnabledForAuth(tenant: ITenant): boolean {
		return tenant.offlineEnabled !== false
	}

	private async ensureOfflineEnabledForSync(
		requestContext: RequestContext,
	): Promise<void> {
		const tenantId = this.getTenantId(requestContext)
		const tenant = (await Tenant.findOne({ tenantId }).lean()) as ITenant | null

		if (!tenant || !this.resolveOfflineEnabledForAuth(tenant)) {
			throw new BusinessLogicError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Offline mode is not enabled for this tenant.',
			)
		}
	}

	public async getTenantAccessiblePagesForRequest(
		tenantId: string,
	): Promise<TenantAccessiblePage[]> {
		const tenant = (await Tenant.findOne({
			tenantId,
			status: 'active',
		}).lean()) as ITenant | null

		if (!tenant) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Tenant is not active.',
			)
		}

		return resolveAccessiblePagesForTenant(tenant)
	}

	private createTemporaryPassword(): string {
		const randomPart = crypto.randomBytes(10).toString('base64url')
		const digit = String(crypto.randomInt(0, 10))
		const lower = String.fromCharCode(97 + crypto.randomInt(0, 26))

		return `${lower}${randomPart}${digit}`
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
			User.findOne({ userId: decoded.userId }),
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
			userId: user.userId,
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
			userId: user.userId,
			tenantId: user.tenantId,
			tenantName: tenant.name,
			email: user.email,
			role: user.role,
			firstName: user.user.firstName,
			lastName: user.user.lastName,
			accessiblePages: this.resolveAccessiblePagesForAuth(tenant),
			offlineEnabled: this.resolveOfflineEnabledForAuth(tenant),
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
			accessiblePages: this.resolveAccessiblePagesForAuth(tenant),
			offlineEnabled: this.resolveOfflineEnabledForAuth(tenant),
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
					{ internalCode: searchRegex },
					{ productFactoryCode: searchRegex },
				],
			})
		}

		if (supplierRegexList.length > 0) {
			productQueryClauses.push({
				supplierId: { $in: supplierRegexList },
			})
		}

		if (brandRegexList.length > 0) {
			productQueryClauses.push({
				brandId: { $in: brandRegexList },
			})
		}

		if (categoryRegexList.length > 0) {
			productQueryClauses.push({
				categoryId: { $in: categoryRegexList },
			})
		}

		const mongoQuery =
			productQueryClauses.length > 0 ? { $and: productQueryClauses } : {}

		const products = await withTenantScope(
			Product.find(mongoQuery).sort({ name: 1 }),
			tenantId,
		).lean<ProductAPI[]>()

		const inventory = await this.getInventory(requestContext)
		const inventoryByProductId = new Map(
			inventory.map(inventoryItem => [inventoryItem.productId, inventoryItem]),
		)
		const relationLookups = await this.getProductRelationLookups(requestContext)

		const mappedProducts = products
			?.map(product =>
				this.productsMapper.mapProduct(
					product,
					inventoryByProductId.get(product.productId),
					requestContext,
					relationLookups,
				),
			)
			.filter(Boolean) as ProductRequestBody[]

		const filteredProductsByState =
			stateFilterSet.size > 0
				? mappedProducts.filter(product => stateFilterSet.has(product.status))
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

		if (!hasFilters) {
			await redisCache.setJson(cacheKey, mappedProducts)
		}

		return {
			products: paginatedProducts,
			totalCount,
		}
	}

	public async getProductCatalog(
		requestContext: RequestContext,
	): Promise<ProductCatalogResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildProductListKey(tenantId)

		let fullProducts =
			await redisCache.getJson<ProductRequestBody[]>(cacheKey)

		if (!fullProducts) {
			await this.getProducts(requestContext, {}, { limit: 1, offset: 0 })
			fullProducts =
				await redisCache.getJson<ProductRequestBody[]>(cacheKey)
		}

		const catalogProducts = (fullProducts ?? []).map(product =>
			this.mapProductCatalogItem(product),
		)

		return {
			products: catalogProducts,
			totalCount: catalogProducts.length,
		}
	}

	private mapProductCatalogItem(
		product: ProductRequestBody,
	): ProductCatalogItem {
		return {
			productId: product.productId,
			name: product.name,
			latinName: product.latinName,
			barcode: product.barcode,
			internalCode: product.internalCode,
			productFactoryCode: product.productFactoryCode,
			unitId: product.unitId,
			taxRate: product.taxRate,
			price: {
				retailPrice: product.price.retailPrice,
				discount: product.price.discount,
				currency: product.price.currency,
			},
			images: product.images?.length ? [product.images[0]] : undefined,
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
				.select('supplierId brandId categoryId status')
				.lean<ProductFilterValueSource[]>(),
			tenantId,
		)

		const supplierMap = new Map<string, FilterValueOption>()
		const brandMap = new Map<string, FilterValueOption>()
		const categoryMap = new Map<string, FilterValueOption>()
		const stateMap = new Map<string, FilterValueOption>()

		for (const product of products) {
			if (canAccessSupplierFilter) {
				this.addFilterOption(
					supplierMap,
					product.supplierId,
					product.supplierId,
				)
			}

			this.addFilterOption(brandMap, product.brandId, product.brandId)

			this.addFilterOption(categoryMap, product.categoryId, product.categoryId)

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
			{ fieldName: 'productId', fieldValue: productId },
		)

		if (!product) {
			return null
		}

		const dailyActions = await this.getDailyActions(requestContext)
		const inventory = await this.getInventory(requestContext)
		const inventoryItem = inventory.find(item => item.productId === productId)

		const relationLookups = await this.getProductRelationLookups(requestContext)
		const relatedActions = filterProductRelatedActions(
			dailyActions.data,
			product,
		)

		const mappedProduct: ProductRequestBody = {
			...this.productsMapper.mapProduct(
				product,
				inventoryItem,
				requestContext,
				relationLookups,
			),
			relatedActions: relatedActions.map(mapProductAction),
		}

		await redisCache.setJson(cacheKey, mappedProduct)

		return mappedProduct
	}

	public async postProduct(
		requestBody: ProductRequestBody,
		requestContext: RequestContext,
	): Promise<CreateProductResponse | null> {
		const tenantContext = getTenantContext(requestContext)

		const {
			name,
			latinName,
			barcode,
			internalCode,
			productFactoryCode,
			categoryId,
			supplierId,
			brandId,
			taxRate,
			unitId,
			price,
			status,
			attributes,
			images,
			description,
			quantity,
			minQuantity,
		} = requestBody

		if (!name?.trim() && !latinName?.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Product name or latin name is required',
			)
		}

		if (!price?.retailPrice && price?.retailPrice !== 0) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Product retail price is required',
			)
		}

		if (quantity === undefined || quantity === null || quantity < 0) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Product quantity is required',
			)
		}

		const normalizedBarcode = barcode?.trim()

		if (normalizedBarcode) {
			const existing = await withTenantScope(
				Product.findOne({ barcode: normalizedBarcode }),
				tenantContext.tenantId,
			).lean()

			if (existing) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Product barcode already exists in this tenant.',
				)
			}
		}

		const productId = this.resolveSyncClientId(requestBody.productId)

		const existingById = await withTenantScope(
			Product.findOne({ productId }).lean(),
			tenantContext.tenantId,
		)

		if (existingById) {
			return {
				_id: String(existingById._id),
				productId: existingById.productId,
			}
		}

		const productData: ProductDocument = {
			productId,
			name,
			latinName,
			barcode: normalizedBarcode === '' ? productId : normalizedBarcode,
			internalCode: internalCode?.trim(),
			productFactoryCode: productFactoryCode?.trim(),
			categoryId,
			supplierId,
			brandId,
			taxRate:
				taxRate !== undefined && taxRate !== null ? String(taxRate) : undefined,
			unitId,
			price: {
				purchasePrice: price.purchasePrice,
				retailPrice: price.retailPrice,
				wholesalePrice: price.wholesalePrice,
				semiWholesalePrice: price.semiWholesalePrice,
				discount: price.discount,
				currency: price.currency.trim(),
			},
			status: status ?? 'active',
			attributes,
			images,
			description: description?.trim(),
		}

		logger.info('Saving product to database....', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			productId: productData.productId,
			name: productData.name,
		})

		await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.PRODUCTS, data: productData },
			Product,
			requestContext,
		)

		logger.info('Product created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			productId: productData.productId,
			name: productData.name,
		})

		const inventoryData: InventoryDocument = {
			inventoryId: uuidv4(),
			productId: productData.productId,
			quantity,
			minQuantity,
		}

		await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.INVENTORY, data: inventoryData },
			Inventory,
			requestContext,
		)

		logger.info('Inventory created for new product.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			productId: productData.productId,
			inventoryId: inventoryData.inventoryId,
			quantity,
		})

		await this.invalidateEntityCache(
			'products',
			requestContext,
			productData.productId,
		)

		await this.invalidateEntityCache(
			'inventory',
			requestContext,
			inventoryData.inventoryId,
		)

		return { _id: productData.productId }
	}

	public async patchProduct(
		productId: string,
		requestBody: ProductDocument,
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

		const updateResponse = await this.mongoDbClient.updateDocument(
			{
				collectionName: COLLECTION_NAMES.PRODUCTS,
				id: productId,
			},
			requestContext,
			Product,
			allowedUpdates,
		)

		await this.invalidateEntityCache('products', requestContext, productId)
		await this.invalidateEntityCache('inventory', requestContext)

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

		await this.invalidateEntityCache('products', requestContext, productId)
		await this.invalidateEntityCache('inventory', requestContext)

		return deleteResponse
	}

	public async getDailyActionsExcel(
		requestContext: RequestContext,
		dailyActionFilterQuery: DailyActionFilterQuery,
	): Promise<Workbook> {
		const { data: dailyActions } = await this.getDailyActions(
			requestContext,
			dailyActionFilterQuery,
		)

		return generateDailyActionsExcel(dailyActions)
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

	private async ensureInvoiceProductsBelongToTenant(
		requestContext: RequestContext,
		items: NonNullable<InvoiceRequestBody['items']>,
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
				'Invoice items must reference products from the same tenant.',
			)
		}
	}

	private async getInventoryByProductId(
		requestContext: RequestContext,
		productId: string,
	): Promise<InventoryDocument | null> {
		return this.mongoDbClient.getDocumentByField<InventoryDocument>(
			requestContext,
			COLLECTION_NAMES.INVENTORY,
			Inventory,
			{ fieldName: 'productId', fieldValue: productId },
		)
	}

	private resolveSyncClientId(clientId?: string): string {
		const trimmed = clientId?.trim()

		if (trimmed && /^[0-9a-f-]{36}$/i.test(trimmed)) {
			return trimmed
		}

		return uuidv4()
	}

	private async resolveLatestInvoiceNumber(
		requestContext: RequestContext,
	): Promise<number> {
		const tenantContext = getTenantContext(requestContext)
		const latestInvoice = await withTenantScope(
			Invoice.findOne({}, { invoiceNumber: 1 }).sort({ createdAt: -1 }).lean(),
			tenantContext.tenantId,
		)

		const latestNumber = Number.parseInt(
			String(latestInvoice?.invoiceNumber ?? '0'),
			10,
		)

		return Number.isNaN(latestNumber) ? 1 : latestNumber + 1
	}

	public async resolveNextInvoiceNumber(
		requestContext: RequestContext,
	): Promise<number> {
		const tenantId = this.getTenantId(requestContext)
		const latestFromInvoices =
			await this.resolveLatestInvoiceNumber(requestContext)
		const offlineState = await withTenantScope(
			OfflineSyncState.findOne({}).lean(),
			tenantId,
		)
		const minOnlineInvoiceNumber = offlineState?.minOnlineInvoiceNumber ?? 1

		return Math.max(latestFromInvoices, minOnlineInvoiceNumber)
	}

	private async allocateOfflineInvoiceBlock(
		requestContext: RequestContext,
	): Promise<{ nextInvoiceNumber: number; invoiceNumberBlockEnd: number }> {
		const tenantId = this.getTenantId(requestContext)
		const latestFromInvoices =
			await this.resolveLatestInvoiceNumber(requestContext)
		const session = await mongoose.startSession()

		try {
			let blockStart = latestFromInvoices
			let blockEnd = blockStart + OFFLINE_INVOICE_NUMBER_BLOCK - 1

			await session.withTransaction(async () => {
				const existing = await withTenantScope(
					OfflineSyncState.findOne({}).session(session),
					tenantId,
				)

				blockStart = existing?.nextBlockStart ?? latestFromInvoices
				blockEnd = blockStart + OFFLINE_INVOICE_NUMBER_BLOCK - 1
				const nextBlockStart = blockEnd + 1

				await withTenantScope(
					OfflineSyncState.findOneAndUpdate(
						{},
						{
							$set: { nextBlockStart },
							$max: { minOnlineInvoiceNumber: nextBlockStart },
						},
						{ upsert: true, session, new: true },
					),
					tenantId,
				)
			})

			return {
				nextInvoiceNumber: blockStart,
				invoiceNumberBlockEnd: blockEnd,
			}
		} finally {
			await session.endSession()
		}
	}

	private deriveInvoicePaymentStatus(
		grandTotal: number,
		paidAmount: number,
	): 'unpaid' | 'partial' | 'paid' {
		if (paidAmount <= 0) return 'unpaid'

		if (paidAmount + 0.009 >= grandTotal) return 'paid'

		return 'partial'
	}

	private deriveInvoiceStatus(
		requestStatus: InvoiceRequestBody['status'],
		paymentStatus: 'unpaid' | 'partial' | 'paid',
		paymentType?: InvoiceRequestBody['paymentType'],
	): NonNullable<InvoiceRequestBody['status']> {
		if (requestStatus === 'draft' || requestStatus === 'cancelled') {
			return requestStatus
		}

		if (paymentStatus === 'paid') return 'paid'

		if (paymentStatus === 'partial') return 'partial'

		if (paymentType === 'credit') return 'confirmed'

		return requestStatus ?? 'confirmed'
	}

	private shouldAdjustInventoryForInvoice(
		status: NonNullable<InvoiceRequestBody['status']>,
	): boolean {
		return !['draft', 'cancelled', 'void', 'pending'].includes(status)
	}

	private buildSellingInvoicesSummary(
		invoices: Array<Record<string, any>>,
	): SellingInvoicesSummary {
		const todayStart = new Date()

		todayStart.setHours(0, 0, 0, 0)

		const todayEnd = new Date()

		todayEnd.setHours(23, 59, 59, 999)

		const todaysInvoices = invoices.filter(invoice => {
			const issuedAt = invoice.issuedAt ? new Date(invoice.issuedAt) : null

			return issuedAt && issuedAt >= todayStart && issuedAt <= todayEnd
		})

		const todaySales = todaysInvoices.reduce(
			(total, invoice) => total + (Number(invoice.amount) || 0),
			0,
		)

		const paidInvoices = invoices.filter(
			invoice => invoice.status === 'paid',
		).length

		const creditInvoices = invoices.filter(
			invoice =>
				invoice.paymentType === 'credit' && invoice.paymentStatus !== 'paid',
		).length

		const totalReceivable = invoices.reduce((total, invoice) => {
			const remaining = Number(invoice.remainingAmount) || 0

			return remaining > 0 ? total + remaining : total
		}, 0)

		const averageOrder =
			todaysInvoices.length > 0 ? todaySales / todaysInvoices.length : 0

		return {
			todaySales,
			paidInvoices,
			creditInvoices,
			totalReceivable,
			averageOrder,
		}
	}

	private mapInvoiceFiltersToUiStatus(invoice: Record<string, any>): string {
		if (invoice.status === 'draft') return 'draft'

		if (invoice.status === 'cancelled') return 'cancelled'

		if (invoice.status === 'paid') return 'paid'

		if (invoice.status === 'partial') return 'partial'

		if (invoice.paymentType === 'credit' && invoice.paymentStatus !== 'paid') {
			return 'credit'
		}

		if (invoice.paymentStatus === 'partial') return 'partial'

		return invoice.status ?? 'confirmed'
	}

	private async validateSaleInventory(
		requestContext: RequestContext,
		items: NonNullable<InvoiceRequestBody['items']>,
	) {
		for (const item of items) {
			const inventory = await this.getInventoryByProductId(
				requestContext,
				item.productId,
			)

			if (!inventory) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					`No inventory record found for product ${item.name}.`,
				)
			}

			const currentQuantity = Number(inventory.quantity ?? 0)

			if (currentQuantity < item.quantity) {
				// throw new BusinessLogicError(
				// 	ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				// 	`Insufficient stock for ${item.name}. Available: ${currentQuantity}, requested: ${item.quantity}.`,
				// )
				logger.error(
					`Insufficient stock for ${item.name}. Available: ${currentQuantity}, requested: ${item.quantity}.`,
				)
			}
		}
	}

	private async applySaleInventoryAdjustments(
		requestContext: RequestContext,
		invoiceId: string,
		invoiceNumber: string,
		items: NonNullable<InvoiceRequestBody['items']>,
	) {
		for (const item of items) {
			const inventory = await this.getInventoryByProductId(
				requestContext,
				item.productId,
			)

			if (!inventory) continue

			const currentQuantity = Number(inventory.quantity ?? 0)
			const nextQuantity = currentQuantity - item.quantity
			const reservedQuantity = Number(inventory.reservedQuantity ?? 0)
			const nextAvailableQuantity = Math.max(0, nextQuantity - reservedQuantity)

			await this.mongoDbClient.updateDocument(
				{
					collectionName: COLLECTION_NAMES.INVENTORY,
					id: inventory.inventoryId,
				},
				requestContext,
				Inventory,
				{
					quantity: nextQuantity,
					availableQuantity: nextAvailableQuantity,
				},
			)

			await this.mongoDbClient.createDocument(
				{
					collectionName: COLLECTION_NAMES.STOCK_MOVINGS,
					data: {
						stockMovingId: uuidv4(),
						productId: item.productId,
						warehouseId: inventory.warehouseId,
						type: 'sale',
						quantity: item.quantity,
						unitCost: item.unitPrice,
						referenceType: 'selling_invoice',
						referenceId: invoiceId,
						note: `Invoice #${invoiceNumber}`,
					},
				},
				StockMoving,
				requestContext,
			)

			await this.invalidateEntityCache(
				'inventory',
				requestContext,
				inventory.inventoryId,
			)
		}
	}

	public async getInvoices(
		requestContext: RequestContext,
		filters: SellingInvoicesQueryParams = {},
	): Promise<SellingInvoicesListResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildInvoiceListKey(tenantId)
		const cachedInvoices = await redisCache.getJson<
			SellingInvoicesListResponse | any[]
		>(cacheKey)

		let invoices: Array<Record<string, any>>

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

		const normalizedSearch = filters.searchText?.trim().toLowerCase()

		const filteredInvoices = invoices.filter((invoice: Record<string, any>) => {
			const uiStatus = this.mapInvoiceFiltersToUiStatus(invoice)

			if (
				filters.status &&
				filters.status !== 'all' &&
				uiStatus !== filters.status
			) {
				return false
			}

			if (filters.issuedDate) {
				const issuedAt = invoice.issuedAt ? new Date(invoice.issuedAt) : null
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
		})

		const summary = this.buildSellingInvoicesSummary(invoices)
		const nextInvoiceNumber =
			await this.resolveNextInvoiceNumber(requestContext)

		const response: SellingInvoicesListResponse = {
			invoices: filteredInvoices,
			summary,
			nextInvoiceNumber,
			totalCount: filteredInvoices.length,
		}

		if (!Array.isArray(cachedInvoices) && !cachedInvoices?.invoices) {
			await redisCache.setJson(cacheKey, {
				invoices,
				summary,
				nextInvoiceNumber,
				totalCount: invoices.length,
			})
		}

		return response
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
		if (requestBody.clientMutationId) {
			const processed = await this.getProcessedSyncMutation(
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

		await this.ensureInvoiceProductsBelongToTenant(
			requestContext,
			requestBody.items,
		)

		const grandTotal =
			requestBody.amount ??
			requestBody.totalAmount ??
			requestBody.items.reduce(
				(total, item) =>
					total + (item.lineTotal ?? item.quantity * item.unitPrice),
				0,
			)

		const paidAmount = requestBody.paidAmount ?? 0
		const paymentStatus =
			requestBody.paymentStatus ??
			this.deriveInvoicePaymentStatus(grandTotal, paidAmount)

		const status = this.deriveInvoiceStatus(
			requestBody.status,
			paymentStatus,
			requestBody.paymentType,
		)

		const remainingAmount =
			requestBody.remainingAmount ?? Math.max(0, grandTotal - paidAmount)

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
				await this.recordSyncMutation(
					requestContext,
					requestBody.clientMutationId,
					'invoice',
					'create',
					result,
				)
			}

			return result
		}

		const invoiceNumber =
			requestBody.invoiceNumber ??
			String(await this.resolveNextInvoiceNumber(requestContext))

		const tenantContext = getTenantContext(requestContext)
		const existingByNumber = await withTenantScope(
			Invoice.findOne({ invoiceNumber: String(invoiceNumber) }).lean(),
			tenantContext.tenantId,
		)

		if (existingByNumber && existingByNumber.invoiceId !== invoiceId) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				`Invoice number ${invoiceNumber} is already in use.`,
			)
		}

		const invoiceData = {
			invoiceId,
			invoiceNumber,
			orderId: requestBody.orderId,
			customerId: requestBody.customerId,
			customerName: requestBody.customerName,
			salesPerson: requestBody.salesPerson,
			paymentType: requestBody.paymentType,
			items: requestBody.items,
			status,
			paymentStatus,
			paidAmount,
			remainingAmount,
			amount: grandTotal,
			totalAmount: requestBody.totalAmount ?? grandTotal,
			totalTax: requestBody.totalTax ?? 0,
			totalDiscount: requestBody.totalDiscount ?? 0,
			notes: requestBody.notes,
			printAfterPayment: requestBody.printAfterPayment ?? false,
			warehouseId: requestBody.warehouseId,
			issuedAt: requestBody.issuedAt
				? new Date(requestBody.issuedAt)
				: new Date(),
		}

		if (this.shouldAdjustInventoryForInvoice(status)) {
			await this.validateSaleInventory(requestContext, requestBody.items)
		}

		const createInvoiceResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.INVOICES, data: invoiceData },
			Invoice,
			requestContext,
		)

		if (this.shouldAdjustInventoryForInvoice(status)) {
			await this.applySaleInventoryAdjustments(
				requestContext,
				invoiceId,
				invoiceNumber,
				requestBody.items,
			)
		}

		await this.invalidateEntityCache(
			'invoices',
			requestContext,
			invoiceData.invoiceId,
		)

		const result = {
			_id: createInvoiceResponse._id,
			invoiceId,
			invoiceNumber,
		}

		if (requestBody.clientMutationId) {
			await this.recordSyncMutation(
				requestContext,
				requestBody.clientMutationId,
				'invoice',
				'create',
				result,
			)
		}

		return result
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

	public async getInventory(
		requestContext: RequestContext,
	): Promise<InventoryDocument[]> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildInventoryListKey(tenantId)
		const cachedInventory =
			await redisCache.getJson<InventoryDocument[]>(cacheKey)

		if (cachedInventory) {
			return cachedInventory
		}

		const { documents: inventory } = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.INVENTORY,
			model: Inventory,
			sort: { createdAt: 'desc' },
		})

		await redisCache.setJson(cacheKey, inventory)

		return inventory
	}

	public async getInventoryItem(
		inventoryId: string,
		requestContext: RequestContext,
	) {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildInventoryDetailKey(tenantId, inventoryId)
		const cachedInventoryItem =
			await redisCache.getJson<InventoryDocument>(cacheKey)

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
	public async postCategory(
		requestBody: CategoryRequestBody,
		requestContext: RequestContext,
	) {
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

		const categoryData: CategoryDocument = {
			categoryId,
			name: requestBody.name.trim(),
			description: requestBody.description?.trim(),
			parentCategoryId: requestBody.parentCategoryId,
		}

		logger.info('saving category to database.....', {
			entity: EntityType.MONGODB,
			categoryId: categoryData.categoryId,
			name: categoryData.name,
		})

		await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.CATEGORIES, data: categoryData },
			Category,
			requestContext,
		)

		logger.info('category created successfully.....', {
			entity: EntityType.MONGODB,
			categoryId: categoryData.categoryId,
			name: categoryData.name,
		})

		await this.invalidateEntityCache(
			'categories',
			requestContext,
			categoryData.categoryId,
		)

		return { _id: categoryData.categoryId }
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

		const response = {
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

	public async postInventory(
		requestBody: InventoryRequestBody,
		requestContext: RequestContext,
	) {
		await this.ensureInventoryProductBelongsToTenant(
			requestContext,
			requestBody.productId,
		)

		const inventoryData: InventoryDocument = {
			inventoryId: uuidv4(),
			productId: requestBody.productId,
			warehouseId: requestBody.warehouseId,
			shelfId: requestBody.shelfId,
			quantity: requestBody.quantity,
		}

		logger.info('saving inventory to database.....', {
			entity: EntityType.MONGODB,
			inventoryId: inventoryData.inventoryId,
			productId: inventoryData.productId,
		})

		const createInventoryResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.INVENTORY, data: inventoryData },
			Inventory,
			requestContext,
		)

		logger.info('inventory created successfully.....', {
			entity: EntityType.MONGODB,
			inventoryId: createInventoryResponse._id,
		})

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
			Boolean(filters.customer?.length) ||
			Boolean(filters.invoiceDateFrom?.trim()) ||
			Boolean(filters.invoiceDateTo?.trim())
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
		const partnerRegexList = this.buildCaseInsensitiveRegexList(filters.partner)
		const supplierRegexList = this.buildCaseInsensitiveRegexList(
			filters.supplier,
		)
		const customerRegexList = this.buildCaseInsensitiveRegexList(
			filters.customer,
		)
		const invoiceDateFrom = getInvoiceDateBoundary(
			filters.invoiceDateFrom,
			'start',
		)
		const invoiceDateTo = getInvoiceDateBoundary(filters.invoiceDateTo, 'end')
		const dailyActionQueryClauses: Record<string, unknown>[] = []

		if (searchText) {
			const searchRegex = new RegExp(this.escapeRegex(searchText), 'i')

			dailyActionQueryClauses.push({
				$or: [{ invoiceNumber: searchRegex }],
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

		if (partnerRegexList.length > 0) {
			dailyActionQueryClauses.push({
				$or: [
					{ partnerId: { $in: partnerRegexList } },
					{ partnerName: { $in: partnerRegexList } },
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

		if (invoiceDateFrom || invoiceDateTo) {
			dailyActionQueryClauses.push({
				invoiceDate: {
					...(invoiceDateFrom ? { $gte: invoiceDateFrom } : {}),
					...(invoiceDateTo ? { $lte: invoiceDateTo } : {}),
				},
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
		//TO_DO : map daily action

		// const mappedDailyAction = mapDailyAction([dailyAction])
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
					'entryType productId productName supplierId supplierName customerId customerName expenseId expenseName',
				)
				.lean<DailyActionFilterValueSource[]>(),
			tenantId,
		)

		const entryTypeMap = new Map<string, FilterValueOption>()
		const productNameMap = new Map<string, FilterValueOption>()
		const supplierMap = new Map<string, FilterValueOption>()
		const customerMap = new Map<string, FilterValueOption>()
		const expenseMap = new Map<string, FilterValueOption>()
		const partnerMap = new Map<string, FilterValueOption>()

		for (const dailyAction of dailyActions) {
			this.addFilterOption(
				entryTypeMap,
				dailyAction.entryType,
				dailyAction.entryType,
			)

			this.addFilterOption(
				productNameMap,
				dailyAction.productName ||
					dailyAction.productId ||
					dailyAction.expenseName ||
					dailyAction.expenseId,
				dailyAction.productName ||
					dailyAction.productId ||
					dailyAction.expenseName ||
					dailyAction.expenseId,
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

			this.addFilterOption(
				expenseMap,
				dailyAction.expenseId || dailyAction.expenseName,
				dailyAction.expenseName || dailyAction.expenseId,
			)

			this.addFilterOption(
				partnerMap,
				dailyAction.partnerId || dailyAction.partnerName,
				dailyAction.partnerName || dailyAction.partnerId,
			)
		}

		return {
			entryType: this.buildSortedFilterOptions(entryTypeMap),
			productName: this.buildSortedFilterOptions(productNameMap),
			supplier: this.buildSortedFilterOptions(supplierMap),
			customer: this.buildSortedFilterOptions(customerMap),
			expense: this.buildSortedFilterOptions(expenseMap),
			partner: this.buildSortedFilterOptions(partnerMap),
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
		targetType: TargetType,
		targetId: string,
		requestContext: RequestContext,
	): Promise<BudgetOverviewResponse | null> {
		const dailyActions = await this.getDailyActions(requestContext)

		const relevantActions = dailyActions.data.filter(action => {
			switch (targetType) {
				case TargetType.PRODUCT:
					return action.productId && targetId === action.productId
				case TargetType.CUSTOMER:
					return action.customerId && targetId === action.customerId
				case TargetType.SUPPLIER:
					return action.supplierId && targetId === action.supplierId
				case TargetType.PARTNER:
					return action.partnerId && targetId === action.partnerId

				default:
					throw new Error('Invalid target type')
			}
		})

		let purchaseEntryType: EntryType
		let paymentEntryType: EntryType

		switch (targetType) {
			case TargetType.CUSTOMER:
				purchaseEntryType = DailyActionType.SELLING_ENTRY
				paymentEntryType = DailyActionType.RECEIPT_ENTRY
				break
			case TargetType.SUPPLIER:
				purchaseEntryType = DailyActionType.BUYING_ENTRY
				paymentEntryType = DailyActionType.PAYMENT_ENTRY
				break
			case TargetType.PARTNER:
				purchaseEntryType = DailyActionType.RECEIPT_ENTRY
				paymentEntryType = DailyActionType.PAYMENT_ENTRY
				break
			case TargetType.PRODUCT:
				purchaseEntryType = DailyActionType.SELLING_ENTRY
				paymentEntryType = DailyActionType.BUYING_ENTRY
				break

			default:
				throw new Error('Invalid target type')
		}

		const sumWeights = this.calculateWeights(relevantActions)

		const purchase = this.sumActionAmounts(relevantActions, purchaseEntryType)
		const payments = this.sumActionAmounts(relevantActions, paymentEntryType)
		const currency =
			relevantActions.find(action => action.currencyName || action.currencyId)
				?.currencyName ??
			relevantActions.find(action => action.currencyId)?.currencyId

		return {
			sumBuyingWeight: sumWeights.buying.toFixed(2) ?? '',
			sumSellingWeight: sumWeights.selling.toFixed(2) ?? '',
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
		const actionId = this.resolveSyncClientId(
			(requestBody as DailyActionRequestBody & { actionId?: string }).actionId,
		)

		const existingById = await withTenantScope(
			DailyAction.findOne({ actionId }).lean(),
			getTenantContext(requestContext).tenantId,
		)

		if (existingById) {
			return { _id: String(existingById._id), actionId: existingById.actionId }
		}

		const createdAt = new Date()
		const optionalString = (value?: string) => value?.trim() || undefined
		const dailyActionData = {
			actionId,
			entryType: requestBody.entryType,
			productId: optionalString(requestBody.productId),
			invoiceNumber: optionalString(requestBody.invoiceNumber),
			invoiceDate: requestBody.invoiceDate
				? new Date(requestBody.invoiceDate)
				: createdAt,
			productName: optionalString(requestBody.productName),
			supplierId: optionalString(requestBody.supplierId),
			supplierName: optionalString(requestBody.supplierName),
			partnerId: optionalString(requestBody.partnerId),
			partnerName: optionalString(requestBody.partnerName),
			customerId: optionalString(requestBody.customerId),
			customerName: optionalString(requestBody.customerName),
			expenseId: optionalString(requestBody.expenseId),
			expenseName: optionalString(requestBody.expenseName),
			currencyId: requestBody.currencyId,
			currencyName: requestBody.currencyName,
			unitId: optionalString(requestBody.unitId),
			unitName: optionalString(requestBody.unitName),
			weight: optionalString(requestBody.weight),
			singleUnitPrice: optionalString(requestBody.singleUnitPrice),
			totalPrice: optionalString(requestBody.totalPrice),
			note: optionalString(requestBody.note),
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

		return {
			_id: createDailyActionResponse._id,
			actionId: dailyActionData.actionId,
		}
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
		actionIds: string[],
		requestContext: RequestContext,
	) {
		const uniqueActionIds = Array.from(new Set(actionIds))

		const deleteResponse = await this.mongoDbClient.deleteDocuments(
			{
				collectionName: COLLECTION_NAMES.DAILY_ACTIONS,
				fieldName: 'actionId',
				fieldValues: uniqueActionIds,
			},
			requestContext,
			DailyAction,
		)

		for (const actionId of uniqueActionIds) {
			await this.invalidateDailyActionsCache(requestContext, actionId)
		}

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

	private calculateWeights(relevantActions: DailyActionResponse['data']): {
		buying: number
		selling: number
	} {
		return relevantActions.reduce(
			(acc, { entryType, weight }) => {
				const value = weight ? parseFloat(weight.replace(/,/g, '')) || 0 : 0

				switch (entryType) {
					case DailyActionType.BUYING_ENTRY:
						acc.buying += value
						break
					case DailyActionType.SELLING_ENTRY:
						acc.selling += value
						break
				}

				return acc
			},
			{ buying: 0, selling: 0 },
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
			User.findOne({ userId }, { role: 1 }),
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

		return tenants.map(tenant => mapTenantSummary(tenant))
	}

	public async patchTenant(
		tenantId: string,
		requestBody: {
			tenantName?: string
			status?: 'active' | 'inactive'
			accessiblePages?: string[]
			offlineEnabled?: boolean
		},
		requestContext: RequestContext,
	): Promise<TenantSummary> {
		ensureSuperAdmin(requestContext)

		const tenant = (await Tenant.findOne({ tenantId }).lean()) as ITenant | null

		if (!tenant) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Tenant not found.',
			)
		}

		const permissions = getTenantPermissions(tenant)
		const updates: Record<string, unknown> = {}

		if (
			requestBody.tenantName !== undefined ||
			requestBody.status !== undefined
		) {
			if (!permissions.canUpdate) {
				throw new BusinessLogicError(
					ERROR_CODES.AUTHORIZATION.FORBIDDEN,
					permissions.reason || 'Tenant cannot be modified.',
				)
			}
		}

		if (requestBody.accessiblePages !== undefined) {
			if (!permissions.canChangeTenantSettings) {
				throw new BusinessLogicError(
					ERROR_CODES.AUTHORIZATION.FORBIDDEN,
					permissions.reason || 'Tenant settings cannot be modified.',
				)
			}

			const sanitizedPages = sanitizeAccessiblePages(
				requestBody.accessiblePages,
			)

			if (sanitizedPages.length === 0) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
					'At least one accessible page is required.',
				)
			}

			if (sanitizedPages.length !== requestBody.accessiblePages.length) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
					'One or more accessible pages are invalid.....',
				)
			}

			updates.accessiblePages = sanitizedPages
		}

		if (requestBody.offlineEnabled !== undefined) {
			if (!permissions.canChangeTenantSettings) {
				throw new BusinessLogicError(
					ERROR_CODES.AUTHORIZATION.FORBIDDEN,
					permissions.reason || 'Tenant settings cannot be modified.',
				)
			}

			updates.offlineEnabled = requestBody.offlineEnabled
		}

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

		return mapTenantSummary(updated)
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
			accessiblePages: [...DEFAULT_TENANT_ACCESSIBLE_PAGES],
		})

		const owner = await User.create({
			tenantId,
			userId: uuidv4(),
			displayName: `${ownerFirstName.trim()} ${ownerLastName.trim()}`,
			user: {
				firstName: ownerFirstName.trim(),
				lastName: ownerLastName.trim(),
			},
			email: normalizedOwnerEmail,
			password: hashedPassword,
			role: 'owner',
			avatarColorId: Math.floor(Math.random() * 1000000),
			createdBy: {
				_id: requestContext.userId as string,
				displayName: `${ownerFirstName.trim()} ${ownerLastName.trim()}`,
				role: 'owner',
				createdAt: new Date(),
			},
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
		const dailyActions = await this.getDailyActions(requestContext)

		const data = partners.documents.map((partner: PartnerDocument) => ({
			partnerId: partner.partnerId,
			name: partner.name,
			internalCode: partner.internalCode,
			createdAt: partner.createdAt?.toISOString(),
			updatedAt: partner.updatedAt?.toISOString(),
			createdBy: partner.createdBy as any,
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

		const dailyActions = await this.getDailyActions(requestContext)

		const mappedPartners = mapPartners([
			{
				partnerId: partner.partnerId,
				name: partner.name,
				internalCode: partner.internalCode,
				createdAt: partner.createdAt?.toISOString(),
				updatedAt: partner.updatedAt?.toISOString(),
				createdBy: partner.createdBy as any,
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

		const partnerData: PartnerDocument = {
			tenantId: tenantContext.tenantId,
			_id: uuidv4(),
			partnerId,
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

		const supplierData: SupplierDocument = {
			supplierId,
			name: name,
			internalCode: internalCode?.trim() || undefined,
		} as SupplierDocument

		logger.info('Saving supplier to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			supplierId: supplierData.supplierId,
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
			supplierId: supplierData.supplierId,
			name,
		})

		await redisCache.del(
			redisCache.buildSupplierListKey(tenantContext.tenantId),
		)

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

		const data = customers.documents.map((customer: CustomerDocument) => ({
			customerId: customer.customerId,
			name: customer.name,
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
			relatedActions: filterCustomerRelatedActions(dailyActions.data, customer),
		}))

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
	): Promise<CustomerResponse | null> {
		const customer =
			await this.mongoDbClient.getDocumentByField<CustomerDocument>(
				requestContext,
				COLLECTION_NAMES.CUSTOMERS,
				Customer,
				{ fieldName: 'customerId', fieldValue: customerId },
			)

		if (!customer) {
			return null
		}

		const dailyActions = await this.getDailyActions(requestContext)

		return mapCustomer(
			customer,
			filterCustomerRelatedActions(dailyActions.data, customer),
		)
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

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Customer already exists in this tenant.',
			)
		}

		const customerId = this.resolveSyncClientId(requestBody.customerId)

		const existingById = await withTenantScope(
			Customer.findOne({ customerId }).lean(),
			tenantContext.tenantId,
		)

		if (existingById) {
			return {
				_id: String(existingById._id),
				customerId: existingById.customerId,
			}
		}

		const customerData: CustomerDocument = {
			customerId,
			internalCode: internalCode?.trim() || undefined,
			name,
		} as CustomerDocument

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

		logger.info('Customer created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			customerId: customerData.customerId,
			name,
		})

		await redisCache.del(
			redisCache.buildCustomerListKey(tenantContext.tenantId),
		)

		return {
			_id: createCustomerResponse._id,
		}
	}

	public async getExpenses(
		requestContext: RequestContext,
	): Promise<ExpensesResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildExpenseListKey(tenantId)
		const cachedExpenses = await redisCache.getJson<ExpensesResponse>(cacheKey)

		if (cachedExpenses) {
			return cachedExpenses
		}

		const expenses = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.EXPENSES,
			model: Expense,
			sort: { createdAt: 'desc' },
		})

		const dailyActions = await this.getDailyActions(requestContext)
		const data = expenses.documents.map((expense: ExpenseDocument) => ({
			expenseId: expense.expenseId,
			name: expense.name,
			internalCode: expense.internalCode,
			createdAt: expense.createdAt?.toISOString(),
			updatedAt: expense.updatedAt?.toISOString(),
			createdBy: expense.createdBy as any,
			updatedBy: expense.updatedBy
				? {
						...expense.updatedBy,
						updatedAt: expense.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
			actions: dailyActions.data.filter(
				action =>
					action.expenseId === expense.expenseId ||
					action.expenseId === expense.internalCode,
			),
		}))

		const response: ExpensesResponse = {
			data,
			totalCount: data.length,
		}

		await redisCache.setJson(cacheKey, response)

		return response
	}

	public async getExpense(
		expenseId: string,
		requestContext: RequestContext,
	): Promise<ExpensesResponse['data'][number] | null> {
		let expense = await this.mongoDbClient.getDocumentByField<ExpenseDocument>(
			requestContext,
			COLLECTION_NAMES.EXPENSES,
			Expense,
			{ fieldName: 'expenseId', fieldValue: expenseId },
		)

		if (!expense) {
			expense = await this.mongoDbClient.getDocumentByField<ExpenseDocument>(
				requestContext,
				COLLECTION_NAMES.EXPENSES,
				Expense,
				{ fieldName: 'internalCode', fieldValue: expenseId },
			)
		}

		if (!expense) {
			expense = await this.mongoDbClient.getDocumentByField<ExpenseDocument>(
				requestContext,
				COLLECTION_NAMES.EXPENSES,
				Expense,
				{ fieldName: '_id', fieldValue: expenseId },
			)
		}

		if (!expense) {
			return null
		}

		const dailyActions = await this.getDailyActions(requestContext)

		return {
			expenseId: expense.expenseId,
			name: expense.name,
			internalCode: expense.internalCode,
			createdAt: expense.createdAt?.toISOString(),
			updatedAt: expense.updatedAt?.toISOString(),
			createdBy: expense.createdBy as any,
			updatedBy: expense.updatedBy
				? {
						...expense.updatedBy,
						updatedAt: expense.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
			actions: dailyActions.data.filter(
				action =>
					action.expenseId === expense.expenseId ||
					action.expenseId === expense.internalCode,
			),
		}
	}

	public async postExpense(
		requestContext: RequestContext,
		requestBody: ExpenseRequestBody,
	): Promise<CreateExpenseResponse | null> {
		const { name, internalCode } = requestBody
		const tenantContext = getTenantContext(requestContext)

		if (!name || !name.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Expense name is required',
			)
		}

		const existing = await withTenantScope(
			Expense.findOne({
				name: new RegExp(`^${this.escapeRegex(name)}$`, 'i'),
			}),
			tenantContext.tenantId,
		).lean()

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Expense already exists in this tenant.',
			)
		}

		const expenseId = this.resolveSyncClientId(requestBody.expenseId)

		const existingById = await withTenantScope(
			Expense.findOne({ expenseId }).lean(),
			tenantContext.tenantId,
		)

		if (existingById) {
			return {
				_id: String(existingById._id),
				expenseId: existingById.expenseId,
			}
		}

		const expenseData: ExpenseDocument = {
			tenantId: tenantContext.tenantId,
			_id: uuidv4(),
			expenseId,
			name,
			internalCode: internalCode?.trim() || undefined,
			createdBy: {
				_id: requestContext.userId as string,
				displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
				role: requestContext.user?.role as TenantRole,
			},
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		logger.info('Saving expense to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			expenseId: expenseData.expenseId,
			name,
		})

		const createExpenseResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.EXPENSES, data: expenseData },
			Expense,
			requestContext,
		)

		await redisCache.del(redisCache.buildExpenseListKey(tenantContext.tenantId))

		return {
			_id: createExpenseResponse._id,
		}
	}

	public async patchExpense(
		expenseId: string,
		requestBody: Partial<Omit<ExpenseRequestBody, 'expenseId'>>,
		requestContext: RequestContext,
	) {
		await ensureTenantAccess(
			requestContext,
			COLLECTION_NAMES.EXPENSES,
			'update',
		)

		const { tenantId } = getTenantContext(requestContext)
		const updateData = {
			...requestBody,
			internalCode: requestBody.internalCode?.trim() || undefined,
			updatedBy: {
				_id: requestContext.userId as string,
				displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
				updatedAt: new Date(),
			},
		}

		const updated = await withTenantScope(
			Expense.findOneAndUpdate(
				{
					$or: [{ expenseId }, { _id: expenseId }, { internalCode: expenseId }],
				},
				{ $set: updateData },
				{ new: true, runValidators: true },
			),
			tenantId,
		).lean()

		if (!updated) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Expense not found.',
			)
		}

		await redisCache.del(redisCache.buildExpenseListKey(tenantId))

		return updated
	}

	public async deleteExpense(
		expenseId: string,
		requestContext: RequestContext,
	) {
		await ensureTenantAccess(
			requestContext,
			COLLECTION_NAMES.EXPENSES,
			'delete',
		)

		const { tenantId } = getTenantContext(requestContext)
		const deleted = await withTenantScope(
			Expense.findOneAndDelete({
				$or: [{ expenseId }, { _id: expenseId }, { internalCode: expenseId }],
			}).lean(),
			tenantId,
		)

		if (!deleted) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
				'Expense not found.',
			)
		}

		await redisCache.del(redisCache.buildExpenseListKey(tenantId))

		return deleted
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

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Currency already exists in this tenant.',
			)
		}

		const currencyId = this.resolveSyncClientId(requestBody.currencyId)

		const existingById = await withTenantScope(
			Currency.findOne({ currencyId }).lean(),
			tenantContext.tenantId,
		)

		if (existingById) {
			return {
				_id: String(existingById._id),
				currencyId: existingById.currencyId,
			}
		}

		const currencyData: CurrencyDocument = {
			tenantId: tenantContext.tenantId,
			_id: uuidv4(),
			name: name,
			currencyId,
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

		await redisCache.del(
			redisCache.buildCurrencyListKey(tenantContext.tenantId),
		)

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

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Unit already exists in this tenant.',
			)
		}

		const unitId = this.resolveSyncClientId(requestBody.unitId)

		const existingById = await withTenantScope(
			Unit.findOne({ unitId }).lean(),
			tenantContext.tenantId,
		)

		if (existingById) {
			return { _id: String(existingById._id), unitId: existingById.unitId }
		}

		const unitData: UnitDocument = {
			unitId,
			name: name,
			internalCode: internalCode?.trim() || undefined,
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
			unitId: unitData.unitId,
			name,
		})

		await redisCache.del(redisCache.buildUnitListKey(tenantContext.tenantId))

		return {
			_id: createUnitResponse._id,
		}
	}

	public async getBrands(
		requestContext: RequestContext,
	): Promise<BrandsResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildBrandListKey(tenantId)
		const cachedBrands = await redisCache.getJson<BrandsResponse>(cacheKey)

		if (cachedBrands) {
			return cachedBrands
		}

		const brands = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.BRANDS,
			model: Brand,
			sort: { name: 1 },
		})

		const data = brands.documents.map((brand: BrandDocument) => ({
			brandId: String(brand._id),
			name: brand.name,
			description: brand.description,
			createdAt: brand.createdAt?.toISOString?.(),
			updatedAt: brand.updatedAt?.toISOString?.(),
			createdBy: brand.createdBy as BrandsResponse['data'][number]['createdBy'],
			updatedBy: brand.updatedBy
				? {
						...brand.updatedBy,
						updatedAt: brand.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
		}))

		const response: BrandsResponse = {
			data,
			totalCount: data.length,
		}

		await redisCache.setJson(cacheKey, response)

		return response
	}

	public async getBrand(
		brandId: string,
		requestContext: RequestContext,
	): Promise<BrandsResponse['data'][number] | null> {
		const brand = await this.mongoDbClient.getDocumentByField<BrandDocument>(
			requestContext,
			COLLECTION_NAMES.BRANDS,
			Brand,
			{ fieldName: '_id', fieldValue: brandId },
		)

		if (!brand) {
			return null
		}

		return {
			brandId: String(brand._id),
			name: brand.name,
			description: brand.description,
			createdAt: brand.createdAt?.toISOString?.(),
			updatedAt: brand.updatedAt?.toISOString?.(),
			createdBy: brand.createdBy as BrandsResponse['data'][number]['createdBy'],
			updatedBy: brand.updatedBy
				? {
						...brand.updatedBy,
						updatedAt: brand.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
		}
	}

	public async postBrand(
		requestBody: BrandRequestBody,
		requestContext: RequestContext,
	): Promise<CreateBrandResponse | null> {
		const tenantContext = getTenantContext(requestContext)

		if (!requestBody.name?.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Brand name is required',
			)
		}

		const existing = await withTenantScope(
			Brand.findOne({
				name: new RegExp(`^${this.escapeRegex(requestBody.name)}$`, 'i'),
			}),
			tenantContext.tenantId,
		).lean()

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Brand already exists in this tenant.',
			)
		}

		const brandData = {
			name: requestBody.name.trim(),
			description: requestBody.description?.trim(),
		}

		logger.info('Saving brand to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			name: brandData.name,
		})

		const createBrandResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.BRANDS, data: brandData },
			Brand,
			requestContext,
		)

		logger.info('Brand created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			brandId: createBrandResponse._id,
			name: brandData.name,
		})

		await redisCache.del(redisCache.buildBrandListKey(tenantContext.tenantId))

		return { _id: createBrandResponse._id }
	}

	public async getShelves(
		requestContext: RequestContext,
	): Promise<ShelvesResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildShelfListKey(tenantId)
		const cachedShelves = await redisCache.getJson<ShelvesResponse>(cacheKey)

		if (cachedShelves) {
			return cachedShelves
		}

		const shelves = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.SHELVES,
			model: Shelf,
			sort: { name: 1 },
		})

		const data = shelves.documents.map((shelf: ShelfDocument) => ({
			shelfId: shelf.shelfId,
			name: shelf.name,
			description: shelf.description,
			createdAt: shelf.createdAt?.toISOString?.(),
			updatedAt: shelf.updatedAt?.toISOString?.(),
			createdBy:
				shelf.createdBy as ShelvesResponse['data'][number]['createdBy'],
			updatedBy: shelf.updatedBy
				? {
						...shelf.updatedBy,
						updatedAt: shelf.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
		}))

		const response: ShelvesResponse = {
			data,
			totalCount: data.length,
		}

		await redisCache.setJson(cacheKey, response)

		return response
	}

	public async getShelf(
		shelfId: string,
		requestContext: RequestContext,
	): Promise<ShelvesResponse['data'][number] | null> {
		const shelf = await this.mongoDbClient.getDocumentByField<ShelfDocument>(
			requestContext,
			COLLECTION_NAMES.SHELVES,
			Shelf,
			{ fieldName: 'shelfId', fieldValue: shelfId },
		)

		if (!shelf) {
			return null
		}

		return {
			shelfId: shelf.shelfId,
			name: shelf.name,
			description: shelf.description,
			createdAt: shelf.createdAt?.toISOString?.(),
			updatedAt: shelf.updatedAt?.toISOString?.(),
			createdBy:
				shelf.createdBy as ShelvesResponse['data'][number]['createdBy'],
			updatedBy: shelf.updatedBy
				? {
						...shelf.updatedBy,
						updatedAt: shelf.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
		}
	}

	public async postShelf(
		requestBody: ShelfRequestBody,
		requestContext: RequestContext,
	): Promise<CreateShelfResponse | null> {
		const tenantContext = getTenantContext(requestContext)

		if (!requestBody.name?.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Shelf name is required',
			)
		}

		const shelfId = requestBody.shelfId?.trim() || uuidv4()

		const existing = await withTenantScope(
			Shelf.findOne({ shelfId }),
			tenantContext.tenantId,
		).lean()

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Shelf already exists in this tenant.',
			)
		}

		const shelfData = {
			shelfId,
			name: requestBody.name.trim(),
			description: requestBody.description?.trim(),
		}

		logger.info('Saving shelf to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			shelfId: shelfData.shelfId,
			name: shelfData.name,
		})

		const createShelfResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.SHELVES, data: shelfData },
			Shelf,
			requestContext,
		)

		logger.info('Shelf created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			shelfId: shelfData.shelfId,
			name: shelfData.name,
		})

		await redisCache.del(redisCache.buildShelfListKey(tenantContext.tenantId))

		return { _id: createShelfResponse._id }
	}

	public async getWarehouses(
		requestContext: RequestContext,
	): Promise<WarehousesResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildWarehouseListKey(tenantId)
		const cachedWarehouses =
			await redisCache.getJson<WarehousesResponse>(cacheKey)

		if (cachedWarehouses) {
			return cachedWarehouses
		}

		const warehouses = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.WAREHOUSES,
			model: Warehouse,
			sort: { name: 1 },
		})

		const data = warehouses.documents.map((warehouse: WarehouseDocument) => ({
			warehouseId: warehouse.warehouseId,
			name: warehouse.name,
			code: warehouse.code,
			address: warehouse.address,
			status: warehouse.status,
			description: warehouse.description,
			createdAt: warehouse.createdAt?.toISOString?.(),
			updatedAt: warehouse.updatedAt?.toISOString?.(),
			createdBy:
				warehouse.createdBy as WarehousesResponse['data'][number]['createdBy'],
			updatedBy: warehouse.updatedBy
				? {
						...warehouse.updatedBy,
						updatedAt: warehouse.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
		}))

		const response: WarehousesResponse = {
			data,
			totalCount: data.length,
		}

		await redisCache.setJson(cacheKey, response)

		return response
	}

	public async getWarehouse(
		warehouseId: string,
		requestContext: RequestContext,
	): Promise<WarehousesResponse['data'][number] | null> {
		const warehouse =
			await this.mongoDbClient.getDocumentByField<WarehouseDocument>(
				requestContext,
				COLLECTION_NAMES.WAREHOUSES,
				Warehouse,
				{ fieldName: 'warehouseId', fieldValue: warehouseId },
			)

		if (!warehouse) {
			return null
		}

		return {
			warehouseId: warehouse.warehouseId,
			name: warehouse.name,
			code: warehouse.code,
			address: warehouse.address,
			status: warehouse.status,
			description: warehouse.description,
			createdAt: warehouse.createdAt?.toISOString?.(),
			updatedAt: warehouse.updatedAt?.toISOString?.(),
			createdBy:
				warehouse.createdBy as WarehousesResponse['data'][number]['createdBy'],
			updatedBy: warehouse.updatedBy
				? {
						...warehouse.updatedBy,
						updatedAt: warehouse.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
		}
	}

	public async postWarehouse(
		requestBody: WarehouseRequestBody,
		requestContext: RequestContext,
	): Promise<CreateWarehouseResponse | null> {
		const tenantContext = getTenantContext(requestContext)

		if (!requestBody.name?.trim()) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Warehouse name is required',
			)
		}

		const warehouseId = requestBody.warehouseId?.trim() || uuidv4()

		const existing = await withTenantScope(
			Warehouse.findOne({ warehouseId }),
			tenantContext.tenantId,
		).lean()

		if (existing) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Warehouse already exists in this tenant.',
			)
		}

		const warehouseData = {
			warehouseId,
			name: requestBody.name.trim(),
			code: requestBody.code?.trim(),
		}

		logger.info('Saving warehouse to database.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			warehouseId: warehouseData.warehouseId,
			name: warehouseData.name,
		})

		const createWarehouseResponse = await this.mongoDbClient.createDocument(
			{ collectionName: COLLECTION_NAMES.WAREHOUSES, data: warehouseData },
			Warehouse,
			requestContext,
		)

		logger.info('Warehouse created successfully.', {
			entity: EntityType.MONGODB,
			tenantId: tenantContext.tenantId,
			warehouseId: warehouseData.warehouseId,
			name: warehouseData.name,
		})

		await redisCache.del(
			redisCache.buildWarehouseListKey(tenantContext.tenantId),
		)

		return { _id: createWarehouseResponse._id }
	}

	private async getProcessedSyncMutation(
		requestContext: RequestContext,
		clientMutationId: string,
	): Promise<{
		result?: Record<string, unknown>
		error?: string
	} | null> {
		const tenantContext = getTenantContext(requestContext)

		return withTenantScope(
			SyncMutation.findOne({ clientMutationId }).lean(),
			tenantContext.tenantId,
		)
	}

	private async recordSyncMutation(
		requestContext: RequestContext,
		clientMutationId: string,
		entity: string,
		operation: string,
		result?: Record<string, unknown>,
		error?: string,
	) {
		const tenantContext = getTenantContext(requestContext)

		await withTenantScope(
			SyncMutation.findOneAndUpdate(
				{ clientMutationId },
				{
					clientMutationId,
					entity,
					operation,
					result,
					error,
					processedAt: new Date(),
				},
				{ upsert: true, new: true },
			),
			tenantContext.tenantId,
		)
	}

	private async getDocumentsSince(
		requestContext: RequestContext,
		collectionName: (typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES],
		model: any,
		since: Date,
	) {
		const tenantContext = getTenantContext(requestContext)

		return withTenantScope(
			model.find({ updatedAt: { $gte: since } }).lean(),
			tenantContext.tenantId,
		)
	}

	private getOfflineRetentionCutoff(): Date {
		const cutoff = new Date()

		cutoff.setDate(cutoff.getDate() - config.offlineSyncRetentionDays)
		cutoff.setHours(0, 0, 0, 0)

		return cutoff
	}

	private async getInvoicesForOfflineBootstrap(
		requestContext: RequestContext,
	): Promise<Array<Record<string, unknown>>> {
		const tenantContext = getTenantContext(requestContext)
		const cutoff = this.getOfflineRetentionCutoff()

		return withTenantScope(
			Invoice.find({
				$or: [
					{ issuedAt: { $gte: cutoff } },
					{
						paymentType: 'credit',
						paymentStatus: { $in: ['unpaid', 'partial'] },
					},
				],
			})
				.sort({ createdAt: -1 })
				.lean(),
			tenantContext.tenantId,
		) as Promise<Array<Record<string, unknown>>>
	}

	private async getDailyActionsForOfflineBootstrap(
		requestContext: RequestContext,
	): Promise<DailyActionResponse['data']> {
		const tenantContext = getTenantContext(requestContext)
		const cutoff = this.getOfflineRetentionCutoff()

		return withTenantScope(
			DailyAction.find({ invoiceDate: { $gte: cutoff } })
				.sort({ createdAt: -1 })
				.lean(),
			tenantContext.tenantId,
		) as Promise<DailyActionResponse['data']>
	}

	public async getSyncBootstrap(
		requestContext: RequestContext,
	): Promise<SyncBootstrapResponse> {
		await this.ensureOfflineEnabledForSync(requestContext)

		const tenantId = this.getTenantId(requestContext)

		await this.invalidateAllTenantListCaches(tenantId)

		const productsResponse = await this.mongoDbClient.getDocuments({
			requestContext,
			collectionName: COLLECTION_NAMES.PRODUCTS,
			model: Product,
			sort: { createdAt: 'desc' },
		})

		const [
			inventory,
			customersResponse,
			suppliersResponse,
			partnersResponse,
			categoriesResponse,
			brandsResponse,
			shelvesResponse,
			warehousesResponse,
			currenciesResponse,
			unitsResponse,
			expensesResponse,
			offlineDailyActions,
			offlineInvoices,
		] = await Promise.all([
			this.getInventory(requestContext),
			this.getCustomers(requestContext),
			this.getSuppliers(requestContext),
			this.getPartners(requestContext),
			this.getCategories(requestContext),
			this.getBrands(requestContext),
			this.getShelves(requestContext),
			this.getWarehouses(requestContext),
			this.getCurrencies(requestContext),
			this.getUnits(requestContext),
			this.getExpenses(requestContext),
			this.getDailyActionsForOfflineBootstrap(requestContext),
			this.getInvoicesForOfflineBootstrap(requestContext),
		])

		const tenantContext = getTenantContext(requestContext)
		const userSettings = await withTenantScope(
			UserSettings.findOne({
				userId: requestContext.userId,
			}).lean(),
			tenantContext.tenantId,
		)

		const nextInvoiceNumberBlock =
			await this.allocateOfflineInvoiceBlock(requestContext)

		const { frontendResources } = requestContext.userId
			? await this.getUserFrontendResources(
					requestContext.userId,
					requestContext,
				)
			: { frontendResources: [] }

		return {
			products: productsResponse.documents as unknown as Array<
				Record<string, unknown>
			>,
			inventory: inventory as unknown as Array<Record<string, unknown>>,
			customers: customersResponse.data as unknown as Array<
				Record<string, unknown>
			>,
			suppliers: suppliersResponse.data as unknown as Array<
				Record<string, unknown>
			>,
			partners: partnersResponse.data as unknown as Array<
				Record<string, unknown>
			>,
			categories: categoriesResponse.data as unknown as Array<
				Record<string, unknown>
			>,
			brands: brandsResponse.data as unknown as Array<Record<string, unknown>>,
			shelves: shelvesResponse.data as unknown as Array<
				Record<string, unknown>
			>,
			warehouses: warehousesResponse.data as unknown as Array<
				Record<string, unknown>
			>,
			currencies: currenciesResponse.data as unknown as Array<
				Record<string, unknown>
			>,
			units: unitsResponse.data as unknown as Array<Record<string, unknown>>,
			expenses: expensesResponse.data as unknown as Array<
				Record<string, unknown>
			>,
			dailyActions: offlineDailyActions as unknown as Array<
				Record<string, unknown>
			>,
			invoices: offlineInvoices,
			userSettings: userSettings as Record<string, unknown> | undefined,
			frontendResources,
			nextInvoiceNumber: nextInvoiceNumberBlock.nextInvoiceNumber,
			invoiceNumberBlockEnd: nextInvoiceNumberBlock.invoiceNumberBlockEnd,
			serverTime: new Date().toISOString(),
			offlineRetentionDays: config.offlineSyncRetentionDays,
		}
	}

	private mapCategoryDocumentsForSync(
		categories: CategoryDocument[],
	): Array<Record<string, unknown>> {
		return categories.map(category => ({
			categoryId: category.categoryId,
			name: category.name,
			description: category.description,
			parentCategoryId: category.parentCategoryId,
			createdAt: category.createdAt?.toISOString?.(),
			updatedAt: category.updatedAt?.toISOString?.(),
			createdBy: category.createdBy,
			updatedBy: category.updatedBy,
		}))
	}

	private mapShelfDocumentsForSync(
		shelves: ShelfDocument[],
	): Array<Record<string, unknown>> {
		return shelves.map(shelf => ({
			shelfId: shelf.shelfId,
			name: shelf.name,
			description: shelf.description,
			createdAt: shelf.createdAt?.toISOString?.(),
			updatedAt: shelf.updatedAt?.toISOString?.(),
			createdBy: shelf.createdBy,
			updatedBy: shelf.updatedBy
				? {
						...shelf.updatedBy,
						updatedAt: shelf.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
		}))
	}

	private mapWarehouseDocumentsForSync(
		warehouses: WarehouseDocument[],
	): Array<Record<string, unknown>> {
		return warehouses.map(warehouse => ({
			warehouseId: warehouse.warehouseId,
			name: warehouse.name,
			code: warehouse.code,
			address: warehouse.address,
			status: warehouse.status,
			description: warehouse.description,
			createdAt: warehouse.createdAt?.toISOString?.(),
			updatedAt: warehouse.updatedAt?.toISOString?.(),
			createdBy: warehouse.createdBy,
			updatedBy: warehouse.updatedBy
				? {
						...warehouse.updatedBy,
						updatedAt: warehouse.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
		}))
	}

	private mapBrandDocumentsForSync(
		brands: BrandDocument[],
	): Array<Record<string, unknown>> {
		return brands.map(brand => ({
			brandId: String(brand._id),
			name: brand.name,
			description: brand.description,
			createdAt: brand.createdAt?.toISOString?.(),
			updatedAt: brand.updatedAt?.toISOString?.(),
			createdBy: brand.createdBy,
			updatedBy: brand.updatedBy
				? {
						...brand.updatedBy,
						updatedAt: brand.updatedBy.updatedAt.toISOString(),
					}
				: undefined,
		}))
	}

	private extractSyncPathId(url: string): string {
		const path = url.replace(/^\//, '').split('?')[0]
		const segments = path.split('/')

		return segments.length > 1 ? segments[segments.length - 1] : ''
	}

	private async updateUserSettingsFromSync(
		requestContext: RequestContext,
		payload: Partial<
			Pick<IUserSettings, 'productsPerPage' | 'displayLanguage'>
		>,
	): Promise<Record<string, unknown>> {
		const tenantContext = getTenantContext(requestContext)
		const updateData: Partial<IUserSettings> = {}

		if (payload.productsPerPage !== undefined) {
			updateData.productsPerPage = payload.productsPerPage
		}

		if (payload.displayLanguage !== undefined) {
			updateData.displayLanguage = payload.displayLanguage
		}

		const userSettings = await withTenantScope(
			UserSettings.findOneAndUpdate(
				{ userId: requestContext.userId },
				updateData,
				{ new: true, upsert: true },
			).lean(),
			tenantContext.tenantId,
		)

		return (userSettings ?? {}) as Record<string, unknown>
	}

	public async getSyncChanges(
		requestContext: RequestContext,
		since: Date,
	): Promise<Partial<SyncBootstrapResponse>> {
		await this.ensureOfflineEnabledForSync(requestContext)

		const [
			products,
			inventory,
			customers,
			suppliers,
			partners,
			categories,
			brands,
			shelves,
			warehouses,
			currencies,
			units,
			expenses,
			dailyActions,
			invoices,
		] = await Promise.all([
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.PRODUCTS,
				Product,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.INVENTORY,
				Inventory,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.CUSTOMERS,
				Customer,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.SUPPLIERS,
				Supplier,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.PARTNERS,
				Partner,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.CATEGORIES,
				Category,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.BRANDS,
				Brand,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.SHELVES,
				Shelf,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.WAREHOUSES,
				Warehouse,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.CURRENCIES,
				Currency,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.UNITS,
				Unit,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.EXPENSES,
				Expense,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.DAILY_ACTIONS,
				DailyAction,
				since,
			),
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.INVOICES,
				Invoice,
				since,
			),
		])

		return {
			products: products as unknown as Array<Record<string, unknown>>,
			inventory: inventory as unknown as Array<Record<string, unknown>>,
			customers: customers as unknown as Array<Record<string, unknown>>,
			suppliers: suppliers as unknown as Array<Record<string, unknown>>,
			partners: partners as unknown as Array<Record<string, unknown>>,
			categories: this.mapCategoryDocumentsForSync(
				categories as unknown as CategoryDocument[],
			),
			brands: this.mapBrandDocumentsForSync(
				brands as unknown as BrandDocument[],
			),
			shelves: this.mapShelfDocumentsForSync(
				shelves as unknown as ShelfDocument[],
			),
			warehouses: this.mapWarehouseDocumentsForSync(
				warehouses as unknown as WarehouseDocument[],
			),
			currencies: currencies as unknown as Array<Record<string, unknown>>,
			units: units as unknown as Array<Record<string, unknown>>,
			expenses: expenses as unknown as Array<Record<string, unknown>>,
			dailyActions: dailyActions as unknown as Array<Record<string, unknown>>,
			invoices: invoices as unknown as Array<Record<string, unknown>>,
			serverTime: new Date().toISOString(),
		}
	}

	private async processSyncPushEntry(
		requestContext: RequestContext,
		entry: SyncPushRequestBody['entries'][number],
	): Promise<SyncPushResult> {
		const processed = await this.getProcessedSyncMutation(
			requestContext,
			entry.clientMutationId,
		)

		if (processed?.result) {
			return {
				clientMutationId: entry.clientMutationId,
				success: true,
				data: processed.result as Record<string, unknown>,
			}
		}

		try {
			const payload = entry.payload ?? {}
			let data: Record<string, unknown> | undefined

			if (entry.entity === 'invoice' && entry.method === 'POST') {
				data = (await this.postInvoice(
					{
						...(payload as InvoiceRequestBody),
						clientMutationId: entry.clientMutationId,
					},
					requestContext,
				)) as Record<string, unknown>
			} else if (entry.entity === 'product' && entry.method === 'POST') {
				data = (await this.postProduct(
					payload as ProductRequestBody,
					requestContext,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'customer' && entry.method === 'POST') {
				data = (await this.postCustomer(
					requestContext,
					payload as CustomerRequestBody,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'supplier' && entry.method === 'POST') {
				data = (await this.postSupplier(
					requestContext,
					payload as SupplierRequestBody,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'partner' && entry.method === 'POST') {
				data = (await this.postPartner(
					requestContext,
					payload as PartnerRequestBody,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'expense' && entry.method === 'POST') {
				data = (await this.postExpense(
					requestContext,
					payload as ExpenseRequestBody,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'dailyAction' && entry.method === 'POST') {
				data = (await this.postDailyAction(
					payload as unknown as DailyActionRequestBody,
					requestContext,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'category' && entry.method === 'POST') {
				data = (await this.postCategory(
					payload as CategoryRequestBody,
					requestContext,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'brand' && entry.method === 'POST') {
				data = (await this.postBrand(
					payload as BrandRequestBody,
					requestContext,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'currency' && entry.method === 'POST') {
				data = (await this.postCurrency(
					requestContext,
					payload as CurrencyRequestBody,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'unit' && entry.method === 'POST') {
				data = (await this.postUnit(
					requestContext,
					payload as UnitRequestBody,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'shelf' && entry.method === 'POST') {
				const shelfId = String(
					(payload as ShelfRequestBody).shelfId ?? '',
				).trim()

				data = (await this.postShelf(
					payload as ShelfRequestBody,
					requestContext,
				)) as Record<string, unknown>

				data = {
					...data,
					shelfId: shelfId || (payload as ShelfRequestBody).shelfId,
				}

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'warehouse' && entry.method === 'POST') {
				const warehouseId = String(
					(payload as WarehouseRequestBody).warehouseId ?? '',
				).trim()

				data = (await this.postWarehouse(
					payload as WarehouseRequestBody,
					requestContext,
				)) as Record<string, unknown>

				data = {
					...data,
					warehouseId:
						warehouseId || (payload as WarehouseRequestBody).warehouseId,
				}

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'product' && entry.method === 'PATCH') {
				const productId = this.extractSyncPathId(entry.url)

				await this.patchProduct(
					productId,
					payload as unknown as ProductDocument,
					requestContext,
				)

				data = { success: true }

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'product' && entry.method === 'DELETE') {
				const productId = this.extractSyncPathId(entry.url)

				await this.deleteProduct(productId, requestContext)
				data = { success: true }

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'dailyAction' && entry.method === 'PATCH') {
				const actionId = this.extractSyncPathId(entry.url)

				await this.patchDailyAction(
					actionId,
					payload as Record<string, unknown>,
					requestContext,
				)

				data = { success: true }

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'dailyAction' && entry.method === 'DELETE') {
				const actionIds = Array.isArray(payload.actionIds)
					? (payload.actionIds as string[])
					: [this.extractSyncPathId(entry.url)].filter(Boolean)

				await this.deleteDailyAction(actionIds, requestContext)
				data = { success: true }

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'userSettings' && entry.method === 'PATCH') {
				data = await this.updateUserSettingsFromSync(
					requestContext,
					payload as Partial<
						Pick<IUserSettings, 'productsPerPage' | 'displayLanguage'>
					>,
				)

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'expense' && entry.method === 'PATCH') {
				const expenseId = this.extractSyncPathId(entry.url)

				await this.patchExpense(
					expenseId,
					payload as Partial<Omit<ExpenseRequestBody, 'expenseId'>>,
					requestContext,
				)

				data = { success: true, expenseId }

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'expense' && entry.method === 'DELETE') {
				const expenseId = this.extractSyncPathId(entry.url)

				await this.deleteExpense(expenseId, requestContext)
				data = { success: true, expenseId }

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					`Unsupported sync entry: ${entry.entity} ${entry.method}`,
				)
			}

			return {
				clientMutationId: entry.clientMutationId,
				success: true,
				data,
			}
		} catch (error: any) {
			const message = error?.message ?? 'Sync entry processing failed'

			await this.recordSyncMutation(
				requestContext,
				entry.clientMutationId,
				entry.entity,
				entry.operation,
				undefined,
				message,
			)

			return {
				clientMutationId: entry.clientMutationId,
				success: false,
				error: message,
			}
		}
	}

	public async pushSyncChanges(
		requestContext: RequestContext,
		requestBody: SyncPushRequestBody,
	): Promise<SyncPushResponse> {
		await this.ensureOfflineEnabledForSync(requestContext)

		const tenantId = this.getTenantId(requestContext)
		const retryClientMutationIds = requestBody.retryClientMutationIds ?? []

		if (retryClientMutationIds.length > 0) {
			await SyncMutation.deleteMany({
				clientMutationId: { $in: retryClientMutationIds },
				tenantId,
			})
		}

		const results: SyncPushResult[] = []

		for (const entry of requestBody.entries ?? []) {
			results.push(await this.processSyncPushEntry(requestContext, entry))
		}

		return {
			results,
			serverTime: new Date().toISOString(),
		}
	}
}
