import Tenant from '../models/Tenant'
import TenantRolePermission from '../models/TenantRolePermission'
import { resolveAccessiblePagesForTenant } from './constants/tenantPageAccess'
import { AuthorizationError } from '../middleware/errorHandler'
import { ERROR_CODES } from './errorCodes'
import {
	SEE,
	SeeId,
	availableSeeIds,
	defaultSeeIds,
	filterCatalogForTenant,
	resolveSeeIds,
	sanitizeSeeIdsForSave,
} from './seeCatalog'
import {
	TenantResource,
	TenantRole,
	isTenantRole,
	SUPER_ADMIN_ROLE,
} from './tenant'
import { COLLECTION_NAMES } from './general'
import { RequestContext } from './types'

const CACHE_TTL_MS = 60_000

const cache = new Map<string, { expiresAt: number; see: Set<SeeId> }>()

const cacheKey = (tenantId: string, role: string) => `${tenantId}:${role}`

export const invalidateSeeCache = (tenantId: string) => {
	for (const key of cache.keys()) {
		if (key.startsWith(`${tenantId}:`)) cache.delete(key)
	}
}

const loadTenantPages = async (tenantId: string): Promise<string[]> => {
	const tenant = await Tenant.findOne({ tenantId }).lean()

	if (!tenant) return []

	return resolveAccessiblePagesForTenant(tenant)
}

export const getSeeSet = async (
	tenantId: string,
	role: string,
): Promise<Set<SeeId>> => {
	if (role === SUPER_ADMIN_ROLE) {
		return new Set()
	}

	if (!isTenantRole(role)) {
		return new Set()
	}

	const key = cacheKey(tenantId, role)
	const hit = cache.get(key)

	if (hit && hit.expiresAt > Date.now()) {
		return hit.see
	}

	const pages = await loadTenantPages(tenantId)
	let stored: string[] | null = null

	if (role !== 'owner') {
		const doc = await TenantRolePermission.findOne({ tenantId, role }).lean()

		stored = doc?.see ?? null
	}

	const see = new Set(resolveSeeIds(role, pages, stored))

	cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, see })

	return see
}

export const getSeeSetForContext = async (
	requestContext: RequestContext,
): Promise<Set<SeeId>> => {
	if (!requestContext.tenantId || !requestContext.role) {
		return new Set()
	}

	return getSeeSet(requestContext.tenantId, requestContext.role)
}

export const canSee = (see: Set<SeeId>, id: SeeId): boolean => see.has(id)

export const canSeeAny = (see: Set<SeeId>, ids: SeeId[]): boolean =>
	ids.some(id => see.has(id))

const RESOURCE_SEE: Partial<Record<TenantResource, SeeId | SeeId[]>> = {
	[COLLECTION_NAMES.PRODUCTS]: SEE.products,
	[COLLECTION_NAMES.INVENTORY]: SEE.products,
	[COLLECTION_NAMES.BRANDS]: SEE.products,
	[COLLECTION_NAMES.SHELVES]: SEE.products,
	[COLLECTION_NAMES.WAREHOUSES]: SEE.products,
	[COLLECTION_NAMES.UNITS]: SEE.products,
	[COLLECTION_NAMES.STOCK_MOVINGS]: [
		SEE.products,
		SEE.sellingInvoices,
		SEE.sellingInvoicesBuyingButton,
	],
	[COLLECTION_NAMES.SYNC_MUTATIONS]: [
		SEE.products,
		SEE.sellingInvoices,
		SEE.daily,
	],
	[COLLECTION_NAMES.INVOICES]: SEE.sellingInvoices,
	[COLLECTION_NAMES.BUYING_INVOICES]: SEE.sellingInvoicesBuyingButton,
	[COLLECTION_NAMES.CUSTOMERS]: [SEE.customers, SEE.sellingInvoices],
	[COLLECTION_NAMES.SUPPLIERS]: [
		SEE.supplier,
		SEE.sellingInvoicesBuyingButton,
	],
	[COLLECTION_NAMES.PARTNERS]: SEE.partners,
	[COLLECTION_NAMES.CATEGORIES]: SEE.categories,
	[COLLECTION_NAMES.REPORTS]: SEE.reports,
	[COLLECTION_NAMES.EMPLOYEES]: SEE.employees,
	[COLLECTION_NAMES.USERS]: [SEE.usersInvite, SEE.usersList],
	[COLLECTION_NAMES.DAILY_ACTIONS]: [
		SEE.daily,
		SEE.sellingInvoicesEntriesButton,
	],
	[COLLECTION_NAMES.EXPENSES]: [SEE.daily, SEE.sellingInvoicesEntriesButton],
	[COLLECTION_NAMES.CURRENCIES]: SEE.settings,
	[COLLECTION_NAMES.ORDERS]: SEE.orders,
}

