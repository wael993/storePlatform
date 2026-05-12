// interface AddFilterRequestBody {
// 	filterName: string
// 	activityType: ActivityType
// 	filters: FilterOptions
// 	isDefault: boolean
// }

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

interface SavedFiltersAPIResponse extends APIResponse<SavedFilters> {}

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
interface APIResponse<T> {
	totalCount: number
	data: T[]
}

interface ProductAPIResponse extends APIResponse<ProductApi[]> {}

interface ProductApi {
	_id: string
	productId: string
	name: string
	barcode: string
	brand?: string
	images?: string[]
	category?: {
		id: string
		name: string
	}
	price: {
		buy: number
		sell: number
		discount?: number
		currency: string
	}
	stock: {
		quantity: number
		minQuantity?: number
		unit?: string
	}
	tax?: {
		type: string
		value: number
	}
	supplier?: {
		id?: string
		name?: string
	}
	location?: {
		warehouse?: string
		shelf?: string
	}
	attributes?: {
		color?: string
		size?: string
		flavor?: string
		expiryDate?: string
		weight?: string
	}
	status?: 'active' | 'inactive' | 'discontinued'
	description?: string
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
	// isInternal: boolean
}

interface TenantUser {
	_id: string
	userId: string
	displayName: string
	email: string
	role: UserRole
	firstName: string
	lastName: string
	// isInternal: boolean
	createdAt: string
	updatedAt: string
}

interface InviteTenantUserRequest {
	firstName: string
	lastName: string
	email: string
	role: UserRole
	// isInternal?: boolean
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
