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

interface User {
	_id: string
	firstName: string
	lastName: string
	email: string
	accessLevel: accessLevel
	isInternal: boolean
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
