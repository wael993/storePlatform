import { AuthorizedUser } from './authorization'
import { TenantRole } from '../tenant'
import { CustomerDailyAction, ProductDailyAction } from './api'

interface RequestContext {
	authorization?: string
	cookie?: string
	userId?: string
	tenantId?: string
	tenantName?: string
	role?: TenantRole
	user?: AuthorizedUser
	allowedFields: string[]
}

interface HttpError {
	httpStatus: number
	message: string
	errorCode: import('../errorCodes').ErrorCodes
	hint?: string
}
interface RequestError {
	message: string
	errorCode: string
	hint?: string
}

type PartnerRequestBody = {
	partnerId: string
	name: string
	internalCode?: string
}
type SupplierRequestBody = {
	supplierId: string
	name: string
	internalCode?: string
}

type CustomerRequestBody = {
	customerId: string
	name: string
	internalCode?: string
	relatedActions?: CustomerDailyAction[]
	createdAt?: string
	updatedAt?: string
	createdBy?: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
}
type ExpenseRequestBody = {
	expenseId: string
	name: string
	internalCode?: string
}
type CurrencyRequestBody = {
	currencyId: string
	name: string
	internalCode?: string
}

type UnitRequestBody = {
	unitId: string
	name: string
	internalCode?: string
}

export type ProductRequestBody = {
	productId: string
	internalCode?: string
	productFactoryCode?: string
	name: string
	latinName?: string
	barcode: string
	categoryId?: string
	categoryName?: string
	brandId?: string
	supplierId?: string
	supplierName?: string
	images?: string[]
	unitId?: string
	taxRate?: string
	price: {
		purchasePrice?: number
		retailPrice: number
		wholesalePrice?: number
		semiWholesalePrice?: number
		discount?: number
		currency: string
	}
	attributes?: {
		color?: string
		size?: string
		weight?: string
		length?: string
		width?: string
		height?: string
		flavor?: string
		expiryDate?: string
	}
	status: 'active' | 'inactive' | 'discontinued'
	description?: string
	quantity?: number
	minQuantity?: number
	inventory?: InventoryDocument
	relatedActions?: ProductDailyAction[]
}

export type ProductCatalogItem = {
	productId: string
	name: string
	latinName?: string
	barcode: string
	internalCode?: string
	productFactoryCode?: string
	unitId?: string
	taxRate?: string
	price: {
		retailPrice: number
		purchasePrice?: number
		discount?: number
		currency: string
	}
	averageCost?: number
	lastBuyingPrice?: number
	lastSellingPrice?: number
	images?: string[]
}

export type ProductCatalogResponse = {
	products: ProductCatalogItem[]
	totalCount: number
}

export type OrderRequestBody = {
	orderNumber: string
	status?: 'draft' | 'open' | 'paid' | 'cancelled'
	items: Array<{
		productId: string
		name: string
		quantity: number
		unitPrice: number
	}>
	totalAmount: number
}
export type InvoiceRequestBody = {
	invoiceId?: string
	clientMutationId?: string
	invoiceNumber?: string
	orderId?: string
	customerId?: string
	customerName?: string
	salesPerson?: string
	paymentType?: 'cash' | 'card' | 'credit'
	items?: Array<{
		productId: string
		name: string
		barcode?: string
		quantity: number
		unit?: string
		unitPrice: number
		discount?: number
		discountIsPercent?: boolean
		taxRate?: number
		lineTotal?: number
	}>
	status?:
		| 'draft'
		| 'confirmed'
		| 'partial'
		| 'paid'
		| 'cancelled'
		| 'pending'
		| 'void'
	paymentStatus?: 'unpaid' | 'partial' | 'paid'
	currencyAmounts: Array<{
		currencyId: string
		name: string
		internalCode?: string
		exchangeRate: number
		isPrimary: boolean
		amount: number
		paidAmount: number
		remainingAmount: number
		subtotal: number
		tax: number
		discount: number
	}>
	notes?: string
	printAfterPayment?: boolean
	warehouseId?: string
	issuedAt?: Date | string
	invoiceDiscount?: number
	invoiceDiscountIsPercent?: boolean
}

