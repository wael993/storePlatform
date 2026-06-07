interface APIResponse<T> {
	totalCount: number
	data: T[]
}

interface DailyActionResponse extends APIResponse<DailyAction> {}

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

interface DailyAction {
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
	singleUnitPrice?: string
	totalPrice?: string
}

interface DailyActionRequestBody extends APIResponse<DailyAction> {}

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
}

type CreateDailyActionResponse = {
	_id: string
}

interface SuppliersResponse extends APIResponse<Supplier> {}

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
}
