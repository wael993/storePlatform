import { RequestContext } from './types'
import { pgFindOne } from '../db/mongoQuery'
import {
	AuthenticationError,
	AuthorizationError,
} from '../middleware/errorHandler'
import { ERROR_CODES } from './errorCodes'
import Tenant from '../models/Tenant'
import { COLLECTION_NAMES } from './general'
import { TENANT_STATUS } from './constants/tenant.constants'

export const TENANT_ROLES = ['owner', 'admin', 'cashier', 'employee'] as const

export const SUPER_ADMIN_ROLE = 'super_admin' as const
export const PLATFORM_ROLES = [SUPER_ADMIN_ROLE] as const
export const USER_ROLES = [...TENANT_ROLES, ...PLATFORM_ROLES] as const

export type TenantResource =
	(typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES]

export const TENANT_ACTIONS = ['read', 'create', 'update', 'delete'] as const

export type TenantRole = (typeof TENANT_ROLES)[number]
export type UserRole = (typeof USER_ROLES)[number]

export const isTenantRole = (role: string): role is TenantRole =>
	(TENANT_ROLES as readonly string[]).includes(role)

export const getSuperAdminTenantId = (): string => {
	const tenantId = process.env.SUPER_ADMIN_TENANT_ID?.trim()

	if (!tenantId) {
		throw new Error('Missing SUPER_ADMIN_TENANT_ID.')
	}

	return tenantId
}

export const isPlatformSuperAdmin = (
	role?: string,
	tenantId?: string,
): boolean => role === SUPER_ADMIN_ROLE && tenantId === getSuperAdminTenantId()

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

	if (!isTenantRole(requestContext.role)) {
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

export const ensureTenantAccess = async (
	requestContext: RequestContext,
	resource: TenantResource,
): Promise<void> => {
	getTenantContext(requestContext)
	const { ensureSeeForResource } = await import('./seePermissions')

	await ensureSeeForResource(requestContext, resource)
}

export const assertPersistedUserMayAuthenticate = (user: {
	role: string
	tenantId: string
}): void => {
	if (user.role !== SUPER_ADMIN_ROLE) {
		return
	}

	if (user.tenantId === getSuperAdminTenantId()) {
		return
	}

	throw new AuthenticationError(
		ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
		'Invalid email or password.',
	)
}

export const assertAssignableTenantRole = (role: string): void => {
	if (!isTenantRole(role)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'super_admin role can only be created from super-admin controls.',
		)
	}
}

export const ensureSuperAdmin = async (
	requestContext: RequestContext,
): Promise<void> => {
	if (!isPlatformSuperAdmin(requestContext.role, requestContext.tenantId)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Only super admin can perform this action.',
		)
	}

	const tenant = await pgFindOne(Tenant, requestContext.tenantId, {
		status: TENANT_STATUS.ACTIVE,
	})

	if (!tenant) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Only super admin can perform this action.',
		)
	}
}
