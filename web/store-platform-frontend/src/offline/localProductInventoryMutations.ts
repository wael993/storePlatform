import {
	mapCatalogItemToProduct,
	mergeProductIntoCatalogItem,
} from '../components/SellingInvoice/catalogMappers'
import { SEE } from '../shared/seeFlags'
import {
	getOperationalWarehouseId,
	requireOperationalWarehouseId,
} from '../shared/warehouseScope'
import { InvoiceStatus } from '../shared/globalEnums'
import {
	availableQuantityFromStock,
	catalogCostToPrimary,
	finiteCost,
	mergeQtyWeightedAverageCost,
	PRODUCT_NAME_MAX_LENGTH,
	ratesFromCurrencySettings,
} from 'store-domain'
import { offlineDb, getSyncMeta, SYNC_META_KEYS } from './db'
import {
	findLocalInventoryRow,
	notifyOutboxChanged,
	putOutboxEntry,
} from './localStore'
import type {
	LocalCatalogProduct,
	LocalInventoryItem,
	OutboxEntity,
	OutboxOperation,
} from './types'
import { generateId, nowIso, withLocalMeta } from './utils'
import type { CurrencySettings } from '../api/apiStore'
import {
	allBarcodes,
	barcodeCompareKey,
	normalizeProductBarcodes,
	resolvedProductBarcode,
} from '../shared/productBarcode'

export { availableQuantityFromStock }

const getLocalCostCurrencyRates = async () => {
	const settingsRaw = (
		await offlineDb.syncMeta.get(SYNC_META_KEYS.currencySettings)
	)?.value
	if (!settingsRaw) return ratesFromCurrencySettings(null)

	try {
		return ratesFromCurrencySettings(
			JSON.parse(settingsRaw) as CurrencySettings,
		)
	} catch {
		return ratesFromCurrencySettings(null)
	}
}

export type LocalMutationOutbox = {
	entity: OutboxEntity
	operation: OutboxOperation
	url: string
	method: string
	payload: unknown
	clientMutationId: string
}

const productInventoryMutationTables = () => [
	offlineDb.products,
	offlineDb.inventory,
	offlineDb.catalogProducts,
	offlineDb.buyingInvoices,
	offlineDb.syncMeta,
	offlineDb.outbox,
]

const requireSessionTenantId = async (): Promise<string> => {
	const tenantId =
		(await getSyncMeta(SYNC_META_KEYS.sessionTenantId)) ||
		(await getSyncMeta(SYNC_META_KEYS.tenantId))
	if (!tenantId) {
		throw new Error('Offline tenant context is missing.')
	}
	return tenantId
}

const canSeeBuyingPrice = async (): Promise<boolean> => {
	const { default: store } = await import('../store/store')
	return (store.getState().frontendResources?.see ?? []).includes(
		SEE.productsBuyingPrice,
	)
}

export const persistableLocalBarcode = (
	productId: string,
	barcode?: string | null,
): string => resolvedProductBarcode(productId, barcode)

const assertLocalBarcodeCollision = async (
	codes: string[],
	excludeProductId?: string,
) => {
	if (codes.length === 0) return

	const keys = new Set(codes.map(barcodeCompareKey))
	const products = await offlineDb.products.toArray()

	for (const product of products) {
		if (excludeProductId && product.productId === excludeProductId) continue

		for (const code of allBarcodes({
			productId: product.productId,
			barcode: product.barcode,
			additionalBarcodes: product.additionalBarcodes,
		})) {
			if (keys.has(barcodeCompareKey(code))) {
				throw new Error(`Barcode "${code}" is already used by another product.`)
			}
		}
	}
}

const requireNonEmptyString = (value: unknown, fieldName: string): string => {
	if (typeof value !== 'string' || !value.trim()) {
		throw new Error(`Invalid value for ${fieldName}.`)
	}
	return value.trim()
}

const requireNonNegativeNumber = (
	value: unknown,
	fieldName: string,
): number => {
	const parsed =
		typeof value === 'number'
			? value
			: typeof value === 'string'
				? Number(value.split(',').join('').trim())
				: Number.NaN

	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`Invalid value for ${fieldName}.`)
	}

	return parsed
}

const requireNameMaxLength = (value: string, fieldName: string): string => {
	if (value.length > PRODUCT_NAME_MAX_LENGTH) {
		throw new Error(`Invalid value for ${fieldName}.`)
	}
	return value
}

