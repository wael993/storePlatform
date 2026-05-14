import { RequestContext } from './types'
import {
	AuthorizationError,
	BusinessLogicError,
} from '../middleware/errorHandler'
import { ERROR_CODES } from './errorCodes'
import Role, { IRole, RoleMethodPermission } from '../models/Role'
import { COLLECTION_NAMES } from './general'

export const TENANT_ROLES = [
	'owner',
	'admin',
	'cashier',
	'employee',
	'super_admin',
] as const

export const TENANT_RESOURCES = Object.values(
	COLLECTION_NAMES,
) as TenantResource[]

export type TenantResource =
	(typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES]

export const TENANT_ACTIONS = ['read', 'create', 'update', 'delete'] as const

export type TenantRole = (typeof TENANT_ROLES)[number]
export type TenantAction = (typeof TENANT_ACTIONS)[number]

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

let dynamicRoleCache: {
	expiresAt: number
	matrix: Record<TenantRole, TenantPermissionMap> | null
	frontendResources: Partial<Record<TenantRole, FrontendResources>>
} = {
	expiresAt: 0,
	matrix: null,
	frontendResources: {},
}

export const TENANT_PERMISSION_MATRIX: Record<TenantRole, TenantPermissionMap> =
	{
		owner: {
			users: ['read', 'create', 'update', 'delete'],
			products: ['read', 'create', 'update', 'delete'],
			orders: ['read', 'create', 'update', 'delete'],
			invoices: ['read', 'create', 'update', 'delete'],
			inventory: ['read', 'create', 'update', 'delete'],
			reports: ['read', 'create', 'update', 'delete'],
			tenants: [],
		},
		admin: {
			users: ['read', 'create', 'update', 'delete'],
			products: ['read', 'create', 'update', 'delete'],
			orders: ['read', 'create', 'update', 'delete'],
			invoices: ['read', 'create', 'update', 'delete'],
			inventory: ['read', 'create', 'update', 'delete'],
			reports: ['read', 'create', 'update', 'delete'],
			tenants: [],
		},
		cashier: {
			users: ['read'],
			products: ['read'],
			orders: ['read', 'create', 'update'],
			invoices: ['read', 'create', 'update'],
			inventory: ['read'],
			reports: ['read'],
			tenants: [],
		},
		employee: {
			users: ['read'],
			products: ['read'],
			orders: ['read'],
			invoices: ['read'],
			inventory: ['read'],
			reports: ['read'],
			tenants: [],
		},
		super_admin: {
			users: [],
			products: [],
			orders: [],
			invoices: [],
			inventory: [],
			reports: [],
			tenants: ['read', 'create', 'update', 'delete'],
		},
	}

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
		merged[path] = {
			access: permission.access,
			allowedActions: permission.allowedActions || existing?.allowedActions,
		}
	}

	return merged
}

const resolveRoleTree = (
	roleId: string,
	rolesById: Record<string, IRole>,
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

const buildDynamicMatrixFromRoles = (
	rolesById: Record<string, IRole>,
): {
	matrix: Record<TenantRole, TenantPermissionMap>
	frontendResources: Partial<Record<TenantRole, FrontendResources>>
} => {
	const matrix = { ...TENANT_PERMISSION_MATRIX }
	const frontendResourcesByRole: Partial<
		Record<TenantRole, FrontendResources>
	> = {}

	for (const role of TENANT_ROLES) {
		const resolved = resolveRoleTree(role.toUpperCase(), rolesById, new Set())
		if (Object.keys(resolved.resources).length === 0) {
			continue
		}

		const nextPermissions: TenantPermissionMap = {
			users: [],
			products: [],
			orders: [],
			invoices: [],
			inventory: [],
			reports: [],
			tenants: [],
		}

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

	return { matrix, frontendResources: frontendResourcesByRole }
}

const getDynamicRoleEngine = async (): Promise<{
	matrix: Record<TenantRole, TenantPermissionMap>
	frontendResources: Partial<Record<TenantRole, FrontendResources>>
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
		const roles = (await Role.find().lean()) as IRole[]
		if (roles.length === 0) {
			dynamicRoleCache = {
				expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
				matrix: null,
				frontendResources: {},
			}
			return null
		}

		const rolesById: Record<string, IRole> = {}
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
	} catch {
		// Keep static matrix as a safe fallback when role collection is unavailable.
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

export const ensureTenantAccess = async (
	requestContext: RequestContext,
	resource: TenantResource,
	action: TenantAction,
): Promise<void> => {
	const tenantContext = getTenantContext(requestContext)
	const dynamicEngine = await getDynamicRoleEngine()
	const matrix = dynamicEngine?.matrix || TENANT_PERMISSION_MATRIX
	const permissions = matrix[tenantContext.role][resource]

	if (!permissions.includes(action)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			`Role ${tenantContext.role} cannot ${action} ${resource}.`,
		)
	}
}

export const getFrontendResourcesForRole = async (
	role: TenantRole,
): Promise<FrontendResources | null> => {
	const dynamicEngine = await getDynamicRoleEngine()
	if (!dynamicEngine) {
		return null
	}

	return dynamicEngine.frontendResources[role] || null
}

export const ensureSuperAdmin = (requestContext: RequestContext): void => {
	const tenantContext = getTenantContext(requestContext)
	if (tenantContext.role !== 'super_admin') {
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
