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

type CreateProductAPIResponse = CreateAPIResponse
type CreateSupplierAPIResponse = CreateAPIResponse & { supplierId?: string }
type CreatePartnerAPIResponse = CreateAPIResponse
type CreateCustomerAPIResponse = CreateAPIResponse
type CreateCategoryAPIResponse = CreateAPIResponse
type CreateBrandAPIResponse = CreateAPIResponse
type CreateShelfAPIResponse = CreateAPIResponse
type CreateWarehouseAPIResponse = CreateAPIResponse
type BrandsAPIResponse = APIResponse<Brand>
type ShelvesAPIResponse = APIResponse<Shelf>
type WarehousesAPIResponse = APIResponse<Warehouse>
type CreateExpenseAPIResponse = CreateAPIResponse
type CreateUnitAPIResponse = CreateAPIResponse
type UpdateExpenseAPIResponse = CreateAPIResponse

type ProductsAPIResponse = APIResponse<Product>
type SuppliersAPIResponse = APIResponse<Supplier>
type PartnersAPIResponse = APIResponse<Partner>
type CustomersAPIResponse = APIResponse<Customer>
type CategoriesAPIResponse = APIResponse<Category>
type ExpensesAPIResponse = APIResponse<Expense>
type UnitsAPIResponse = APIResponse<Unit>
type DailyActionsAPIResponse = APIResponse<DailyAction>
type SavedFiltersAPIResponse = APIResponse<SavedFilters>
interface BudgetOverviewAPIResponse {
	payments: string
	purchase: string
	currency?: string
	balance: string
	sumBuyingWeight: string
	sumSellingWeight: string
}
interface BudgetOverviewQueryArgument {
	entityType: 'customer' | 'supplier' | 'partner' | 'product'
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
	'new' | 'preparation' | 'execution' | 'done' | 'rejected'

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
	totalPayable?: number
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

interface Expense {
	expenseId: string
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

interface Partner {
	partnerId: string
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
	internalCode?: string
	createdAt?: string
	updatedAt?: string
	totalReceivable?: number
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

interface Category {
	categoryId: string
	name: string
	description?: string
	parentCategoryId?: string
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

interface Brand {
	brandId: string
	name: string
	description?: string
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

interface Shelf {
	shelfId: string
	name: string
	description?: string
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

interface Warehouse {
	warehouseId: string
	name: string
	code?: string
	address?: string
	status?: 'active' | 'inactive'
	description?: string
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
	latinName?: string
	barcode?: string
	internalCode?: string
	productFactoryCode?: string
	categoryId?: string
	categoryName?: string
	supplierId?: string
	supplierName?: string
	brandId?: string
	brandName?: string
	taxRate?: string
	unitId?: string
	unitName?: string
	price: {
		purchasePrice?: number
		retailPrice: number
		wholesalePrice?: number
		semiWholesalePrice?: number
		discount?: number
		currency: string
	}
	status: 'active' | 'inactive' | 'discontinued'
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
	description?: string
	/** Most recent unit price from a confirmed selling invoice, if any. */
	lastSellingPrice?: number
	/** Most recent unit price from a confirmed buying invoice, if any. */
	lastBuyingPrice?: number
	inventory?: {
		inventoryId: string
		productId: string
		warehouseId?: string
		shelfId?: string
		quantity?: number
		averageCost?: number
		minQuantity?: number
		maxQuantity?: number
		reservedQuantity?: number
		availableQuantity?: number
		lastCountDate?: string
	}
	warehouseName?: string
	shelfName?: string

	relatedActions?: DailyAction[]
}

type CreateProductInput = Omit<Product, 'productId'> & {
	quantity: number
	minQuantity?: number
	warehouseId?: string
	shelfId?: string
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
	accessiblePages?: string[]
	/** Tenant-level setting returned on login; stored in tenant offline config, not on user. */
	offlineEnabled?: boolean
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

type TenantUserRole = 'owner' | 'admin' | 'cashier' | 'employee'

interface InviteTenantUserRequest {
	firstName: string
	lastName: string
	email: string
	role: TenantUserRole
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
