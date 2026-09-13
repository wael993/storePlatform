import { Inventory } from '../models/Inventory'
import {
	AuthorizationError,
	BusinessLogicError,
} from '../middleware/errorHandler'
import { ERROR_CODES } from './errorCodes'
import { withTenantScope } from './mongodb/tenantScopedModel'
import { SUPER_ADMIN_ROLE } from './tenant'
import { RequestContext } from './types'

/** Roles that always see every warehouse (tenant owner + platform staff). */
const UNRESTRICTED_ROLES: ReadonlySet<string> = new Set([
	'owner',
	SUPER_ADMIN_ROLE,
])

/**
 * `null` = unrestricted (owner/super_admin only, when no scope header).
 * Other roles: only listed warehouseIds; empty/missing = no warehouse access.
 */
export const getAllowedWarehouseIds = (
	requestContext: RequestContext,
): string[] | null => {
	if (requestContext.role && UNRESTRICTED_ROLES.has(requestContext.role)) {
		return null
	}

	return requestContext.user?.warehouseIds ?? []
}

export const parseWarehouseScopeHeader = (
	raw?: string | string[],
): string[] | undefined => {
	if (raw === undefined) {
		return undefined
	}

	const value = Array.isArray(raw) ? raw.join(',') : raw

	return [
		...new Set(
			value
				.split(',')
				.map(part => part.trim())
				.filter(Boolean),
		),
	]
}

/**
 * Resolve working warehouse scope from optional `x-warehouse-scope` header.
 * Missing header → ACL only (owner = unrestricted). Present → intersected with
 * the ACL, so a stale/forged header can only ever narrow access.
 *
 * Never throws: this runs while building the request context, before the route
 * handler's try/catch, so a throw here would escape as an unhandled rejection.
 */
export const resolveWarehouseScope = (
	requestContext: Pick<RequestContext, 'role' | 'user'>,
	headerValue?: string | string[],
): string[] | null => {
	const requested = parseWarehouseScopeHeader(headerValue)
	const allowed = getAllowedWarehouseIds(requestContext as RequestContext)

	if (requested === undefined) {
		return allowed
	}

	if (allowed === null) {
		return requested
	}

	const allowedSet = new Set(allowed)

	return requested.filter(id => allowedSet.has(id))
}

/** Effective working scope: header-resolved list, or ACL when unset. */
export const getEffectiveWarehouseIds = (
	requestContext: RequestContext,
): string[] | null => {
	if (requestContext.warehouseScope !== undefined) {
		return requestContext.warehouseScope
	}

	return getAllowedWarehouseIds(requestContext)
}

export const requireWarehouseId = (warehouseId?: string | null): string => {
	const id = warehouseId?.trim()

	if (!id) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'warehouseId is required.',
		)
	}

	return id
}

/**
 * Operational mode: exactly one warehouse in working scope.
 * Returns that warehouseId.
 */
export const requireOperationalWarehouseId = (
	requestContext: RequestContext,
): string => {
	const effective = getEffectiveWarehouseIds(requestContext)

	if (effective === null || effective.length !== 1) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Exactly one warehouse must be selected to post invoices or change stock.',
		)
	}

	return effective[0]
}

export const ensureWarehouseAccess = (
	requestContext: RequestContext,
	warehouseId?: string | null,
): void => {
	const effective = getEffectiveWarehouseIds(requestContext)

	if (effective === null) {
		return
	}

	if (!warehouseId || !effective.includes(warehouseId)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'You do not have access to this warehouse.',
		)
	}
}

/** ACL only — warehouse master-data endpoints (picker / settings). */
export const ensureWarehouseAcl = (
	requestContext: RequestContext,
	warehouseId?: string | null,
): void => {
	const allowed = getAllowedWarehouseIds(requestContext)

	if (allowed === null) {
		return
	}

	if (!warehouseId || !allowed.includes(warehouseId)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'You do not have access to this warehouse.',
		)
	}
}

export const filterByWarehouseAccess = <T extends { warehouseId?: string }>(
	requestContext: RequestContext,
	items: T[],
): T[] => {
	const effective = getEffectiveWarehouseIds(requestContext)

	if (effective === null) {
		return items
	}

	if (effective.length === 0) {
		return []
	}

	const allowedSet = new Set(effective)

	return items.filter(
		item => Boolean(item.warehouseId) && allowedSet.has(item.warehouseId!),
	)
}

/** ACL only (ignore working scope) — e.g. warehouse picker list. */
export const filterByWarehouseAcl = <T extends { warehouseId?: string }>(
	requestContext: RequestContext,
	items: T[],
): T[] => {
	const allowed = getAllowedWarehouseIds(requestContext)

	if (allowed === null) {
		return items
	}

	if (allowed.length === 0) {
		return []
	}

	const allowedSet = new Set(allowed)

	return items.filter(
		item => Boolean(item.warehouseId) && allowedSet.has(item.warehouseId!),
	)
}

/**
 * Product ids stocked in at least one warehouse in the effective scope.
 * `null` = unrestricted (owner, no scope). `[]` = no access / no matching stock.
 */
export const loadAccessibleProductIds = async (
	requestContext: RequestContext,
	tenantId: string,
): Promise<string[] | null> => {
	const effective = getEffectiveWarehouseIds(requestContext)

	if (effective === null) {
		return null
	}

	if (effective.length === 0) {
		return []
	}

	const rows = await withTenantScope(
		Inventory.find({ warehouseId: { $in: effective } }).select('productId'),
		tenantId,
	).lean<{ productId?: string }[]>()

	return [
		...new Set(
			rows.map(row => row.productId).filter((id): id is string => Boolean(id)),
		),
	]
}

export const filterByAccessibleProductIds = <T extends { productId?: string }>(
	products: T[],
	accessibleProductIds: string[] | null,
): T[] => {
	if (accessibleProductIds === null) {
		return products
	}

	if (accessibleProductIds.length === 0) {
		return []
	}

	const allowed = new Set(accessibleProductIds)

	return products.filter(
		product => Boolean(product.productId) && allowed.has(product.productId!),
	)
}
