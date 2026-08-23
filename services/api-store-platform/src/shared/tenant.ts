import { RequestContext } from './types'
import {
	AuthenticationError,
	AuthorizationError,
	BusinessLogicError,
} from '../middleware/errorHandler'
import { ERROR_CODES } from './errorCodes'
import Role, { RoleMethodPermission, RoleRecord } from '../models/Role'
import Tenant from '../models/Tenant'
import { COLLECTION_NAMES } from './general'
import { TENANT_STATUS } from './constants/tenant.constants'
import logger, { EntityType } from './logger/logger'

export const TENANT_ROLES = ['owner', 'admin', 'cashier', 'employee'] as const

export const SUPER_ADMIN_ROLE = 'super_admin' as const
export const PLATFORM_ROLES = [SUPER_ADMIN_ROLE] as const
export const USER_ROLES = [...TENANT_ROLES, ...PLATFORM_ROLES] as const

export const TENANT_RESOURCES = Object.values(
	COLLECTION_NAMES,
) as TenantResource[]

export type TenantResource =
	(typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES]

export const TENANT_ACTIONS = ['read', 'create', 'update', 'delete'] as const

export type TenantRole = (typeof TENANT_ROLES)[number]
export type PlatformRole = (typeof PLATFORM_ROLES)[number]
export type UserRole = (typeof USER_ROLES)[number]
export type TenantAction = (typeof TENANT_ACTIONS)[number]

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

type TenantPermissionMap = Record<TenantResource, TenantAction[]>

type RoleResources = Record<string, Record<string, RoleMethodPermission>>
type FrontendPermission = {
	access: boolean
	allowedActions?: string[]
}
type FrontendResources = Record<string, FrontendPermission>

const ROLE_CACHE_TTL_MS = 60_000

const ACTION_TO_HTTP_METHODS: Record<TenantAction, string[]> = {
	read: ['GET'],
	create: ['POST'],
	update: ['PATCH', 'PUT'],
	delete: ['DELETE'],
}

// Side-effect resources mutated by other operations (e.g. stock/inventory on invoice save).
// Allowed when the caller has `create` on a listed source resource.
const IMPLICIT_WRITE_SOURCES: Partial<
	Record<TenantResource, TenantResource[]>
> = {
	[COLLECTION_NAMES.STOCK_MOVINGS]: [
		COLLECTION_NAMES.INVOICES,
		COLLECTION_NAMES.BUYING_INVOICES,
	],
	[COLLECTION_NAMES.INVENTORY]: [
		COLLECTION_NAMES.INVOICES,
		COLLECTION_NAMES.BUYING_INVOICES,
	],
}

let dynamicRoleCache: {
	expiresAt: number
	matrix: Record<TenantRole, TenantPermissionMap> | null
	frontendResources: Partial<Record<UserRole, FrontendResources>>
} = {
	expiresAt: 0,
	matrix: null,
	frontendResources: {},
}

const createEmptyPermissionMap = (): TenantPermissionMap => ({
	users: [],
	products: [],
	orders: [],
	invoices: [],
	buyingInvoices: [],
	inventory: [],
	reports: [],
	tenants: [],
	dailyActions: [],
	suppliers: [],
	customers: [],
	partners: [],
	expenses: [],
	currencies: [],
	stockMovings: [],
	units: [],
	categories: [],
	shelves: [],
	warehouses: [],
	brands: [],
	syncMutations: [],
	employees: [],
})

const createEmptyRoleMatrix = (): Record<TenantRole, TenantPermissionMap> => ({
	owner: createEmptyPermissionMap(),
	admin: createEmptyPermissionMap(),
	cashier: createEmptyPermissionMap(),
	employee: createEmptyPermissionMap(),
})

const isMethodAllowed = (
	resourceMethods: Record<string, RoleMethodPermission> | undefined,
	action: TenantAction,
): boolean => {
	if (!resourceMethods) {
		return false
	}

	const methods = ACTION_TO_HTTP_METHODS[action]

	for (const method of methods) {
		const methodPermission = resourceMethods[method]

		if (methodPermission && methodPermission.accessLevel !== 'NONE') {
			return true
		}
	}

	return false
}

const mergeResources = (
	base: RoleResources,
	incoming: RoleResources,
): RoleResources => {
	const merged: RoleResources = { ...base }

	for (const [resourcePath, methods] of Object.entries(incoming)) {
		merged[resourcePath] = {
			...(merged[resourcePath] || {}),
			...methods,
		}
	}

	return merged
}

const mergeFrontendResources = (
	base: FrontendResources,
	incoming: FrontendResources,
): FrontendResources => {
	const merged: FrontendResources = { ...base }

	for (const [path, permission] of Object.entries(incoming)) {
		const existing = merged[path]
		const combinedActions = [
			...(existing?.allowedActions || []),
			...(permission.allowedActions || []),
		].filter((action, index, array) => array.indexOf(action) === index)

		merged[path] = {
			access: permission.access,
			allowedActions: combinedActions.length > 0 ? combinedActions : undefined,
		}
	}

	return merged
}

