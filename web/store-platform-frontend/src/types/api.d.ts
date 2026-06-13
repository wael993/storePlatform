interface AddUserRequestBody {
	firstName: string
	lastName: string
	email: string
	accessLevel: accessLevel
	disabled: boolean
}

interface AddUser {
	password: string
	firstName: string
	lastName: string
	email: string
	accessLevel?: accessLevel
	disabled?: boolean
	id?: string
}

interface APIResponse<T> {
	totalCount: number
	data: T[]
}

interface CreateAPIResponse {
	_id: string
}

interface CreateProductAPIResponse extends CreateAPIResponse {}
interface CreateSupplierAPIResponse extends CreateAPIResponse {}
interface CreateCustomerAPIResponse extends CreateAPIResponse {}
interface CreateCurrencyAPIResponse extends CreateAPIResponse {}
interface CreateUnitAPIResponse extends CreateAPIResponse {}

interface ProductsAPIResponse extends APIResponse<Product> {}
interface SuppliersAPIResponse extends APIResponse<Supplier> {}
interface CustomersAPIResponse extends APIResponse<Customer> {}
interface CurrenciesAPIResponse extends APIResponse<Currency> {}
interface UnitsAPIResponse extends APIResponse<Unit> {}
interface DailyActionsAPIResponse extends APIResponse<DailyAction> {}
interface SavedFiltersAPIResponse extends APIResponse<SavedFilters> {}
interface BudgetOverviewAPIResponse {
	payments: string
	purchase: string
	currency?: string
	balance: string
}
interface BudgetOverviewQueryArgument {
	entityType: 'customer' | 'supplier'
	id: string
}
interface UserSettings {
	enabledAccess: Access[]
}
type PostNewUser = Omit<AddUser, '_id'>

type Access =
	| 'settings'
	| 'model-page-users'
	| 'model-page-time-logs'
	| 'admin-logging-stats'

type ActivityStatusAPI =
	| 'new'
	| 'preparation'
	| 'execution'
	| 'done'
	| 'rejected'

// type ActivityType = 'PA' | 'PA1' | 'PA2' | 'PA3' | 'PO' | 'ALL'
type accessLevel = 'admin' | 'editor' | 'customer'

interface BearerTokenPayload {
	aud: string
	email: string
	exp: number
	iat: number
	iss: string
	tenantId: string
	tenantLoginBackgroundUrl: string | null
	tenantLogoUrl: string
	tenantName: string
	uid: string
}

//////////////////////////

interface Supplier {
	_id?: string
	supplierId: string
	name: string
	internalCode?: string
	createdAt?: string
	updatedAt?: string
	createdBy?: {
		_id: string
		displayName: string
		createdAt: string
	}
	updatedBy?: {
		_id: string
		displayName: string
		updatedAt: string
	}
	relatedActions?: DailyAction[]
}

interface Customer {
	customerId: string
	name: string
	sold: number
	internalCode?: string
	createdAt?: string
	updatedAt?: string
	createdBy?: {
		_id: string
		displayName: string
		createdAt: string
	}
	updatedBy?: {
		_id: string
		displayName: string
		updatedAt: string
	}
	relatedActions?: DailyAction[]
}

interface Currency {
	currencyId: string
	name: string
	internalCode?: string
	createdAt?: string
	updatedAt?: string
	createdBy?: {
		_id: string
		displayName: string
		createdAt: string
	}
	updatedBy?: {
		_id: string
		displayName: string
		updatedAt: string
	}
}

interface Unit {
	unitId: string
	name: string
	internalCode?: string
	createdAt?: string
	updatedAt?: string
	createdBy?: {
		_id: string
		displayName: string
		createdAt: string
	}
	updatedBy?: {
		_id: string
		displayName: string
		updatedAt: string
	}
}

interface Product {
	productId: string
	name: string
	internalCode?: string
	productFactoryCode?: string
	state: string
	categoryId?: string
	categoryName?: string
	category?: { _id: string; name: string }
	brandId?: string
	brandName?: string
	brand?: { _id: string; name: string }
	barcode: string
	stock: {
		quantity: number
		minQuantity?: number
	}
	unit?: 'kg' | 'piece' | 'meter' | 'set' | 'mm'
	tax?: {
		type: string
		value: number
	}
	supplierId?: string
	supplierName?: string
	supplier?: { _id: string; name: string }
	price: {
		wholesale: number
		retailSale: number
		semiWholesaleSales: number
		buyCost: number
		discount?: number
		currency: string
	}
	location?: {
		warehouse?: string
		shelf?: string
	}
	status?: 'active' | 'inactive' | 'discontinued'
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
	createdAt?: string
	updatedAt?: string
	createdBy?: {
		_id: string
		displayName: string
		createdAt: string
	}
	updatedBy?: {
		_id: string
		displayName: string
		updatedAt: string
	}
}

interface LoginAPI {
	accessToken: string
	userId: string
	tenantId: string
	tenantName: string
	email: string
	firstName: string
	lastName: string
	role: UserRole
}

interface TenantUser {
	_id: string
	userId: string
	displayName: string
	email: string
	role: UserRole
	firstName: string
	lastName: string

	createdAt: string
	updatedAt: string
}

interface InviteTenantUserRequest {
	firstName: string
	lastName: string
	email: string
	role: UserRole
}

interface InviteTenantUserResponse {
	_id: string
	email: string
	tenantId: string
	role: UserRole
	temporaryPassword: string
}

interface UpdateTenantUserRequest {
	firstName?: string
	lastName?: string
	role?: UserRole
	isInternal?: boolean
}

interface AddTenantRequest {
	tenantName: string
	tenantDomain: string
	ownerFirstName: string
	ownerLastName: string
	ownerEmail: string
	ownerPassword: string
}

interface AddTenantResponse {
	tenantId: string
	tenantName: string
	tenantDomain: string
	ownerUserId: string
}