export type SellingInvoicesQueryParams = {
	searchText?: string
	status?: string
	issuedDate?: string
	dateFrom?: string
	dateTo?: string
	customerId?: string
}

export type CustomerInvoiceSummary = {
	totalInvoiced: number
	totalPaid: number
	totalReceivable: number
	paidCount: number
	unpaidCount: number
}

export type SellingInvoicesSummaryProduct = {
	productId: string
	productName: string
	quantity?: number
	profit?: number
}

export type SellingInvoicesSummary = {
	todaySales: number
	paidInvoices: number
	creditInvoices: number
	totalReceivable: number
	averageOrder: number
	totalProfit: number
	bestSeller: SellingInvoicesSummaryProduct | null
	topProfitProduct: SellingInvoicesSummaryProduct | null
}

export type SellingInvoicesListResponse = {
	invoices: Array<Record<string, unknown>>
	summary: SellingInvoicesSummary
	customerSummary?: CustomerInvoiceSummary
	nextInvoiceNumber: number
	totalCount: number
}

export type BuyingInvoiceRequestBody = {
	buyingInvoiceId?: string
	clientMutationId?: string
	invoiceNumber?: string
	supplierId?: string
	supplierName?: string
	paymentType?: 'cash' | 'credit'
	items?: Array<{
		productId: string
		name: string
		barcode?: string
		quantity: number
		unit?: string
		unitPrice: number
		discount?: number
		discountIsPercent?: boolean
		taxRate?: number
		lineTotal?: number
	}>
	status?:
		| 'draft'
		| 'confirmed'
		| 'partial'
		| 'paid'
		| 'cancelled'
		| 'pending'
		| 'void'
	paymentStatus?: 'unpaid' | 'partial' | 'paid'
	currencyAmounts: Array<{
		currencyId: string
		name: string
		internalCode?: string
		exchangeRate: number
		isPrimary: boolean
		amount: number
		paidAmount: number
		remainingAmount: number
		subtotal: number
		tax: number
		discount: number
	}>
	notes?: string
	warehouseId?: string
	issuedAt?: Date | string
	invoiceDiscount?: number
	invoiceDiscountIsPercent?: boolean
}

export type BuyingInvoicesQueryParams = {
	searchText?: string
	status?: string
	issuedDate?: string
}

export type BuyingInvoicesSummary = {
	todayPurchases: number
	paidInvoices: number
	creditInvoices: number
	totalPayable: number
	averageOrder: number
}

export type BuyingInvoicesListResponse = {
	invoices: Array<Record<string, unknown>>
	summary: BuyingInvoicesSummary
	nextInvoiceNumber: number
	totalCount: number
}

export type SyncPushEntry = {
	clientMutationId: string
	entity: string
	operation: string
	url: string
	method: string
	payload: Record<string, unknown>
}

export type SyncPushRequestBody = {
	entries: SyncPushEntry[]
	retryClientMutationIds?: string[]
}

export type SyncPushResult = {
	clientMutationId: string
	success: boolean
	error?: string
	data?: Record<string, unknown>
}

export type SyncPushResponse = {
	results: SyncPushResult[]
	serverTime: string
}

export type SyncBootstrapResponse = {
	products: Array<Record<string, unknown>>
	inventory: Array<Record<string, unknown>>
	customers: Array<Record<string, unknown>>
	suppliers: Array<Record<string, unknown>>
	partners: Array<Record<string, unknown>>
	categories: Array<Record<string, unknown>>
	brands: Array<Record<string, unknown>>
	shelves: Array<Record<string, unknown>>
	warehouses: Array<Record<string, unknown>>
	currencies: Array<Record<string, unknown>>
	units: Array<Record<string, unknown>>
	expenses: Array<Record<string, unknown>>
	dailyActions: Array<Record<string, unknown>>
	invoices: Array<Record<string, unknown>>
	buyingInvoices?: Array<Record<string, unknown>>
	currencySettings?: Record<string, unknown>
	userSettings?: Record<string, unknown>
	frontendResources?: Array<{
		path: string
		access: boolean
		allowedActions: string[]
	}>
	nextInvoiceNumber: number
	invoiceNumberBlockEnd: number
	nextBuyingInvoiceNumber?: number
	buyingInvoiceNumberBlockEnd?: number
	serverTime: string
	offlineRetentionDays?: number
}

