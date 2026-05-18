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

interface Activity {
	id: string
	referenceId?: string

	supplier?: string
	supplierId?: string
	packageName?: string
	promoterFee?: string
	rentalFee?: string
	totalFee?: string
	currency?: string
	blockFocusName?: string
	createdAt?: string
	reasonName?: string
	salesAreaName?: string
	eventTypeName?: string
	eventId?: string
	blockId?: number
	pageNumber?: number
	supplierFocus?: string
	isPackage?: boolean
	deadlineApproval?: string
	daysBeforeActivityStart: number | null
	locationCustomer?: string
	isReadyForExecution?: boolean
	promoterCount?: number
	promoterInfo?: string
	isPromoterFeeUpdatedDirectly?: boolean
	// Price specific
	clusterId?: string
	clusterName?: string
	ghNumber?: string
	isFlaggedByMe?: boolean
}
type TranslationKey = import('i18next').ParseKeys

interface ActivityStateMapProps {
	translationKey: TranslationKey
	color: string
}

type ActivityStateMap = {
	[k in ActivityState]: ActivityStateMapProps
}
