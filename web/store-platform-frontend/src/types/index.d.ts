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

interface FrontendResources {
	path: string
	access: boolean
	allowedActions?: string[]
}

interface FrontendResourcesResponse {
	frontendResources: FrontendResources[]
	see?: string[]
}

type SeeCatalogNode = {
	id: string
	locked?: boolean
	children?: SeeCatalogNode[]
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
