import Tenant from '../models/Tenant'
import TenantRolePermission from '../models/TenantRolePermission'
import { Product } from '../models/Products'
import { withTenantScope } from './mongodb/tenantScopedModel'
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
	[COLLECTION_NAMES.SUPPLIERS]: [SEE.supplier, SEE.sellingInvoicesBuyingButton],
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

const numbersDiffer = (incoming: unknown, existing: unknown) =>
	incoming !== undefined && Number(incoming) !== Number(existing ?? 0)

const stringsDiffer = (incoming: unknown, existing: unknown) =>
	incoming !== undefined && String(incoming ?? '') !== String(existing ?? '')

export const ensurePatchedSeeFields = async (
	requestContext: RequestContext,
	fields: ReadonlyArray<{ id: SeeId; touched: boolean }>,
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

	if (fields.some(field => field.touched && !see.has(field.id))) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Role cannot edit this field.',
		)
	}
}

export const ensureProductPatchSee = async (
	requestContext: RequestContext,
	patch: {
		name?: string
		latinName?: string
		barcode?: string
		price?: {
			purchasePrice?: number
			retailPrice?: number
			discount?: number
		}
	},
	existing: {
		name?: string
		latinName?: string
		barcode?: string
		price?: {
			purchasePrice?: number
			retailPrice?: number
			discount?: number
		}
	} | null,
): Promise<void> => {
	await ensureSeeIds(requestContext, [SEE.productsEdit])
	await ensurePatchedSeeFields(requestContext, [
		{
			id: SEE.productsEditName,
			touched: stringsDiffer(patch.name, existing?.name),
		},
		{
			id: SEE.productsEditBarcode,
			touched: stringsDiffer(patch.barcode, existing?.barcode),
		},
		{
			id: SEE.productsEditBuyingPrice,
			touched: numbersDiffer(
				patch.price?.purchasePrice,
				existing?.price?.purchasePrice,
			),
		},
		{
			id: SEE.productsEditSellingPrice,
			touched: numbersDiffer(
				patch.price?.retailPrice,
				existing?.price?.retailPrice,
			),
		},
		{
			id: SEE.productsEditDiscount,
			touched: numbersDiffer(patch.price?.discount, existing?.price?.discount),
		},
	])
}

export const ensureInventoryPatchSee = async (
	requestContext: RequestContext,
	patch: { quantity?: number; minQuantity?: number },
	existing: { quantity?: number; minQuantity?: number } | null,
): Promise<void> => {
	await ensureSeeIds(requestContext, [SEE.productsEdit])
	await ensurePatchedSeeFields(requestContext, [
		{
			id: SEE.productsEditQuantity,
			touched: numbersDiffer(patch.quantity, existing?.quantity),
		},
		{
			id: SEE.productsEditMinQuantity,
			touched: numbersDiffer(patch.minQuantity, existing?.minQuantity),
		},
	])
}

type InvoiceLineLike = {
	productId?: string
	unitPrice?: number
	discount?: number
	discountIsPercent?: boolean
}

type InvoiceLineKind = 'selling' | 'buying'

export const newInvoiceLineTouched = (
	next: InvoiceLineLike,
	catalog: { unitPrice: number; discount: number } | null,
) => {
	if (!catalog) {
		return {
			unitPrice: next.unitPrice !== undefined,
			discount:
				next.discount !== undefined || next.discountIsPercent !== undefined,
		}
	}

	return {
		unitPrice: Number(next.unitPrice ?? 0) !== Number(catalog.unitPrice),
		discount:
			Number(next.discount ?? 0) !== Number(catalog.discount) ||
			(next.discountIsPercent !== undefined &&
				Boolean(next.discountIsPercent) !== true),
	}
}

export const ensureInvoiceEditFieldSee = async (
	requestContext: RequestContext,
	existing: Record<string, unknown> | null,
	incoming: {
		items?: InvoiceLineLike[]
		invoiceDiscount?: number
		invoiceDiscountIsPercent?: boolean
	},
	kind: InvoiceLineKind,
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
	const existingItems = Array.isArray(existing?.items)
		? (existing.items as InvoiceLineLike[])
		: []
	let unitPriceChanged = false
	let discountChanged = false

	if (incoming.items) {
		const newProductIds = [
			...new Set(
				incoming.items.flatMap((item, index) =>
					existingItems[index] || !item.productId ? [] : [item.productId],
				),
			),
		]
		const catalogByProductId = new Map<
			string,
			{ unitPrice: number; discount: number }
		>()

		if (newProductIds.length) {
			const products = await withTenantScope(
				Product.find({ productId: { $in: newProductIds } }).lean(),
				requestContext.tenantId,
			)

			for (const product of products) {
				catalogByProductId.set(product.productId, {
					unitPrice:
						kind === 'buying'
							? Number(product.price?.purchasePrice ?? 0)
							: Number(product.price?.retailPrice ?? 0),
					discount: Number(product.price?.discount ?? 0),
				})
			}
		}

		// note: lines matched by index. Reorder can false-403. Upgrade: stable line ids.
		for (let index = 0; index < incoming.items.length; index += 1) {
			const previous = existingItems[index]
			const next = incoming.items[index]

			if (!previous) {
				// note: catalog compare uses stored product currency. Converted invoice amounts can false-403. Upgrade: currency-aware defaults.
				const touched = newInvoiceLineTouched(
					next,
					next.productId
						? (catalogByProductId.get(next.productId) ?? null)
						: null,
				)

				if (touched.unitPrice) unitPriceChanged = true

				if (touched.discount) discountChanged = true

				continue
			}

			if (numbersDiffer(next.unitPrice, previous.unitPrice)) {
				unitPriceChanged = true
			}

			if (
				numbersDiffer(next.discount, previous.discount) ||
				(next.discountIsPercent !== undefined &&
					Boolean(next.discountIsPercent) !==
						Boolean(previous.discountIsPercent))
			) {
				discountChanged = true
			}
		}
	}

	const invoiceDiscountChanged =
		numbersDiffer(incoming.invoiceDiscount, existing?.invoiceDiscount) ||
		(incoming.invoiceDiscountIsPercent !== undefined &&
			Boolean(incoming.invoiceDiscountIsPercent) !==
				Boolean(existing?.invoiceDiscountIsPercent))

	// note: Total column writes unitPrice. Can't tell price-edit from total-edit; both flags allow. Split needs a dedicated payload field.
	if (
		unitPriceChanged &&
		!see.has(SEE.invoicesLinePrice) &&
		!see.has(SEE.invoicesLineTotal)
	) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Role cannot edit this field.',
		)
	}

	if (discountChanged && !see.has(SEE.invoicesLineDiscount)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Role cannot edit this field.',
		)
	}

	if (invoiceDiscountChanged && !see.has(SEE.invoicesInvoiceDiscount)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Role cannot edit this field.',
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
