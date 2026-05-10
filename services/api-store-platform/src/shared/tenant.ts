import { RequestContext } from './types'
import {
	AuthorizationError,
	BusinessLogicError,
} from '../middleware/errorHandler'
import { ERROR_CODES } from './errorCodes'

export const TENANT_ROLES = ['owner', 'admin', 'cashier', 'employee'] as const
export const TENANT_RESOURCES = [
	'users',
	'products',
	'orders',
	'invoices',
	'inventory',
	'reports',
] as const
export const TENANT_ACTIONS = ['read', 'create', 'update', 'delete'] as const

export type TenantRole = (typeof TENANT_ROLES)[number]
export type TenantResource = (typeof TENANT_RESOURCES)[number]
export type TenantAction = (typeof TENANT_ACTIONS)[number]

type TenantPermissionMap = Record<TenantResource, TenantAction[]>

export const TENANT_PERMISSION_MATRIX: Record<TenantRole, TenantPermissionMap> =
	{
		owner: {
			users: ['read', 'create', 'update', 'delete'],
			products: ['read', 'create', 'update', 'delete'],
			orders: ['read', 'create', 'update', 'delete'],
			invoices: ['read', 'create', 'update', 'delete'],
			inventory: ['read', 'create', 'update', 'delete'],
			reports: ['read', 'create', 'update', 'delete'],
		},
		admin: {
			users: ['read', 'create', 'update', 'delete'],
			products: ['read', 'create', 'update', 'delete'],
			orders: ['read', 'create', 'update', 'delete'],
			invoices: ['read', 'create', 'update', 'delete'],
			inventory: ['read', 'create', 'update', 'delete'],
			reports: ['read', 'create', 'update', 'delete'],
		},
		cashier: {
			users: ['read'],
			products: ['read'],
			orders: ['read', 'create', 'update'],
			invoices: ['read', 'create', 'update'],
			inventory: ['read'],
			reports: ['read'],
		},
		employee: {
			users: ['read'],
			products: ['read'],
			orders: ['read'],
			invoices: ['read'],
			inventory: ['read'],
			reports: ['read'],
		},
	}

export const DEFAULT_TENANT_ID = 'legacy-tenant'
export const DEFAULT_TENANT_NAME = 'Legacy Tenant'
export const DEFAULT_TENANT_DOMAIN = 'example.com'

export const getEmailDomain = (email: string): string => {
	const [, domain = ''] = email.toLowerCase().split('@')
	return domain
}

export const getTenantContext = (
	requestContext: RequestContext | undefined,
): RequestContext & { tenantId: string; role: TenantRole } => {
	if (!requestContext?.tenantId) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Tenant context is required.',
		)
	}

	if (!requestContext?.role) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Tenant role is required.',
		)
	}

	if (!TENANT_ROLES.includes(requestContext.role)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Invalid tenant role.',
		)
	}

	return requestContext as RequestContext & {
		tenantId: string
		role: TenantRole
	}
}

export const ensureTenantAccess = (
	requestContext: RequestContext,
	resource: TenantResource,
	action: TenantAction,
): void => {
	const tenantContext = getTenantContext(requestContext)
	const permissions = TENANT_PERMISSION_MATRIX[tenantContext.role][resource]

	if (!permissions.includes(action)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			`Role ${tenantContext.role} cannot ${action} ${resource}.`,
		)
	}
}

export const requireTenantId = (tenantId?: string): string => {
	if (!tenantId) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'tenantId is required.',
		)
	}

	return tenantId
}