export type CategoryRequestBody = {
	categoryId: string
	name: string
	description?: string
	parentCategoryId?: string
}
export type BrandRequestBody = {
	name: string
	description?: string
}
export type ShelfRequestBody = {
	shelfId: string
	name: string
	description?: string
}
export type WarehouseRequestBody = {
	warehouseId: string
	name: string
	code?: string
}
export type InventoryRequestBody = {
	productId: string
	warehouseId?: string
	shelfId?: string
	quantity?: number
}
export type ReportRequestBody = {
	name: string
	type: 'sales' | 'inventory' | 'finance' | 'operations'
	periodStart: Date
	periodEnd: Date
	data: Record<string, unknown>
}
export type InviteTenantUserRequestBody = {
	firstName: string
	lastName: string
	email: string
	role: TenantRole
	// isInternal?: boolean
}
export type UpdateTenantUserRequestBody = {
	firstName?: string
	lastName?: string
	role?: TenantRole
	// isInternal?: boolean
}
export type AddTenantRequestBody = {
	tenantName: string
	tenantDomain: string
	ownerFirstName: string
	ownerLastName: string
	ownerEmail: string
	ownerPassword: string
}
export type UpdateTenantRequestBody = {
	tenantName?: string
	status?: 'active' | 'inactive'
	accessiblePages?: string[]
	offlineEnabled?: boolean
}
export type CreateProductResponse = {
	_id: string
	productId?: string
}
export type CreateSupplierResponse = {
	_id: string
	supplierId?: string
}
export type CreatePartnerResponse = {
	_id: string
	partnerId?: string
}
export type CreateCustomerResponse = {
	_id: string
	customerId?: string
}
export type CreateExpenseResponse = {
	_id: string
	expenseId?: string
}
export type CreateCurrencyResponse = {
	_id: string
	currencyId?: string
}
export type CreateUnitResponse = {
	_id: string
	unitId?: string
}
export type CreateCategoryResponse = {
	_id: string
}
export type CreateBrandResponse = {
	_id: string
}
export type CreateShelfResponse = {
	_id: string
}
export type CreateWarehouseResponse = {
	_id: string
}
export type CategoryAPI = {
	categoryId: string
	name: string
	description?: string
	parentCategoryId?: string
	createdAt?: string
	updatedAt?: string
	createdBy?: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
}
export type CategoriesResponse = {
	data: CategoryAPI[]
	totalCount: number
}
export type InviteTenantUserResponse = {
	_id: string
	email: string
	tenantId: string
	role: TenantRole
	temporaryPassword: string
}
export type TenantUserSummary = {
	_id: string
	userId: string
	displayName: string
	email: string
	role: TenantRole
	firstName: string
	lastName: string
}
export type AddTenantResponse = {
	tenantId: string
	tenantName: string
	tenantDomain: string
	ownerUserId: string
}
export type TenantSummary = {
	tenantId: string
	name: string
	domain: string
	status: 'active' | 'inactive'
	accessiblePages: string[]
	offlineEnabled: boolean
	createdAt: Date
	updatedAt: Date
	permissions: {
		canChangeTenantSettings: boolean
		canUpdate: boolean
		canDelete: boolean
		canToggleStatus: boolean
		reason?: string
	}
}
interface CustomerDocument {
	tenantId: string
	_id?: string
	customerId: string
	name: string
	internalCode?: string
	createdBy: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt: Date
	updatedAt: Date
}

interface CurrencyDocument {
	tenantId: string
	_id?: string
	currencyId: string
	name: string
	internalCode?: string
	createdBy: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt: Date
	updatedAt: Date
}