const applyPriceFieldRules = (pricePatch: Partial<Product['price']>) => {
	if (pricePatch.purchasePrice !== undefined) {
		pricePatch.purchasePrice = requireNonNegativeNumber(
			pricePatch.purchasePrice,
			'price.purchasePrice',
		)
	}
	if (pricePatch.retailPrice !== undefined) {
		pricePatch.retailPrice = requireNonNegativeNumber(
			pricePatch.retailPrice,
			'price.retailPrice',
		)
	}
	if (pricePatch.discount !== undefined) {
		pricePatch.discount = requireNonNegativeNumber(
			pricePatch.discount,
			'price.discount',
		)
	}
	if (pricePatch.wholesalePrice !== undefined) {
		pricePatch.wholesalePrice = requireNonNegativeNumber(
			pricePatch.wholesalePrice,
			'price.wholesalePrice',
		)
	}
	if (pricePatch.semiWholesalePrice !== undefined) {
		pricePatch.semiWholesalePrice = requireNonNegativeNumber(
			pricePatch.semiWholesalePrice,
			'price.semiWholesalePrice',
		)
	}
}

export const scopedInventoryAverageCost = async (
	productId: string,
): Promise<number | undefined> => {
	const rows = await offlineDb.inventory
		.where('productId')
		.equals(productId)
		.toArray()

	return rows.reduce(
		(acc, row) => {
			const rowQty = Number(row.quantity ?? 0)
			const rowCost = finiteCost(row.averageCost)
			return {
				cost: mergeQtyWeightedAverageCost(
					acc.cost,
					acc.costQty,
					rowCost,
					rowQty,
				),
				costQty: acc.costQty + (rowCost != null ? rowQty : 0),
			}
		},
		{ cost: undefined as number | undefined, costQty: 0 },
	).cost
}

const buildCatalogRecord = async (
	product: Product,
	tenantId: string,
	seeBuying: boolean,
): Promise<LocalCatalogProduct> => {
	const existing = await offlineDb.catalogProducts.get(product.productId)
	const averageCost = seeBuying
		? await scopedInventoryAverageCost(product.productId)
		: undefined

	return {
		...mergeProductIntoCatalogItem(existing, product, {
			seeBuying,
			averageCost,
		}),
		tenantId,
	}
}

const hasLocalEstablishedPurchase = async (productId: string) => {
	const invoices = await offlineDb.buyingInvoices.toArray()
	const warehouseIds = new Set<string>()
	let lockedWithoutWarehouse = false

	for (const invoice of invoices) {
		if (
			invoice.status === InvoiceStatus.DRAFT ||
			invoice.status === InvoiceStatus.CANCELLED ||
			invoice.status === InvoiceStatus.VOID ||
			invoice.status === InvoiceStatus.PENDING
		) {
			continue
		}

		if (!invoice.items?.some(item => item.productId === productId)) continue

		if (invoice.warehouseId) warehouseIds.add(invoice.warehouseId)
		else lockedWithoutWarehouse = true
	}

	return { warehouseIds, lockedWithoutWarehouse }
}

export const syncLocalOpeningAverageCost = async (
	productId: string,
	purchasePrice: number | undefined,
	currencyCode?: string,
) => {
	const openingCost = catalogCostToPrimary(
		purchasePrice,
		currencyCode,
		await getLocalCostCurrencyRates(),
	)

	if (openingCost == null) return

	const { warehouseIds, lockedWithoutWarehouse } =
		await hasLocalEstablishedPurchase(productId)

	if (lockedWithoutWarehouse) return

	const rows = await offlineDb.inventory
		.where('productId')
		.equals(productId)
		.toArray()

	for (const row of rows) {
		if (row.warehouseId && warehouseIds.has(row.warehouseId)) continue

		await offlineDb.inventory.put({
			...row,
			averageCost: openingCost,
			syncStatus: 'pending',
			updatedAt: nowIso(),
		})
	}
}

