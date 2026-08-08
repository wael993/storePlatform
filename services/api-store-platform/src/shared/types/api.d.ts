/* eslint-disable @typescript-eslint/no-empty-object-type */
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
type EntryType =
	| 'BUYING_ENTRY'
	| 'SELLING_ENTRY'
	| 'PAYMENT_ENTRY'
	| 'RECEIPT_ENTRY'
	| 'EXPENSE_ENTRY'

interface ProductDailyAction {
	actionId: string
	entryType: EntryType
	productId?: string
	productName?: string
	invoiceNumber?: string
	invoiceDate: Date
	supplierId?: string
	supplierName?: string
	customerId?: string
	customerName?: string
	currencyId: string
	currencyName: string
	unitId?: string
	unitName?: string
	weight?: string
	singleUnitPrice?: string
	totalPrice?: string
	note?: string
}
interface PartnerDailyAction {
	actionId: string
	entryType: Partial<EntryType | 'PAYMENT_ENTRY' | 'RECEIPT_ENTRY'>
	invoiceNumber?: string
	invoiceDate: Date
	partnerId?: string
	partnerName?: string
	currencyId: string
	currencyName: string
	singleUnitPrice?: string
	totalPrice?: string
	note?: string
}
interface CustomerDailyAction {
	actionId: string
	entryType: EntryType
	productId?: string
	productName?: string
	invoiceNumber?: string
	invoiceDate: Date
	supplierId?: string
	supplierName?: string
	customerId?: string
	customerName?: string
	expenseId?: string
	expenseName?: string
	currencyId: string
	currencyName: string
	unitId?: string
	unitName?: string
	weight?: string
	singleUnitPrice?: string
	totalPrice?: string
	note?: string
}

interface DailyAction {
	partnerId?: string
	partnerName?: string
	actionId: string
	entryType: EntryType
	productId?: string
	productName?: string
	invoiceNumber?: string
	invoiceDate: Date
	supplierId?: string
	supplierName?: string
	customerId?: string
	customerName?: string
	expenseId?: string
	expenseName?: string
	currencyId: string
	currencyName: string
	unitId?: string
	unitName?: string
	weight?: string
	singleUnitPrice?: string
	totalPrice?: string
	note?: string
}

interface DailyActionRequestBody {
	entryType: EntryType
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
	currencyId: string
	currencyName: string
	unitId?: string
	unitName?: string
	weight?: string
	singleUnitPrice?: string
	totalPrice?: string
	invoiceNumber?: string
	invoiceDate: Date
	note?: string
}

interface BudgetOverviewResponse {
	payments: string
	purchase: string
	currency?: string
	balance: string
}

type CreateDailyActionResponse = {
	_id: string
	actionId?: string
}
interface CustomersResponse extends APIResponse<CustomerResponse> {}
interface CurrenciesResponse extends APIResponse<Currency> {}
interface UnitsResponse extends APIResponse<Unit> {}
interface SuppliersResponse extends APIResponse<Supplier> {}
interface BrandsResponse extends APIResponse<Brand> {}
interface ShelvesResponse extends APIResponse<Shelf> {}
interface WarehousesResponse extends APIResponse<Warehouse> {}

interface PartnersResponse extends APIResponse<Partner> {}
interface ExpensesResponse extends APIResponse<Expense> {}
interface DailyActionResponse extends APIResponse<DailyAction> {}

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
	relatedActions?: PartnerDailyAction[]
}

export interface CustomerResponse {
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

	relatedActions?: CustomerDailyAction[]
}

interface Supplier {
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
	actions?: DailyAction[]
	relatedActions?: DailyAction[]
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
	relatedActions?: CustomerDailyAction[]
}
