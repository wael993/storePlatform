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

type UserRoles = 'owner' | 'admin' | 'cashier' | 'employee' | 'super_admin'
type InputType = 'number' | 'text' | 'email' | 'text-area'

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
	locationId?: string
	locationName?: string
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