const applyLocalProductCreate = async (
	payload: Record<string, unknown>,
	tenantId: string,
	seeBuying: boolean,
) => {
	const name = requireNameMaxLength(
		requireNonEmptyString(payload.name ?? payload.latinName, 'name'),
		'name',
	)
	if (typeof payload.latinName === 'string') {
		payload.latinName = requireNameMaxLength(
			payload.latinName.trim(),
			'latinName',
		)
	}

	const productId = String(payload.productId ?? generateId())
	payload.productId = productId
	const additionalBarcodes = Array.isArray(payload.additionalBarcodes)
		? (payload.additionalBarcodes as string[])
		: undefined
	const normalizedBarcodes = normalizeProductBarcodes(
		productId,
		typeof payload.barcode === 'string' ? payload.barcode : undefined,
		additionalBarcodes,
	)
	await assertLocalBarcodeCollision(
		allBarcodes({ productId, ...normalizedBarcodes }),
	)
	const pricePatch = payload.price as Partial<Product['price']> | undefined
	if (pricePatch) applyPriceFieldRules(pricePatch)
	const product = withLocalMeta(
		{
			...payload,
			productId,
			name,
			barcode: normalizedBarcodes.barcode,
			additionalBarcodes: normalizedBarcodes.additionalBarcodes,
			price: payload.price ?? { retailPrice: 0, currency: 'USD' },
			status: (payload.status as Product['status']) ?? 'active',
		} as Product,
		'pending',
		productId,
	)

	await offlineDb.products.put(product)

	if (payload.quantity !== undefined) {
		const warehouseId =
			String(payload.warehouseId ?? '').trim() ||
			getOperationalWarehouseId() ||
			''
		if (!warehouseId) {
			throw new Error(
				'Exactly one warehouse must be selected to post invoices or change stock.',
			)
		}

		const quantity = requireNonNegativeNumber(payload.quantity, 'quantity')
		const price = payload.price as Product['price'] | undefined
		const openingCost = catalogCostToPrimary(
			price?.purchasePrice,
			price?.currency,
			await getLocalCostCurrencyRates(),
		)

		await offlineDb.inventory.put(
			withLocalMeta(
				{
					inventoryId: generateId(),
					productId,
					warehouseId,
					quantity,
					availableQuantity: availableQuantityFromStock(quantity),
					...(openingCost != null ? { averageCost: openingCost } : {}),
				},
				'pending',
			),
		)
	}

	await offlineDb.catalogProducts.put(
		await buildCatalogRecord(product, tenantId, seeBuying),
	)
}

const applyLocalProductPatch = async (
	path: string,
	payload: Record<string, unknown>,
	tenantId: string,
	seeBuying: boolean,
) => {
	const productId = path.split('/')[1]
	if (!productId) {
		throw new Error('Product not found.')
	}

	const existing = await offlineDb.products.get(productId)
	if (!existing) {
		throw new Error('Product not found.')
	}

	if (payload.name !== undefined) {
		payload.name = requireNameMaxLength(
			requireNonEmptyString(payload.name, 'name'),
			'name',
		)
	}

	if (payload.latinName !== undefined) {
		if (typeof payload.latinName !== 'string') {
			throw new Error('Invalid value for latinName.')
		}
		payload.latinName = requireNameMaxLength(
			payload.latinName.trim(),
			'latinName',
		)
	}

	if (
		payload.barcode !== undefined ||
		payload.additionalBarcodes !== undefined
	) {
		if (payload.barcode !== undefined && typeof payload.barcode !== 'string') {
			throw new Error('Invalid value for barcode.')
		}
		if (
			payload.additionalBarcodes !== undefined &&
			!Array.isArray(payload.additionalBarcodes)
		) {
			throw new Error('Invalid value for additionalBarcodes.')
		}

		const normalizedBarcodes = normalizeProductBarcodes(
			productId,
			payload.barcode !== undefined
				? (payload.barcode as string)
				: existing.barcode,
			payload.additionalBarcodes !== undefined
				? (payload.additionalBarcodes as string[])
				: existing.additionalBarcodes,
		)

		await assertLocalBarcodeCollision(
			allBarcodes({ productId, ...normalizedBarcodes }),
			productId,
		)

		payload.barcode = normalizedBarcodes.barcode ?? ''
		payload.additionalBarcodes = normalizedBarcodes.additionalBarcodes
	}

	const pricePatch = payload.price as Partial<Product['price']> | undefined
	if (pricePatch) applyPriceFieldRules(pricePatch)

	const nextPrice = pricePatch
		? { ...existing.price, ...pricePatch }
		: existing.price
	const updated = {
		...existing,
		...payload,
		price: nextPrice,
		syncStatus: 'pending' as const,
		updatedAt: nowIso(),
	}

	await offlineDb.products.put(updated)

	const nextPurchase = finiteCost(pricePatch?.purchasePrice)

	if (
		nextPurchase != null &&
		nextPurchase !== finiteCost(existing.price?.purchasePrice)
	) {
		await syncLocalOpeningAverageCost(
			productId,
			nextPurchase,
			nextPrice?.currency ?? existing.price?.currency,
		)
	}

	await offlineDb.catalogProducts.put(
		await buildCatalogRecord(updated, tenantId, seeBuying),
	)
}

