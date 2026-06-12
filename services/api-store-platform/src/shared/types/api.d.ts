interface APIResponse<T> {
	totalCount: number
	data: T[]
}

interface LoginData {
	email: string
	password: string
}
export interface LoginRequestBody {
	body: LoginData
}

interface UserAPIFormat {
	_id: string
	displayName: string
	businessPartnerId?: string
	avatarColorId?: number
}
interface EntryType {
	value: string
	label: string
}

interface CustomerDailyAction {
	actionId: string
	entryType: EntryType
	productId: string
	productName: string
	invoiceNumber: string
	invoiceDate: Date
	supplierId?: string
	supplierName?: string
	customerId?: string
	customerName?: string
	currencyId: string
	currencyName: string
	unitId: string
	unitName: string
	weight: string
	singleUnitPrice?: string
	totalPrice?: string
}

interface DailyAction {
	actionId: string
	entryType: EntryType
	productId: string
	productName: string
	invoiceNumber: string
	invoiceDate: Date
	supplierId?: string
	supplierName?: string
	customerId?: string
	customerName?: string
	currencyId: string
	currencyName: string
	unitId: string
	unitName: string
	weight: string
	singleUnitPrice?: string
	totalPrice?: string
}

interface DailyActionRequestBody {
	entryType: EntryType
	productId: string
	productName: string
	supplierId?: string
	supplierName?: string
	customerId?: string
	customerName?: string
	currencyId: string
	currencyName: string
	unitId: string
	unitName: string
	weight: string
	singleUnitPrice: string
	totalPrice: string
	invoiceNumber: string
	invoiceDate: Date
}

type CreateDailyActionResponse = {
	_id: string
}
interface CustomersResponse extends APIResponse<Customer> {}
interface CurrenciesResponse extends APIResponse<Currency> {}
interface UnitsResponse extends APIResponse<Unit> {}
interface SuppliersResponse extends APIResponse<Supplier> {}
interface DailyActionResponse extends APIResponse<DailyAction> {}
interface DailyActionRequestBody extends APIResponse<DailyAction> {}

interface Supplier {
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
	actions?: DailyAction[]
	relatedActions?: DailyAction[]
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

interface Customer {
	customerId: string
	sold: number
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
	actions?: CustomerDailyAction[]
}
