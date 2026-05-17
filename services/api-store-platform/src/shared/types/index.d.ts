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
	productId?: string
	productFactoryCode?: string
	name: string
	barcode: string
	categoryId?: string
	brandId?: string
	images?: string[]
	price: {
		wholesale: number
		retailSale: number
		semiWholesaleSales: number
		buyCost: number
		discount?: number
		currency: string
	}
	stock: {
		quantity: number
		minQuantity?: number
	}
	unit?: 'kg' | 'piece' | 'meter' | 'set' | 'mm'
	tax?: {
		type: string
		value: number
	}
	supplierId?: string
	location?: {
		warehouse?: string
		shelf?: string
	}
	attributes?: {
		color?: string
		size?: string
		weight?: string
		length?: string
		width?: string
		height?: string
		flavor?: string
		expiryDate?: string
	}
	status?: 'active' | 'inactive' | 'discontinued'
	description?: string
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
	// isInternal?: boolean
}
export type UpdateTenantUserRequestBody = {
	firstName?: string
	lastName?: string
	role?: TenantRole
	// isInternal?: boolean
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
	// isInternal: boolean
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
	productFactoryCode?: string
	name: string
	barcode: string
	categoryId?: string
	brandId?: string
	images?: string[]
	price: {
		wholesale: number
		retailSale: number
		semiWholesaleSales: number
		buyCost: number
		discount?: number
		currency: string
	}
	stock: {
		quantity: number
		minQuantity?: number
	}
	unit?: 'kg' | 'piece' | 'meter' | 'set' | 'mm'
	tax?: {
		type: string
		value: number
	}
	supplierId?: string
	location?: {
		warehouse?: string
		shelf?: string
	}
	attributes?: {
		color?: string
		size?: string
		weight?: string
		length?: string
		width?: string
		height?: string
		flavor?: string
		expiryDate?: string
	}
	status?: 'active' | 'inactive' | 'discontinued'
	description?: string
	createdBy: UserAPIFormat & { createdAt: Date }
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt: Date
}
interface UserAPIFormat {
	_id: string
	displayName: string
	isInternal?: boolean
	avatarColorId?: number
}

type ProductAPIStatus = 'active' | 'inactive' | 'discontinued'
interface ProductAPI {
	productId: string
	productFactoryCode?: string
	name: string
	barcode: string
	categoryId?: string
	brandId?: string
	images?: string[]
	price: {
		wholesale: number
		retailSale: number
		semiWholesaleSales: number
		buyCost: number
		discount?: number
		currency: string
	}
	stock: { quantity: number; minQuantity?: number }
	unit?: 'kg' | 'piece' | 'meter' | 'set' | 'mm'
	tax?: { type: string; value: number }
	supplierId?: string
	location?: { warehouse?: string; shelf?: string }
	attributes?: {
		color?: string
		size?: string
		weight?: string
		length?: string
		width?: string
		height?: string
		flavor?: string
		expiryDate?: string
	}
	status?: ProductAPIStatus
	description?: string
}

export type ProductAPIEnriched = Omit<
	ProductAPI,
	'categoryId' | 'brandId' | 'supplierId'
> & {
	category?: { _id: string; name: string }
	brand?: { _id: string; name: string }
	supplier?: { _id: string; name: string }
}