const applyLocalProductDelete = async (path: string) => {
	const productId = path.split('/')[1]
	if (!productId) {
		throw new Error('Product not found.')
	}

	const existing = await offlineDb.products.get(productId)
	if (!existing) {
		throw new Error('Product not found.')
	}

	await offlineDb.products.delete(productId)
	await offlineDb.catalogProducts.delete(productId)
}

const runProductInventoryMutation = async (
	work: () => Promise<void>,
	outbox?: LocalMutationOutbox,
) => {
	await offlineDb.transaction(
		'rw',
		productInventoryMutationTables(),
		async () => {
			await work()
			if (outbox) await putOutboxEntry(outbox)
		},
	)
	if (outbox) notifyOutboxChanged()
}

export const applyLocalProductMutation = async (
	method: string,
	path: string,
	payload: Record<string, unknown>,
	outbox?: LocalMutationOutbox,
): Promise<void> => {
	const tenantId = await requireSessionTenantId()
	const seeBuying = await canSeeBuyingPrice()
	const op = method.toUpperCase()

	await runProductInventoryMutation(async () => {
		if (op === 'POST') {
			await applyLocalProductCreate(payload, tenantId, seeBuying)
			return
		}
		if (op === 'PATCH') {
			await applyLocalProductPatch(path, payload, tenantId, seeBuying)
			return
		}
		if (op === 'DELETE') {
			await applyLocalProductDelete(path)
			return
		}

		throw new Error(`Offline product mutation not supported: ${method} ${path}`)
	}, outbox)

	const { reloadTenantCatalogMemory, removeLocalCatalogProduct } =
		await import('./productCatalogStore')
	if (op === 'DELETE') {
		await removeLocalCatalogProduct(tenantId, path.split('/')[1])
		return
	}

	await reloadTenantCatalogMemory(tenantId)
}

export const applyLocalInventoryMutation = async (
	method: string,
	path: string,
	payload: Record<string, unknown>,
	outbox?: LocalMutationOutbox,
): Promise<void> => {
	await requireSessionTenantId()

	if (
		method.toUpperCase() !== 'PATCH' ||
		!path.startsWith('inventory/by-product/')
	) {
		throw new Error(
			`Offline inventory mutation not supported: ${method} ${path}`,
		)
	}

	const productId = path.split('/')[2]
	const warehouseId = requireNonEmptyString(payload.warehouseId, 'warehouseId')
	requireOperationalWarehouseId(warehouseId)

	if (!productId) {
		throw new Error('Inventory not found for product.')
	}

	await runProductInventoryMutation(async () => {
		const existing = await findLocalInventoryRow(productId, warehouseId)
		if (!existing) {
			throw new Error('Inventory not found for product.')
		}

		if (existing.warehouseId && existing.warehouseId !== warehouseId) {
			throw new Error(
				'Inventory warehouseId cannot be changed. Use warehouse transfer.',
			)
		}

		const next: LocalInventoryItem = {
			...existing,
			warehouseId,
			syncStatus: 'pending',
			updatedAt: nowIso(),
		}

		if (payload.quantity !== undefined) {
			next.quantity = requireNonNegativeNumber(payload.quantity, 'quantity')
			next.availableQuantity = availableQuantityFromStock(
				next.quantity,
				Number(existing.reservedQuantity ?? 0),
			)
		}

		if (payload.minQuantity !== undefined) {
			next.minQuantity = requireNonNegativeNumber(
				payload.minQuantity,
				'minQuantity',
			)
		}

		if (payload.shelfId !== undefined) {
			next.shelfId = requireNonEmptyString(payload.shelfId, 'shelfId')
		}

		await offlineDb.inventory.put(next)
	}, outbox)
}

const BULK_EDIT_PRODUCT_KEYS = [
	'categoryId',
	'supplierId',
	'unitId',
	'brandId',
] as const

