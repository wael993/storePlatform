import { AuthorizedUser } from './authorization'
import { TenantRole } from '../tenant'

interface RequestContext {
	authorization?: string
	cookie?: string
	userId?: string
	tenantId?: string
	tenantName?: string
	role?: TenantRole
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
export type OrderRequestBody = {
	orderNumber: string
	status?: 'draft' | 'open' | 'paid' | 'cancelled'
	items: Array<{
		productId: string
		name: string
		quantity: number
		unitPrice: number
	}>
	totalAmount: number
}
export type InvoiceRequestBody = {
	invoiceNumber: string
	orderId?: string
	status?: 'pending' | 'paid' | 'void'
	amount: number
	issuedAt: Date
}
export type InventoryRequestBody = {
	productId: string
	onHand: number
	reserved?: number
	reorderLevel?: number
}
export type ReportRequestBody = {
	name: string
	type: 'sales' | 'inventory' | 'finance' | 'operations'
	periodStart: Date
	periodEnd: Date
	data: Record<string, unknown>
}
export type InviteTenantUserRequestBody = {
	firstName: string
	lastName: string
	email: string
	role: TenantRole
	isInternal?: boolean
}
export type UpdateTenantUserRequestBody = {
	firstName?: string
	lastName?: string
	role?: TenantRole
	isInternal?: boolean
}
export type AddTenantRequestBody = {
	tenantName: string
	tenantDomain: string
	ownerFirstName: string
	ownerLastName: string
	ownerEmail: string
	ownerPassword: string
}
export type UpdateTenantRequestBody = {
	tenantName?: string
	status?: 'active' | 'inactive'
}
export type CreateProductResponse = {
	_id: string
}
export type CreateEntityResponse = {
	_id: string
}
export type InviteTenantUserResponse = {
	_id: string
	email: string
	tenantId: string
	role: TenantRole
	temporaryPassword: string
}
export type TenantUserSummary = {
	_id: string
	userId: string
	displayName: string
	email: string
	role: TenantRole
	firstName: string
	lastName: string
	isInternal: boolean
	createdAt: Date
	updatedAt: Date
}
export type AddTenantResponse = {
	tenantId: string
	tenantName: string
	tenantDomain: string
	ownerUserId: string
}
export type TenantSummary = {
	tenantId: string
	name: string
	domain: string
	status: 'active' | 'inactive'
	createdAt: Date
	updatedAt: Date
	permissions: {
		canUpdate: boolean
		canDelete: boolean
		canToggleStatus: boolean
		reason?: string
	}
}
interface ProductDocument {
	tenantId: string
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
