import { AuthorizedUser } from './authorization'

interface RequestContext {
	authorization?: string
	cookie?: string
	userId?: string
	user?: AuthorizedUser
	userVendorId?: string
	activityVendorId?: string
	activityId?: string
	allowedFields: string[]
}

interface HttpError {
	httpStatus: number
	message: string
	errorCode: import('../errorCodes').ErrorCodes
	hint?: string
}
interface RequestError {
	message: string
	errorCode: string
	hint?: string
}

export type ProductRequestBody = {
	id: string
	name: string
	barcode: string
	price: number | null
	description?: string
	count: number
}
export type CreateProductResponse = {
	_id: string
}
interface ProductDocument {
	productId: string
	id: string
	name: string
	barcode: string
	price: number | null
	count: number
	createdBy: UserAPIFormat
	createdAt: Date
	description?: string
}
interface UserAPIFormat {
	_id: string
	displayName: string
	isInternal?: boolean
	avatarColorId?: number
}