/** Expand bulk-edit into per-product PATCH outbox rows sync/push already replays. */
export const applyLocalBulkEditProducts = async (
	body: Record<string, unknown>,
): Promise<{
	updated: string[]
	blocked: Array<{ productId: string; reason: string }>
}> => {
	const productIds = [
		...new Set(
			(Array.isArray(body.productIds) ? body.productIds : [])
				.map(id => (typeof id === 'string' ? id.trim() : ''))
				.filter(Boolean),
		),
	]

	if (!productIds.length) {
		throw new Error('productIds is required.')
	}

	const productPatch: Record<string, unknown> = {}
	for (const key of BULK_EDIT_PRODUCT_KEYS) {
		const value = body[key]
		if (typeof value === 'string' && value.trim()) {
			productPatch[key] = value.trim()
		}
	}

	if (
		body.discount !== undefined &&
		body.discount !== null &&
		body.discount !== ''
	) {
		productPatch.price = {
			discount: requireNonNegativeNumber(body.discount, 'discount'),
		}
	}

	const hasProductPatch = Object.keys(productPatch).length > 0
	const minQuantity =
		body.minQuantity !== undefined &&
		body.minQuantity !== null &&
		body.minQuantity !== ''
			? requireNonNegativeNumber(body.minQuantity, 'minQuantity')
			: undefined
	const warehouseId =
		typeof body.warehouseId === 'string' && body.warehouseId.trim()
			? body.warehouseId.trim()
			: undefined

	if (!hasProductPatch && minQuantity === undefined) {
		throw new Error('No valid fields to update.')
	}

	if (minQuantity !== undefined && !warehouseId) {
		throw new Error('warehouseId is required when minQuantity is set.')
	}

	const updated: string[] = []
	const blocked: Array<{ productId: string; reason: string }> = []

	for (const productId of productIds) {
		try {
			if (hasProductPatch) {
				const url = `products/${productId}`
				await applyLocalProductMutation('PATCH', url, productPatch, {
					entity: 'product',
					operation: 'update',
					url,
					method: 'PATCH',
					payload: productPatch,
					clientMutationId: generateId(),
				})
			}

			if (minQuantity !== undefined && warehouseId) {
				const url = `inventory/by-product/${productId}`
				const payload = { warehouseId, minQuantity }
				await applyLocalInventoryMutation('PATCH', url, payload, {
					entity: 'inventory',
					operation: 'update',
					url,
					method: 'PATCH',
					payload,
					clientMutationId: generateId(),
				})
			}

			updated.push(productId)
		} catch (error) {
			blocked.push({
				productId,
				reason:
					error instanceof Error
						? error.message
						: 'Product could not be updated.',
			})
		}
	}

	return { updated, blocked }
}

/** Online product PATCH: keep catalog cost in lockstep without a full catalog GET. */
export const applyOnlineProductCatalogEdit = async (
	productId: string,
	body: Partial<Omit<Product, 'productId' | 'price'>> & {
		price?: Partial<Product['price']>
	},
): Promise<void> => {
	const tenantId =
		(await getSyncMeta(SYNC_META_KEYS.sessionTenantId)) ||
		(await getSyncMeta(SYNC_META_KEYS.tenantId))
	if (!tenantId) return

	const existingCatalog = await offlineDb.catalogProducts.get(productId)
	const existingProduct = await offlineDb.products.get(productId)
	const product = existingProduct
		? existingProduct
		: existingCatalog
			? mapCatalogItemToProduct(existingCatalog)
			: undefined
	if (!product) return

	const seeBuying = await canSeeBuyingPrice()
	const purchasePrice = finiteCost(body.price?.purchasePrice)
	const nextCurrency = body.price?.currency ?? product.price?.currency

	await runProductInventoryMutation(async () => {
		if (purchasePrice != null) {
			await syncLocalOpeningAverageCost(productId, purchasePrice, nextCurrency)
		}

		const nextPrice = body.price
			? { ...product.price, ...body.price }
			: product.price
		const updated = { ...product, ...body, productId, price: nextPrice }

		if (existingProduct) {
			await offlineDb.products.put({
				...existingProduct,
				...updated,
				updatedAt: nowIso(),
			})
		}

		await offlineDb.catalogProducts.put(
			await buildCatalogRecord(updated, tenantId, seeBuying),
		)
	})

	const { reloadTenantCatalogMemory } = await import('./productCatalogStore')
	await reloadTenantCatalogMemory(tenantId)
}
