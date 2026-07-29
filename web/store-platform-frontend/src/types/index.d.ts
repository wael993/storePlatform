interface FilterOptions {
	referenceIds?: string[]
	packageNames?: string[]
	suppliers?: string[]
	brands?: string[]
	salesAreas?: string[]
	locations?: string[]
	shops?: string[]
	dateFrom: string
	dateTo?: string
	ticketStatuses?: ActivityStatusAPI[]
	categories?: string[]
	clusters?: string[]
	subCategories?: string[]
	year?: number
	ghNumbers?: string[]
	productDescriptionGhNumbers?: string[]
	priceOfferStatuses?: PriceLevel3StatusAPI[]
	resetFilters?: boolean
}
type AddQuickModalType =
	| 'product'
	// | 'currency'
	| 'supplier'
	| 'customer'
	| 'unit'
	| 'expense'
	| 'partner'
	| 'category'
	| 'brand'
	| 'shelf'
	| 'warehouse'
type UserRoles = 'owner' | 'admin' | 'cashier' | 'employee' | 'super_admin'
type InputType = 'number' | 'text' | 'email' | 'text-area' | 'date'
type EntryActionType =
	| 'BUYING_ENTRY'
	| 'SELLING_ENTRY'
	| 'PAYMENT_ENTRY'
	| 'RECEIPT_ENTRY'
	| 'EXPENSE_ENTRY'
	| {
			value: string
			label?: string
	  }

interface DailyAction {
	_id?: string
	actionId: string
	entryType: EntryActionType
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
	invoiceNumber?: string
	invoiceDate: string
	singleUnitPrice?: string
	totalPrice?: string
	createdAt?: string
	updatedAt?: string
	note?: string
}
interface User {
	_id: string
	firstName: string
	lastName: string
	email: string
	accessLevel: accessLevel
	role: UserRoles
	disabled: boolean
	createdAt: string
	updatedAt: string
	deletedAt: string | null
}
interface StylesObject {
	[k: string]: import('@chakra-ui/react').CSSObject
}

interface AcceptAgbResponse {
	modifiedCount: number
}

interface AcceptAgbRequest {
	userId: string
	serviceId: string
}

interface FrontendResources {
	path: string
	access: boolean
	allowedActions?: string[]
}

type TranslationKey = import('i18next').ParseKeys

interface ActivityStateMapProps {
	translationKey: TranslationKey
	color: string
}

type ActivityStateMap = {
	[k in ActivityState]: ActivityStateMapProps
}

interface BreadcrumbItem {
	id: string
	name: string
	href: string
	isCurrentPage: boolean
}

interface BreadcrumbParams {
	id?: string
	name?: string
	targetType?: TargetType
}

type DropdownOption = {
	label: string
	value: string
	color?: string
	icon?: React.ReactNode
	isInvalid?: boolean
	stateColor?: string
	stateTitle?: string
}

interface SelectOption {
	value: string
	label: string
	isInvalid?: boolean
	color?: string
}

type EntryType =
	| 'customer'
	| 'supplier'
	| 'product'
	| 'dailyAction'
	| 'payment'
	| 'receipt'
	| 'sale'
	| 'purchase'
	| 'other'