interface ExpenseDocument {
	tenantId: string
	_id?: string
	expenseId: string
	name: string
	internalCode?: string
	createdBy: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt: Date
	updatedAt: Date
}

interface UnitDocument {
	unitId: string
	name: string
	internalCode?: string
}

interface PartnerDocument {
	tenantId: string
	_id?: string
	name: string
	partnerId: string
	internalCode?: string
	createdBy: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt: Date
	updatedAt: Date
}
interface SupplierDocument {
	tenantId: string
	_id?: string
	name: string
	supplierId: string
	internalCode?: string
	createdBy: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt: Date
	updatedAt: Date
}

interface BrandDocument {
	tenantId: string
	_id?: string
	name: string
	description?: string
	createdBy?: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt?: Date
	updatedAt?: Date
}

interface ShelfDocument {
	tenantId: string
	_id?: string
	shelfId: string
	name: string
	description?: string
	createdBy?: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt?: Date
	updatedAt?: Date
}

interface WarehouseDocument {
	tenantId: string
	_id?: string
	warehouseId: string
	name: string
	code?: string
	address?: string
	status?: 'active' | 'inactive'
	description?: string
	createdBy?: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt?: Date
	updatedAt?: Date
}

export interface InventoryDocument {
	inventoryId: string
	productId: string
	warehouseId?: string
	shelfId?: string
	quantity?: number
	averageCost?: number // weighted moving average cost, updated on each purchase
	minQuantity?: number // low stock alert
	maxQuantity?: number // overstock alert
	reservedQuantity?: number // reserved for pending orders
	availableQuantity?: number // quantity - reserved
	lastCountDate?: Date
}
interface CategoryDocument {
	categoryId: string
	name: string
	description?: string
	parentCategoryId?: string
	createdBy?: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt?: Date
	updatedAt?: Date
}
interface ProductDocument {
	productId: string
	internalCode?: string
	productFactoryCode?: string
	name: string
	latinName?: string
	categoryId?: string
	supplierId?: string
	brandId?: string
	barcode?: string
	taxRate?: string
	unitId?: string
	price: {
		purchasePrice?: number
		retailPrice: number
		wholesalePrice?: number
		semiWholesalePrice?: number
		discount?: number
		currency: string
	}
	status: 'active' | 'inactive' | 'discontinued'
	description?: string
	attributes?: {
		color?: string
		size?: string
		weight?: string
		length?: string
		width?: string
		height?: string
		flavor?: string
		expiryDate?: string
	}
	images?: string[]
}
interface UserAPIFormat {
	_id: string
	displayName: string
	avatarColorId?: number
	role: TenantRole
	createdAt?: Date
}

type ProductAPIStatus = 'active' | 'inactive' | 'discontinued'
interface ProductAPI {
	tenantId: string
	// _id: string
	productId: string
	internalCode?: string
	productFactoryCode?: string
	name: string
	latinName?: string
	categoryId?: string
	supplierId?: string
	brandId?: string
	barcode?: string
	taxRate?: string
	unitId?: string
	price: {
		purchasePrice?: number
		retailPrice: number
		wholesalePrice?: number
		semiWholesalePrice?: number
		discount?: number
		currency: string
	}
	status: 'active' | 'inactive' | 'discontinued'
	description?: string
	attributes?: {
		color?: string
		size?: string
		weight?: string
		length?: string
		width?: string
		height?: string
		flavor?: string
		expiryDate?: string
	}
	images?: string[]
	createdBy: {
		_id: string
		displayName: string
		role?: TenantRole
		createdAt: Date
	}
	updatedBy?: {
		_id: string
		displayName: string
		role?: TenantRole
		updatedAt: Date
	}
	createdAt: Date
	updatedAt: Date
	relatedActions?: ProductDailyAction[]
}

export type ProductAPIEnriched = Omit<
	ProductAPI,
	'categoryId' | 'brandId' | 'supplierId'
> & {
	brand?: { _id: string; name: string }
	supplier?: { supplierId: string; name: string }
}