export const ensureSeeIds = async (
	requestContext: RequestContext,
	ids: SeeId[],
): Promise<void> => {
	if (requestContext.role === SUPER_ADMIN_ROLE) {
		return
	}

	if (!requestContext.tenantId || !requestContext.role) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Tenant context is required.',
		)
	}

	const see = await getSeeSet(requestContext.tenantId, requestContext.role)

	if (!canSeeAny(see, ids)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Role cannot see this resource.',
		)
	}
}

export const canSeeResource = async (
	requestContext: RequestContext,
	resource: TenantResource,
): Promise<boolean> => {
	if (requestContext.role === SUPER_ADMIN_ROLE) {
		return true
	}

	const required = RESOURCE_SEE[resource]

	if (!required) {
		return true
	}

	if (!requestContext.tenantId || !requestContext.role) {
		return false
	}

	const see = requestContext.see
		? new Set(requestContext.see as SeeId[])
		: await getSeeSet(requestContext.tenantId, requestContext.role)
	const ids = Array.isArray(required) ? required : [required]

	return canSeeAny(see, ids)
}

export const ensureSeeForResource = async (
	requestContext: RequestContext,
	resource: TenantResource,
): Promise<void> => {
	if (requestContext.role === SUPER_ADMIN_ROLE) {
		return
	}

	const required = RESOURCE_SEE[resource]

	if (!required) {
		return
	}

	if (!requestContext.tenantId || !requestContext.role) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Tenant context is required.',
		)
	}

	if (!(await canSeeResource(requestContext, resource))) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			`Role cannot see ${resource}.`,
		)
	}
}

export const listRoleSee = async (
	tenantId: string,
	role: TenantRole,
): Promise<{
	see: SeeId[]
	catalog: ReturnType<typeof filterCatalogForTenant>
}> => {
	const pages = await loadTenantPages(tenantId)
	const catalog = filterCatalogForTenant(pages)
	const see = [...(await getSeeSet(tenantId, role))]

	return { see, catalog }
}

export const saveRoleSee = async (
	tenantId: string,
	role: TenantRole,
	incoming: unknown,
): Promise<SeeId[]> => {
	if (role === 'owner') {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Owner access cannot be changed.',
		)
	}

	const pages = await loadTenantPages(tenantId)
	const see = sanitizeSeeIdsForSave(pages, incoming)

	await TenantRolePermission.updateOne(
		{ tenantId, role },
		{ $set: { tenantId, role, see } },
		{ upsert: true },
	)

	invalidateSeeCache(tenantId)

	return see
}

export const catalogForTenant = async (tenantId: string) => {
	const pages = await loadTenantPages(tenantId)

	return {
		catalog: filterCatalogForTenant(pages),
		available: availableSeeIds(pages),
		defaults: {
			admin: defaultSeeIds('admin', pages),
			cashier: defaultSeeIds('cashier', pages),
			employee: defaultSeeIds('employee', pages),
		},
	}
}