const resolveRoleTree = (
	roleId: string,
	rolesById: Record<string, RoleRecord>,
	visited: Set<string>,
): { resources: RoleResources; frontendResources: FrontendResources } => {
	if (visited.has(roleId)) {
		return { resources: {}, frontendResources: {} }
	}

	const role = rolesById[roleId]

	if (!role) {
		return { resources: {}, frontendResources: {} }
	}

	visited.add(roleId)

	let mergedResources: RoleResources = {}
	let mergedFrontendResources: FrontendResources = {}

	for (const includedRole of role.include || []) {
		const includedRoleId = includedRole.toUpperCase()
		const resolved = resolveRoleTree(includedRoleId, rolesById, visited)

		mergedResources = mergeResources(mergedResources, resolved.resources)
		mergedFrontendResources = mergeFrontendResources(
			mergedFrontendResources,
			resolved.frontendResources,
		)
	}

	const ownResources = (role.resources || {}) as RoleResources
	const ownFrontend = (role.frontendResources || {}) as FrontendResources

	mergedResources = mergeResources(mergedResources, ownResources)
	mergedFrontendResources = mergeFrontendResources(
		mergedFrontendResources,
		ownFrontend,
	)

	return {
		resources: mergedResources,
		frontendResources: mergedFrontendResources,
	}
}

export const buildDynamicMatrixFromRoles = (
	rolesById: Record<string, RoleRecord>,
): {
	matrix: Record<TenantRole, TenantPermissionMap>
	frontendResources: Partial<Record<UserRole, FrontendResources>>
} => {
	const matrix = createEmptyRoleMatrix()
	const frontendResourcesByRole: Partial<Record<UserRole, FrontendResources>> =
		{}

	for (const role of TENANT_ROLES) {
		const resolved = resolveRoleTree(role.toUpperCase(), rolesById, new Set())

		if (Object.keys(resolved.resources).length === 0) {
			continue
		}

		const nextPermissions: TenantPermissionMap = createEmptyPermissionMap()

		for (const resource of TENANT_RESOURCES) {
			const resourcePath = `/${resource}`
			const resourceMethods = resolved.resources[resourcePath]

			for (const action of TENANT_ACTIONS) {
				if (isMethodAllowed(resourceMethods, action)) {
					nextPermissions[resource].push(action)
				}
			}
		}

		matrix[role] = nextPermissions
		frontendResourcesByRole[role] = resolved.frontendResources
	}

	for (const role of PLATFORM_ROLES) {
		const resolved = resolveRoleTree(role.toUpperCase(), rolesById, new Set())

		frontendResourcesByRole[role] = resolved.frontendResources
	}

	return { matrix, frontendResources: frontendResourcesByRole }
}

const getDynamicRoleEngine = async (): Promise<{
	matrix: Record<TenantRole, TenantPermissionMap>
	frontendResources: Partial<Record<UserRole, FrontendResources>>
} | null> => {
	if (dynamicRoleCache.expiresAt > Date.now()) {
		if (!dynamicRoleCache.matrix) {
			return null
		}

		return {
			matrix: dynamicRoleCache.matrix,
			frontendResources: dynamicRoleCache.frontendResources,
		}
	}

	try {
		const roles = await Role.find().lean<RoleRecord[]>()

		if (roles.length === 0) {
			dynamicRoleCache = {
				expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
				matrix: createEmptyRoleMatrix(),
				frontendResources: {},
			}

			return {
				matrix: createEmptyRoleMatrix(),
				frontendResources: {},
			}
		}

		const rolesById: Record<string, RoleRecord> = {}

		for (const role of roles) {
			rolesById[String(role._id).toUpperCase()] = role
		}

		const built = buildDynamicMatrixFromRoles(rolesById)

		dynamicRoleCache = {
			expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
			matrix: built.matrix,
			frontendResources: built.frontendResources,
		}

		return built
	} catch (error) {
		logger.error('Failed to load tenant role matrix', {
			entity: EntityType.AUTHORIZATION,
			error: error instanceof Error ? error.message : String(error),
		})

		dynamicRoleCache = {
			expiresAt: Date.now() + 5_000,
			matrix: null,
			frontendResources: {},
		}

		return null
	}
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
	_action: TenantAction,
): Promise<void> => {
	getTenantContext(requestContext)
	const { ensureSeeForResource } = await import('./seePermissions')
	await ensureSeeForResource(requestContext, resource)
}

export const getFrontendResourcesForRole = async (
	role: UserRole,
): Promise<FrontendResources | null> => {
	const dynamicEngine = await getDynamicRoleEngine()

	if (!dynamicEngine) {
		return null
	}

	return dynamicEngine.frontendResources[role] || null
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

	const tenant = await Tenant.findOne({
		tenantId: requestContext.tenantId,
		status: TENANT_STATUS.ACTIVE,
	}).lean()

	if (!tenant) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Only super admin can perform this action.',
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
