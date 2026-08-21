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
	AuthorizationError,
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
import CurrencySettings, {
	ICurrencySettingItem,
} from '../models/CurrencySettings'
import InvoiceSettings from '../models/InvoiceSettings'
import { Order } from '../models/Order'
import { Invoice } from '../models/Invoice'
import { BuyingInvoice } from '../models/BuyingInvoices'
import { Inventory } from '../models/Inventory'
import { DailyAction } from '../models/DailyAction'
import { ERROR_CODES } from '../shared/errorCodes'
import logger, { EntityType } from '../shared/logger/logger'
import MongodbController from '../shared/mongodb/mongodbController'
import { withTenantScope } from '../shared/mongodb/tenantScopedModel'
import {
	mergeProductPricePatch,
	normalizeInventoryPatchRequest,
	normalizeProductPatchRequest,
} from './productHelper/productPatchNormalize'
import {
	filterProductRelatedActions,
	mapProductAction,
} from './mappings/mapper'
import CustomerController from './customer/api.controller'
import SupplierController from './supplier/api.controller'
import CategoryController from './category/api.controller'
import PartnerController from './partner/api.controller'
import SettingController from './setting/api.controller'
import SellingInvoiceController from './selling-invoice/api.controller'
import BuyingInvoiceController from './buying-invoice/api.controller'
import {
	CreateProductResponse,
	InventoryRequestBody,
	InvoiceRequestBody,
	OrderRequestBody,
	ProductDocument,
	ProductRequestBody,
	ProductCatalogItem,
	ProductCatalogResponse,
	RequestContext,
	ProductAPI,
	SupplierRequestBody,
	CustomerRequestBody,
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
	InventoryDocument,
	CategoryRequestBody,
	CategoryDocument,
	CustomerInvoiceSummary,
	SupplierInvoiceSummary,
	BuyingInvoiceRequestBody,
	BrandRequestBody,
	ShelfRequestBody,
	WarehouseRequestBody,
	BrandDocument,
	ShelfDocument,
	WarehouseDocument,
	CreateBrandResponse,
	CreateShelfResponse,
	CreateWarehouseResponse,
	SyncBootstrapResponse,
	SyncPushRequestBody,
	SyncPushResponse,
	SyncPushResult,
} from '../shared/types'
import {
	CreateDailyActionResponse,
	CurrenciesResponse,
	DailyActionRequestBody,
	DailyActionResponse,
	EntryType,
	ExpensesResponse,
	LoginData,
	UnitsResponse,
	BrandsResponse,
	ShelvesResponse,
	WarehousesResponse,
} from '../shared/types/api'
import ProductsMapper, {
	ProductRelationLookups,
} from './mappings/ProductsMapper'
import { TenantAccessiblePage } from '../shared/constants/tenantAccessiblePages'
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
	assertPersistedUserMayAuthenticate,
	TenantRole,
} from '../shared/tenant'
import { COLLECTION_NAMES } from '../shared/general'
import {
	assertProductDeletable,
	deleteProductInventory,
	findProductDeleteBlocks,
} from '../shared/productImport/service'
import { redisCache } from '../shared/cache/redisCache'
import {
	syncTenantSubscription,
	tenantMaySignIn,
} from '../shared/subscription/persist'
import { getPrimaryInvoiceCurrencyAmounts } from '../shared/invoiceCurrency'
import { mapInvoiceFiltersToUiStatus } from '../shared/constants'
import {
	formatInvoiceNumber,
	isPrefixedInvoiceNumber,
	parseInvoiceSequence,
	type InvoiceNumberPrefix,
} from '../shared/invoiceNumbering'
import type { Workbook } from 'exceljs'
import { generateDailyActionsExcel } from '../shared/files/excel'
import { Partner } from '../models/Partner'
import {
	DailyActionType,
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
	InvoiceUiStatus,
	TargetType,
} from '../shared/globalEnums'
import { Category } from '../models/Category'
import { Brand } from '../models/Brand'
import { Shelf } from '../models/Shelf'
import { Warehouse } from '../models/Warehaus'
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
	private customerController?: CustomerController
	private supplierController?: SupplierController
	private categoryController?: CategoryController
	private partnerController?: PartnerController
	private settingController?: SettingController
	private sellingInvoiceController?: SellingInvoiceController
	private buyingInvoiceController?: BuyingInvoiceController

	constructor(
		private productsMapper: ProductsMapper,
		private mongoDbClient: MongodbController,
	) {}

	public setCustomerController(customerController: CustomerController): void {
		this.customerController = customerController
	}

	public setSupplierController(supplierController: SupplierController): void {
		this.supplierController = supplierController
	}

	public setCategoryController(categoryController: CategoryController): void {
		this.categoryController = categoryController
	}

	public setPartnerController(partnerController: PartnerController): void {
		this.partnerController = partnerController
	}

	public setSettingController(settingController: SettingController): void {
		this.settingController = settingController
	}

	public setSellingInvoiceController(
		sellingInvoiceController: SellingInvoiceController,
	): void {
		this.sellingInvoiceController = sellingInvoiceController
	}

	public setBuyingInvoiceController(
		buyingInvoiceController: BuyingInvoiceController,
	): void {
		this.buyingInvoiceController = buyingInvoiceController
	}

	private requireCustomerController(): CustomerController {
		if (!this.customerController) {
			throw new Error('CustomerController is not set')
		}

		return this.customerController
	}

	private requireSupplierController(): SupplierController {
		if (!this.supplierController) {
			throw new Error('SupplierController is not set')
		}

		return this.supplierController
	}

	private requireCategoryController(): CategoryController {
		if (!this.categoryController) {
			throw new Error('CategoryController is not set')
		}

		return this.categoryController
	}

	private requirePartnerController(): PartnerController {
		if (!this.partnerController) {
			throw new Error('PartnerController is not set')
		}

		return this.partnerController
	}

	private requireSettingController(): SettingController {
		if (!this.settingController) {
			throw new Error('SettingController is not set')
		}

		return this.settingController
	}

	private requireSellingInvoiceController(): SellingInvoiceController {
		if (!this.sellingInvoiceController) {
			throw new Error('SellingInvoiceController is not set')
		}

		return this.sellingInvoiceController
	}

	private requireBuyingInvoiceController(): BuyingInvoiceController {
		if (!this.buyingInvoiceController) {
			throw new Error('BuyingInvoiceController is not set')
		}

		return this.buyingInvoiceController
	}

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
			this.requireCategoryController().getCategories(requestContext),
			this.requireSupplierController().getSuppliers(requestContext),
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

	public async invalidateEntityCache(
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
			config.jwtSecret,
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

		const { tenant: synced } = await syncTenantSubscription(tenant)

		if (!tenantMaySignIn(synced)) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INACTIVE_TENANT,
				'Tenant is inactive. Contact the platform admin.',
			)
		}

		return synced
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
		}).lean()) as ITenant | null

		if (!tenant) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Tenant is not active.',
			)
		}

		const { tenant: synced } = await syncTenantSubscription(tenant)

		if (synced.status !== 'active') {
			throw new AuthorizationError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Tenant is not active.',
			)
		}

		return resolveAccessiblePagesForTenant(synced)
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

	public async ensureOrderBelongsToTenant(
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
		const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload

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

		assertPersistedUserMayAuthenticate(user)

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

		assertPersistedUserMayAuthenticate(user)

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

		assertPersistedUserMayAuthenticate(user)

		const tenant = (await Tenant.findOne({
			tenantId: storedToken.tenantId,
		}).lean()) as ITenant | null

		if (!tenant) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INACTIVE_TENANT,
				'Tenant is inactive. Contact the platform admin.',
			)
		}

		const { tenant: synced } = await syncTenantSubscription(tenant)

		if (!tenantMaySignIn(synced)) {
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
		const limit = Math.min(pagination?.limit || 20, 100)
		const offset = pagination?.offset || 0

		const searchText = filters.searchText?.trim()
		const supplierRegexList = this.buildCaseInsensitiveRegexList(
			filters.supplier,
		)
		const brandRegexList = this.buildCaseInsensitiveRegexList(filters.brand)
		const categoryRegexList = this.buildCaseInsensitiveRegexList(
			filters.category,
		)
		const statuses = (filters.state ?? [])
			.map(state => state.trim())
			.filter(Boolean)

		const productQueryClauses: Record<string, unknown>[] = []

		if (searchText) {
			// note: unanchored name regex cannot use { tenantId, name } at 100k; upgrade to prefix / text index / Atlas Search
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

		if (statuses.length > 0) {
			productQueryClauses.push({
				status: { $in: statuses },
			})
		}

		const mongoQuery =
			productQueryClauses.length > 0 ? { $and: productQueryClauses } : {}

		const [products, totalCount, relationLookups] = await Promise.all([
			withTenantScope(
				Product.find(mongoQuery).sort({ name: 1 }).skip(offset).limit(limit),
				tenantId,
			).lean<ProductAPI[]>(),
			Product.countDocuments({ tenantId, ...mongoQuery }),
			this.getProductRelationLookups(requestContext),
		])

		const productIds = products.map(product => product.productId)
		const inventory =
			productIds.length === 0
				? []
				: await withTenantScope(
						Inventory.find({ productId: { $in: productIds } }),
						tenantId,
					).lean<InventoryDocument[]>()
		const inventoryByProductId = new Map(
			inventory.map(inventoryItem => [inventoryItem.productId, inventoryItem]),
		)

		const mappedProducts = products
			.map(product =>
				this.productsMapper.mapProduct(
					product,
					inventoryByProductId.get(product.productId),
					requestContext,
					relationLookups,
				),
			)
			.filter(Boolean) as ProductRequestBody[]

		logger.debug(
			`Finally ${mappedProducts.length} products (of ${totalCount} total) after mappings and filters. Page: offset=${offset}, limit=${limit}`,
			{
				entity: EntityType.PRODUCTS,
			},
		)

		return {
			products: mappedProducts,
			totalCount,
		}
	}

	public async getProductCatalog(
		requestContext: RequestContext,
	): Promise<ProductCatalogResponse> {
		const tenantId = this.getTenantId(requestContext)
		const cacheKey = redisCache.buildProductListKey(tenantId)

		let fullProducts = await redisCache.getJson<ProductRequestBody[]>(cacheKey)

		if (!fullProducts) {
			const [products, inventory, relationLookups] = await Promise.all([
				withTenantScope(Product.find({}).sort({ name: 1 }), tenantId).lean<
					ProductAPI[]
				>(),
				this.getInventory(requestContext),
				this.getProductRelationLookups(requestContext),
			])
			const inventoryByProductId = new Map(
				inventory.map(inventoryItem => [
					inventoryItem.productId,
					inventoryItem,
				]),
			)

			fullProducts = products
				.map(product =>
					this.productsMapper.mapProduct(
						product,
						inventoryByProductId.get(product.productId),
						requestContext,
						relationLookups,
					),
				)
				.filter(Boolean) as ProductRequestBody[]

			await redisCache.setJson(cacheKey, fullProducts)
		}

		const lastSellingByProductId =
			await this.resolveLastSellingPricesByProductId(tenantId)
		const lastBuyingByProductId =
			await this.resolveLastBuyingPricesByProductId(tenantId)

		const catalogProducts = fullProducts.map(product =>
			this.mapProductCatalogItem(
				product,
				lastSellingByProductId.get(product.productId),
				lastBuyingByProductId.get(product.productId),
			),
		)

		return {
			products: catalogProducts,
			totalCount: catalogProducts.length,
		}
	}

	private async resolveLastSellingPricesByProductId(
		tenantId: string,
	): Promise<Map<string, number>> {
		const rows = (await Invoice.aggregate([
			{
				$match: {
					tenantId,
					status: {
						$nin: [
							InvoiceStatus.DRAFT,
							InvoiceStatus.CANCELLED,
							InvoiceStatus.VOID,
						],
					},
				},
			},
			{ $sort: { issuedAt: -1 } },
			{ $unwind: '$items' },
			{
				$group: {
					_id: '$items.productId',
					lastSellingPrice: { $first: '$items.unitPrice' },
				},
			},
		])) as Array<{ _id: string; lastSellingPrice?: number }>

		const map = new Map<string, number>()

		for (const row of rows) {
			if (!row._id || row.lastSellingPrice == null) continue

			const price = Number(row.lastSellingPrice)

			if (Number.isFinite(price)) {
				map.set(row._id, price)
			}
		}

		return map
	}

	private async resolveLastBuyingPricesByProductId(
		tenantId: string,
	): Promise<Map<string, number>> {
		const rows = (await BuyingInvoice.aggregate([
			{
				$match: {
					tenantId,
					status: {
						$nin: [
							InvoiceStatus.DRAFT,
							InvoiceStatus.CANCELLED,
							InvoiceStatus.VOID,
						],
					},
				},
			},
			{ $sort: { issuedAt: -1 } },
			{ $unwind: '$items' },
			{
				$group: {
					_id: '$items.productId',
					lastBuyingPrice: { $first: '$items.unitPrice' },
				},
			},
		])) as Array<{ _id: string; lastBuyingPrice?: number }>

		const map = new Map<string, number>()

		for (const row of rows) {
			if (!row._id || row.lastBuyingPrice == null) continue

			const price = Number(row.lastBuyingPrice)

			if (Number.isFinite(price)) {
				map.set(row._id, price)
			}
		}

		return map
	}

	private mapProductCatalogItem(
		product: ProductRequestBody,
		lastSellingPrice?: number,
		lastBuyingPrice?: number,
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
				purchasePrice: product.price.purchasePrice,
				discount: product.price.discount,
				currency: product.price.currency,
			},
			averageCost: product.inventory?.averageCost,
			lastBuyingPrice,
			lastSellingPrice,
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
		const allowedUpdates = normalizeProductPatchRequest(requestBody)
		const tenantContext = getTenantContext(requestContext)

		if (allowedUpdates.barcode) {
			const existingWithBarcode = await withTenantScope(
				Product.findOne({
					barcode: allowedUpdates.barcode,
					productId: { $ne: productId },
				}),
				tenantContext.tenantId,
			).lean()

			if (existingWithBarcode) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Product barcode already exists in this tenant.',
				)
			}
		}

		if (allowedUpdates.price) {
			const existingProduct = await withTenantScope(
				Product.findOne({ productId }).lean(),
				tenantContext.tenantId,
			)

			if (!existingProduct) {
				throw new BusinessLogicError(
					ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
					'products not found.',
				)
			}

			allowedUpdates.price = mergeProductPricePatch(
				existingProduct.price,
				allowedUpdates.price,
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
		const tenantContext = getTenantContext(requestContext)

		await assertProductDeletable(tenantContext.tenantId, productId)

		const deleteResponse = await this.mongoDbClient.deleteDocument(
			{ collectionName: COLLECTION_NAMES.PRODUCTS, id: productId },
			requestContext,
			Product,
		)

		await deleteProductInventory(tenantContext.tenantId, [productId])
		await this.invalidateEntityCache('products', requestContext, productId)
		await this.invalidateEntityCache('inventory', requestContext)

		return deleteResponse
	}

	public async bulkDeleteProducts(
		productIds: string[],
		requestContext: RequestContext,
	) {
		const tenantContext = getTenantContext(requestContext)
		const ids = [...new Set(productIds.filter(Boolean))]
		const blocked = await findProductDeleteBlocks(tenantContext.tenantId, ids)
		const deleted: string[] = []
		const blockedRows: Array<{ productId: string; reason: string }> = []

		for (const productId of ids) {
			const reason = blocked.get(productId)

			if (reason) {
				blockedRows.push({ productId, reason })
				continue
			}

			try {
				await this.mongoDbClient.deleteDocument(
					{ collectionName: COLLECTION_NAMES.PRODUCTS, id: productId },
					requestContext,
					Product,
				)
				deleted.push(productId)
			} catch {
				blockedRows.push({
					productId,
					reason: 'Product could not be deleted.',
				})
			}
		}

		if (deleted.length) {
			await deleteProductInventory(tenantContext.tenantId, deleted)

			for (const productId of deleted) {
				await this.invalidateEntityCache('products', requestContext, productId)
			}

			await this.invalidateEntityCache('inventory', requestContext)
		}

		return { deleted, blocked: blockedRows }
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

	public async getInventoryByProductId(
		requestContext: RequestContext,
		productId: string,
		session?: mongoose.ClientSession,
	): Promise<InventoryDocument | null> {
		return this.mongoDbClient.getDocumentByField<InventoryDocument>(
			requestContext,
			COLLECTION_NAMES.INVENTORY,
			Inventory,
			{ fieldName: 'productId', fieldValue: productId },
			session,
		)
	}

	public async runInTransaction<T>(
		work: (session: mongoose.ClientSession) => Promise<T>,
	): Promise<T> {
		const session = await mongoose.startSession()

		try {
			let result: T | undefined

			await session.withTransaction(async () => {
				result = await work(session)
			})

			return result as T
		} finally {
			await session.endSession()
		}
	}

	/**
	 * Weighted moving average cost, recalculated on every purchase.
	 * ponytail: assumes currentQuantity >= 0; if stock had gone negative from an
	 * oversold sale, the average skews toward the new purchase price instead of
	 * being mathematically "correct". Upgrade path: reset the average to the
	 * purchase price whenever currentQuantity <= 0.
	 */
	private computeMovingAverageCost(
		currentQuantity: number,
		currentAverageCost: number,
		purchaseQuantity: number,
		purchaseUnitPrice: number,
	): number {
		const priorQuantity = Math.max(0, currentQuantity)
		const totalQuantity = priorQuantity + purchaseQuantity

		if (totalQuantity <= 0) return purchaseUnitPrice

		return (
			(priorQuantity * currentAverageCost +
				purchaseQuantity * purchaseUnitPrice) /
			totalQuantity
		)
	}

	/**
	 * Atomically adjusts Inventory.quantity and recomputes availableQuantity as
	 * max(0, quantity - reservedQuantity). Upserts on first write.
	 * Permission: inventory update (or create via invoice/buyingInvoice implicit write).
	 */
	public async atomicAdjustInventoryQuantity(
		requestContext: RequestContext,
		params: {
			productId: string
			warehouseId?: string
			quantityDelta: number
		},
		session: mongoose.ClientSession,
	): Promise<InventoryDocument> {
		await ensureTenantAccess(
			requestContext,
			COLLECTION_NAMES.INVENTORY,
			'update',
		)

		const tenantContext = getTenantContext(requestContext)
		const { productId, warehouseId, quantityDelta } = params

		const inventoryId = uuidv4()
		const createdBy = {
			_id: requestContext.userId ?? '',
			displayName:
				`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim(),
			role: requestContext.user?.role ?? requestContext.role,
			createdAt: new Date(),
		}

		const updated = await Inventory.findOneAndUpdate(
			{ tenantId: tenantContext.tenantId, productId },
			[
				{
					$set: {
						inventoryId: { $ifNull: ['$inventoryId', inventoryId] },
						productId: { $ifNull: ['$productId', productId] },
						warehouseId: { $ifNull: ['$warehouseId', warehouseId] },
						createdBy: { $ifNull: ['$createdBy', createdBy] },
						quantity: {
							$add: [{ $ifNull: ['$quantity', 0] }, quantityDelta],
						},
						availableQuantity: {
							$max: [
								0,
								{
									$subtract: [
										{
											$add: [{ $ifNull: ['$quantity', 0] }, quantityDelta],
										},
										{ $ifNull: ['$reservedQuantity', 0] },
									],
								},
							],
						},
					},
				},
			],
			{ new: true, upsert: true, session },
		).lean()

		return updated as unknown as InventoryDocument
	}

	/**
	 * Purchase adjust: qty + weighted moving averageCost in one pipeline update so
	 * concurrent purchases cannot race on averageCost. availableQuantity =
	 * max(0, newQuantity - reservedQuantity).
	 */
	public async atomicPurchaseInventoryAdjustment(
		requestContext: RequestContext,
		params: {
			productId: string
			warehouseId?: string
			purchaseQuantity: number
			purchaseUnitPrice: number
		},
		session: mongoose.ClientSession,
	): Promise<InventoryDocument> {
		await ensureTenantAccess(
			requestContext,
			COLLECTION_NAMES.INVENTORY,
			'update',
		)

		const tenantContext = getTenantContext(requestContext)
		const { productId, warehouseId, purchaseQuantity, purchaseUnitPrice } =
			params

		const inventoryId = uuidv4()
		const createdBy = {
			_id: requestContext.userId ?? '',
			displayName:
				`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim(),
			role: requestContext.user?.role ?? requestContext.role,
			createdAt: new Date(),
		}

		const updated = await Inventory.findOneAndUpdate(
			{ tenantId: tenantContext.tenantId, productId },
			[
				{
					$set: {
						inventoryId: { $ifNull: ['$inventoryId', inventoryId] },
						productId: { $ifNull: ['$productId', productId] },
						warehouseId: { $ifNull: ['$warehouseId', warehouseId] },
						createdBy: { $ifNull: ['$createdBy', createdBy] },
						quantity: {
							$add: [{ $ifNull: ['$quantity', 0] }, purchaseQuantity],
						},
						availableQuantity: {
							$max: [
								0,
								{
									$subtract: [
										{
											$add: [{ $ifNull: ['$quantity', 0] }, purchaseQuantity],
										},
										{ $ifNull: ['$reservedQuantity', 0] },
									],
								},
							],
						},
						averageCost: {
							$let: {
								vars: {
									priorQty: {
										$max: [0, { $ifNull: ['$quantity', 0] }],
									},
									priorAvg: {
										$ifNull: ['$averageCost', purchaseUnitPrice],
									},
								},
								in: {
									$cond: [
										{
											$lte: [{ $add: ['$$priorQty', purchaseQuantity] }, 0],
										},
										purchaseUnitPrice,
										{
											$divide: [
												{
													$add: [
														{
															$multiply: ['$$priorQty', '$$priorAvg'],
														},
														purchaseQuantity * purchaseUnitPrice,
													],
												},
												{ $add: ['$$priorQty', purchaseQuantity] },
											],
										},
									],
								},
							},
						},
					},
				},
			],
			{ new: true, upsert: true, session },
		).lean()

		return updated as unknown as InventoryDocument
	}

	private resolveSyncClientId(clientId?: string): string {
		const trimmed = clientId?.trim()

		if (trimmed && /^[0-9a-f-]{36}$/i.test(trimmed)) {
			return trimmed
		}

		return uuidv4()
	}

	private async resolveLatestInvoiceSequence(
		requestContext: RequestContext,
		model: typeof Invoice | typeof BuyingInvoice,
	): Promise<number> {
		const tenantContext = getTenantContext(requestContext)
		const invoices = (await withTenantScope(
			(model as typeof Invoice).find({}, { invoiceNumber: 1 }),
			tenantContext.tenantId,
		).lean()) as Array<{ invoiceNumber?: string }>

		let maxSequence = 0

		for (const invoice of invoices) {
			maxSequence = Math.max(
				maxSequence,
				parseInvoiceSequence(invoice.invoiceNumber),
			)
		}

		return maxSequence + 1
	}

	private async resolveLatestInvoiceNumber(
		requestContext: RequestContext,
	): Promise<number> {
		return this.resolveLatestInvoiceSequence(requestContext, Invoice)
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

	/**
	 * Server-side allocation as SI-000001 / BI-000001.
	 * Accepts a client-prefixed number only when unused (offline reserved blocks).
	 * Ignores bare numeric client drafts that caused "already in use" races.
	 * Call inside a transaction so unique-index conflicts retry with a fresh number.
	 */
	public async allocateInvoiceNumberForCreate(
		requestContext: RequestContext,
		prefix: InvoiceNumberPrefix,
		requestedNumber: string | undefined,
		model: typeof Invoice | typeof BuyingInvoice,
		session?: mongoose.ClientSession,
	): Promise<string> {
		const tenantId = getTenantContext(requestContext).tenantId
		const requested = requestedNumber?.trim()

		if (requested && isPrefixedInvoiceNumber(requested, prefix)) {
			const existingQuery = withTenantScope(
				(model as typeof Invoice).findOne({ invoiceNumber: requested }),
				tenantId,
			)
			const existing = await (
				session ? existingQuery.session(session) : existingQuery
			).lean()

			if (!existing) {
				return requested
			}
		}

		const sequence =
			prefix === 'SI'
				? await this.resolveNextInvoiceNumber(requestContext)
				: await this.resolveNextBuyingInvoiceNumber(requestContext)

		for (let offset = 0; offset < 50; offset++) {
			const candidate = formatInvoiceNumber(prefix, sequence + offset)
			const existingQuery = withTenantScope(
				(model as typeof Invoice).findOne({ invoiceNumber: candidate }),
				tenantId,
			)
			const existing = await (
				session ? existingQuery.session(session) : existingQuery
			).lean()

			if (!existing) {
				return candidate
			}
		}

		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			`Unable to allocate a unique ${prefix} invoice number.`,
		)
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

	private async allocateOfflineBuyingInvoiceBlock(
		requestContext: RequestContext,
	): Promise<{
		nextBuyingInvoiceNumber: number
		buyingInvoiceNumberBlockEnd: number
	}> {
		const tenantId = this.getTenantId(requestContext)
		const latestFromInvoices =
			await this.resolveLatestBuyingInvoiceNumber(requestContext)
		const session = await mongoose.startSession()

		try {
			let blockStart = latestFromInvoices
			let blockEnd = blockStart + OFFLINE_INVOICE_NUMBER_BLOCK - 1

			await session.withTransaction(async () => {
				const existing = await withTenantScope(
					OfflineSyncState.findOne({}).session(session),
					tenantId,
				)

				blockStart = existing?.buyingNextBlockStart ?? latestFromInvoices

				blockEnd = blockStart + OFFLINE_INVOICE_NUMBER_BLOCK - 1
				const nextBlockStart = blockEnd + 1

				await withTenantScope(
					OfflineSyncState.findOneAndUpdate(
						{},
						{
							$set: { buyingNextBlockStart: nextBlockStart },
							$max: {
								minOnlineBuyingInvoiceNumber: nextBlockStart,
							},
						},
						{ upsert: true, session, new: true },
					),
					tenantId,
				)
			})

			return {
				nextBuyingInvoiceNumber: blockStart,
				buyingInvoiceNumberBlockEnd: blockEnd,
			}
		} finally {
			await session.endSession()
		}
	}

	public buildCustomerInvoiceSummary(
		invoices: Array<Record<string, any>>,
		customerEntries: DailyActionResponse['data'] = [],
	): CustomerInvoiceSummary {
		let totalInvoiced = 0
		let totalPaid = 0
		let paidCount = 0
		let unpaidCount = 0

		for (const invoice of invoices) {
			const status = String(invoice.status ?? InvoiceStatus.CONFIRMED)
			const excluded: string[] = [
				InvoiceStatus.DRAFT,
				InvoiceStatus.CANCELLED,
				InvoiceStatus.VOID,
			]

			if (excluded.includes(status)) continue

			const { grandTotal, paidAmount } =
				getPrimaryInvoiceCurrencyAmounts(invoice)

			totalInvoiced += grandTotal
			totalPaid += paidAmount

			const uiStatus = mapInvoiceFiltersToUiStatus(invoice)

			if (uiStatus === InvoiceUiStatus.PAID) {
				paidCount += 1
			} else if (
				uiStatus === InvoiceUiStatus.CREDIT ||
				uiStatus === InvoiceUiStatus.PARTIAL
			) {
				unpaidCount += 1
			}
		}

		totalInvoiced += this.sumActionAmounts(
			customerEntries,
			DailyActionType.SELLING_ENTRY,
		)

		totalPaid += this.sumActionAmounts(
			customerEntries,
			DailyActionType.RECEIPT_ENTRY,
		)

		const totalReceivable = Math.max(0, totalInvoiced - totalPaid)

		return {
			totalInvoiced,
			totalPaid,
			totalReceivable,
			paidCount,
			unpaidCount,
		}
	}

	public buildSupplierInvoiceSummary(
		invoices: Array<Record<string, any>>,
		supplierEntries: DailyActionResponse['data'] = [],
	): SupplierInvoiceSummary {
		let totalInvoiced = 0
		let totalPaid = 0
		let paidCount = 0
		let unpaidCount = 0

		for (const invoice of invoices) {
			const status = String(invoice.status ?? InvoiceStatus.CONFIRMED)
			const excluded: string[] = [
				InvoiceStatus.DRAFT,
				InvoiceStatus.CANCELLED,
				InvoiceStatus.VOID,
			]

			if (excluded.includes(status)) continue

			const { grandTotal, paidAmount } =
				getPrimaryInvoiceCurrencyAmounts(invoice)

			totalInvoiced += grandTotal
			totalPaid += paidAmount

			const uiStatus = mapInvoiceFiltersToUiStatus(invoice)

			if (uiStatus === InvoiceUiStatus.PAID) {
				paidCount += 1
			} else if (
				uiStatus === InvoiceUiStatus.CREDIT ||
				uiStatus === InvoiceUiStatus.PARTIAL
			) {
				unpaidCount += 1
			}
		}

		totalInvoiced += this.sumActionAmounts(
			supplierEntries,
			DailyActionType.BUYING_ENTRY,
		)

		totalPaid += this.sumActionAmounts(
			supplierEntries,
			DailyActionType.PAYMENT_ENTRY,
		)

		const totalPayable = Math.max(0, totalInvoiced - totalPaid)

		return {
			totalInvoiced,
			totalPaid,
			totalPayable,
			paidCount,
			unpaidCount,
		}
	}

	public async buildInvoiceCurrencyAmounts(
		tenantId: string,
		totals: {
			grandTotal: number
			paidAmount: number
			remainingAmount: number
			subtotal: number
			tax: number
			discount: number
		},
	) {
		const settings = await CurrencySettings.findOne({ tenantId })

		if (!settings?.primaryCurrency) {
			return []
		}

		const currencies: Array<
			ICurrencySettingItem & { exchangeRate: number; isPrimary: boolean }
		> = [
			{
				...settings.primaryCurrency,
				exchangeRate: 1,
				isPrimary: true,
			},
			...(settings.secondaryCurrencies ?? []).map(secondary => ({
				...secondary,
				exchangeRate: secondary.exchangeRate ?? 1,
				isPrimary: false,
			})),
		]

		return currencies.map(currency => ({
			currencyId: currency.currencyId,
			name: currency.name,
			internalCode: currency.internalCode,
			exchangeRate: currency.exchangeRate,
			isPrimary: currency.isPrimary,
			amount: totals.grandTotal * currency.exchangeRate,
			paidAmount: totals.paidAmount * currency.exchangeRate,
			remainingAmount: totals.remainingAmount * currency.exchangeRate,
			subtotal: totals.subtotal * currency.exchangeRate,
			tax: totals.tax * currency.exchangeRate,
			discount: totals.discount * currency.exchangeRate,
		}))
	}

	private async resolveLatestBuyingInvoiceNumber(
		requestContext: RequestContext,
	): Promise<number> {
		return this.resolveLatestInvoiceSequence(requestContext, BuyingInvoice)
	}

	public async resolveNextBuyingInvoiceNumber(
		requestContext: RequestContext,
	): Promise<number> {
		return this.resolveLatestBuyingInvoiceNumber(requestContext)
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

	public async patchInventoryByProductId(
		productId: string,
		requestBody: Partial<InventoryRequestBody>,
		requestContext: RequestContext,
	) {
		const inventory = await this.getInventoryByProductId(
			requestContext,
			productId,
		)

		if (!inventory) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Inventory not found for product.',
			)
		}

		return this.patchInventory(
			inventory.inventoryId,
			requestBody,
			requestContext,
		)
	}

	public async patchInventory(
		inventoryId: string,
		requestBody: Partial<InventoryRequestBody>,
		requestContext: RequestContext,
	) {
		const allowedUpdates = normalizeInventoryPatchRequest(requestBody)

		if (allowedUpdates.productId) {
			await this.ensureInventoryProductBelongsToTenant(
				requestContext,
				allowedUpdates.productId,
			)
		}

		const updateResponse = await this.mongoDbClient.updateDocument(
			{ collectionName: COLLECTION_NAMES.INVENTORY, id: inventoryId },
			requestContext,
			Inventory,
			allowedUpdates,
		)

		await this.invalidateEntityCache('inventory', requestContext, inventoryId)
		await this.invalidateEntityCache('products', requestContext)

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
		requestBody: DailyActionRequestBody,
		requestContext: RequestContext,
	) {
		const optionalString = (value?: string) => value?.trim() || undefined
		const dailyActionData = {
			entryType: requestBody.entryType,
			productId: optionalString(requestBody.productId),
			invoiceNumber: optionalString(requestBody.invoiceNumber),
			invoiceDate: requestBody.invoiceDate
				? new Date(requestBody.invoiceDate)
				: undefined,
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
		}

		const updateResponse = await this.mongoDbClient.updateDocument(
			{ collectionName: COLLECTION_NAMES.DAILY_ACTIONS, id: actionId },
			requestContext,
			DailyAction,
			dailyActionData,
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

	public async getProcessedSyncMutation(
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

	public async recordSyncMutation(
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
						paymentType: InvoicePaymentType.CREDIT,
						paymentStatus: {
							$in: [InvoicePaymentStatus.UNPAID, InvoicePaymentStatus.PARTIAL],
						},
					},
				],
			})
				.sort({ createdAt: -1 })
				.lean(),
			tenantContext.tenantId,
		) as Promise<Array<Record<string, unknown>>>
	}

	private async getBuyingInvoicesForOfflineBootstrap(
		requestContext: RequestContext,
	): Promise<Array<Record<string, unknown>>> {
		const tenantContext = getTenantContext(requestContext)
		const cutoff = this.getOfflineRetentionCutoff()

		return withTenantScope(
			BuyingInvoice.find({
				$or: [
					{ issuedAt: { $gte: cutoff } },
					{
						paymentType: InvoicePaymentType.CREDIT,
						paymentStatus: {
							$in: [InvoicePaymentStatus.UNPAID, InvoicePaymentStatus.PARTIAL],
						},
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
			offlineBuyingInvoices,
		] = await Promise.all([
			this.getInventory(requestContext),
			this.requireCustomerController().getCustomers(requestContext),
			this.requireSupplierController().getSuppliers(requestContext),
			this.requirePartnerController().getPartners(requestContext),
			this.requireCategoryController().getCategories(requestContext),
			this.getBrands(requestContext),
			this.getShelves(requestContext),
			this.getWarehouses(requestContext),
			this.getCurrencies(requestContext),
			this.getUnits(requestContext),
			this.getExpenses(requestContext),
			this.getDailyActionsForOfflineBootstrap(requestContext),
			this.getInvoicesForOfflineBootstrap(requestContext),
			this.getBuyingInvoicesForOfflineBootstrap(requestContext),
		])

		const tenantContext = getTenantContext(requestContext)
		const userSettings = await withTenantScope(
			UserSettings.findOne({
				userId: requestContext.userId,
			}).lean(),
			tenantContext.tenantId,
		)

		const currencySettings = await CurrencySettings.findOne({
			tenantId: tenantContext.tenantId,
		}).lean()

		const invoiceSettings = await InvoiceSettings.findOne({
			tenantId: tenantContext.tenantId,
		}).lean()

		const nextInvoiceNumberBlock =
			await this.allocateOfflineInvoiceBlock(requestContext)
		const nextBuyingInvoiceNumberBlock =
			await this.allocateOfflineBuyingInvoiceBlock(requestContext)

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
			buyingInvoices: offlineBuyingInvoices,
			currencySettings: (currencySettings ?? {
				tenantId: tenantContext.tenantId,
				primaryCurrency: null,
				secondaryCurrencies: [],
			}) as Record<string, unknown>,
			invoiceSettings: (invoiceSettings ?? {
				tenantId: tenantContext.tenantId,
				noMergeInvoiceLines: false,
				displayName: '',
				address: '',
				phone: '',
				email: '',
				taxNumber: '',
				logoUrl: '',
				qrUrl: '',
				footerNote: '',
			}) as Record<string, unknown>,
			userSettings: userSettings as Record<string, unknown> | undefined,
			frontendResources,
			nextInvoiceNumber: nextInvoiceNumberBlock.nextInvoiceNumber,
			invoiceNumberBlockEnd: nextInvoiceNumberBlock.invoiceNumberBlockEnd,
			nextBuyingInvoiceNumber:
				nextBuyingInvoiceNumberBlock.nextBuyingInvoiceNumber,
			buyingInvoiceNumberBlockEnd:
				nextBuyingInvoiceNumberBlock.buyingInvoiceNumberBlockEnd,
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
			buyingInvoices,
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
			this.getDocumentsSince(
				requestContext,
				COLLECTION_NAMES.BUYING_INVOICES,
				BuyingInvoice,
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
			buyingInvoices: buyingInvoices as unknown as Array<
				Record<string, unknown>
			>,
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
				data = (await this.requireSellingInvoiceController().postInvoice(
					{
						...(payload as InvoiceRequestBody),
						clientMutationId: entry.clientMutationId,
					},
					requestContext,
				)) as Record<string, unknown>
			} else if (entry.entity === 'invoice' && entry.method === 'PATCH') {
				const invoiceId = this.extractSyncPathId(entry.url)

				data = (await this.requireSellingInvoiceController().patchInvoice(
					invoiceId,
					payload as Partial<InvoiceRequestBody>,
					requestContext,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'invoice' && entry.method === 'DELETE') {
				const invoiceId = this.extractSyncPathId(entry.url)

				await this.requireSellingInvoiceController().deleteInvoice(
					invoiceId,
					requestContext,
				)

				data = { success: true, invoiceId }

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (entry.entity === 'buyingInvoice' && entry.method === 'POST') {
				data = (await this.requireBuyingInvoiceController().postBuyingInvoice(
					{
						...(payload as BuyingInvoiceRequestBody),
						clientMutationId: entry.clientMutationId,
					},
					requestContext,
				)) as Record<string, unknown>
			} else if (entry.entity === 'buyingInvoice' && entry.method === 'PATCH') {
				const buyingInvoiceId = this.extractSyncPathId(entry.url)

				data = (await this.requireBuyingInvoiceController().patchBuyingInvoice(
					buyingInvoiceId,
					payload as Partial<BuyingInvoiceRequestBody>,
					requestContext,
				)) as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (
				entry.entity === 'buyingInvoice' &&
				entry.method === 'DELETE'
			) {
				const buyingInvoiceId = this.extractSyncPathId(entry.url)

				await this.requireBuyingInvoiceController().deleteBuyingInvoice(
					buyingInvoiceId,
					requestContext,
				)

				data = { success: true, buyingInvoiceId }

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (
				entry.entity === 'currencySettings' &&
				entry.method === 'PATCH'
			) {
				const currencySettings =
					await this.requireSettingController().applyCurrencySettingsUpdate(
						requestContext,
						payload as {
							primaryCurrency?: ICurrencySettingItem | null
							secondaryCurrencies?: ICurrencySettingItem[]
						},
					)

				data = currencySettings as unknown as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
			} else if (
				entry.entity === 'invoiceSettings' &&
				entry.method === 'PATCH'
			) {
				const invoiceSettings =
					await this.requireSettingController().applyInvoiceSettingsUpdate(
						requestContext,
						payload as {
							noMergeInvoiceLines?: boolean
							displayName?: string
							address?: string
							phone?: string
							email?: string
							taxNumber?: string
							logoUrl?: string
							qrUrl?: string
							footerNote?: string
						},
					)

				data = invoiceSettings as unknown as Record<string, unknown>

				await this.recordSyncMutation(
					requestContext,
					entry.clientMutationId,
					entry.entity,
					entry.operation,
					data,
				)
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
				data = (await this.requireCustomerController().postCustomer(
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
				data = (await this.requireSupplierController().postSupplier(
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
				data = (await this.requirePartnerController().postPartner(
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
				data = (await this.requireCategoryController().postCategory(
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
					payload as unknown as DailyActionRequestBody,
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
				data = await this.requireSettingController().updateUserSettingsFromSync(
					requestContext,
					payload as Partial<
						Pick<
							IUserSettings,
							'productsPerPage' | 'displayLanguage' | 'defaultInvoiceCurrencyId'
						>
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
