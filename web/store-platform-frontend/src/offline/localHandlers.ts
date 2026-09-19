import type { FetchArgs } from '@reduxjs/toolkit/query'

import {
	MISSING_PURCHASE_PRICE_DIGEST,
	MISSING_RETAIL_PRICE_DIGEST,
	NEGATIVE_QUANTITY_DIGEST,
	RETAIL_BELOW_PURCHASE_DIGEST,
	type PostSellingInvoiceBody,
	type PostBuyingInvoiceBody,
	type ProductsResponse,
	type CurrencySettings,
	type CurrencySettingItem,
	type InvoiceSettings,
	type InvoiceSettingsUpdate,
	type ProductNotificationsResponse,
	type ProductNotificationDigestResponse,
} from '../api/apiStore'
import { getWorkMode } from './workMode'
import {
	getWarehouseScopeIds,
	requireOperationalWarehouseId,
} from '../shared/warehouseScope'
import {
	applyLocalInventoryMutation,
	applyLocalProductMutation,
} from './localProductInventoryMutations'
import { searchProducts } from '../components/SellingInvoice/productSearch'
import { getPrimaryInvoiceCurrencyAmounts } from '../components/SellingInvoice/currencyDisplay'
import {
	buildLocalPeriodProductAggregates,
	mergeQtyWeightedAverageCost,
	pickBestSellerSummaryProduct,
	pickTopProfitSummaryProduct,
	resolveLocalSaleUnitCost,
	totalProfitFromAggregates,
} from '../components/SellingInvoice/invoiceProfitSummary'
import {
	finiteCost,
	findOversellLines,
	mergeInvoiceItemsPreservingUnitCost,
	ratesFromCurrencySettings,
} from 'store-domain'
import {
	filterDailyActionsByParams,
	parseDailyActionFiltersFromParams,
} from './dailyActionFilters'
import { offlineDb, getSyncMeta, setSyncMeta, SYNC_META_KEYS } from './db'
import {
	getLocalDailyActionsForOffline,
	getLocalInvoicesForOffline,
	getLocalBuyingInvoicesForOffline,
} from './offlineRetention'
import {
	addOutboxEntry,
	notifyOutboxChanged,
	putOutboxEntry,
	allocateNextInvoiceNumber,
	allocateNextBuyingInvoiceNumber,
	findDuplicateOutboxEntry,
	findLocalInventoryRow,
	getLocalNextInvoiceNumber,
	getLocalNextBuyingInvoiceNumber,
	saveLocalInvoice,
	saveLocalBuyingInvoice,
} from './localStore'
import type {
	LocalBuyingInvoice,
	LocalInvoice,
	LocalInventoryItem,
	OutboxEntity,
} from './types'
import {
	InsufficientStockCancelledError,
	requestInsufficientStockConfirmation,
} from './insufficientStockConfirmation'
import {
	formatSellingInvoiceNumber,
	formatBuyingInvoiceNumber,
} from '../shared/invoiceNumbering'
import {
	DailyActionType,
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
	InvoiceUiStatus,
} from '../shared/globalEnums'
import {
	generateId,
	nowIso,
	parseUrlPath,
	resolveRequestParams,
	withLocalMeta,
} from './utils'

const addFilterOption = (
	map: Map<string, { value: string; label: string }>,
	value?: string,
	label?: string,
) => {
	const normalizedValue = value?.trim()
	if (!normalizedValue) return

	const normalizedLabel = label?.trim() || normalizedValue
	map.set(normalizedValue, { value: normalizedValue, label: normalizedLabel })
}

const buildDailyActionFilterValues = (dailyActions: DailyAction[]) => {
	const entryTypeMap = new Map<string, { value: string; label: string }>()
	const productNameMap = new Map<string, { value: string; label: string }>()
	const supplierMap = new Map<string, { value: string; label: string }>()
	const customerMap = new Map<string, { value: string; label: string }>()

	for (const dailyAction of dailyActions) {
		const entryTypeValue =
			typeof dailyAction.entryType === 'string'
				? dailyAction.entryType
				: dailyAction.entryType?.value

		addFilterOption(entryTypeMap, entryTypeValue, entryTypeValue)
		addFilterOption(
			productNameMap,
			dailyAction.productName || dailyAction.productId,
			dailyAction.productName || dailyAction.productId,
		)
		addFilterOption(
			supplierMap,
			dailyAction.supplierId || dailyAction.supplierName,
			dailyAction.supplierName || dailyAction.supplierId,
		)
		addFilterOption(
			customerMap,
			dailyAction.customerId || dailyAction.customerName,
			dailyAction.customerName || dailyAction.customerId,
		)
	}

	return {
		entryType: [...entryTypeMap.values()],
		productName: [...productNameMap.values()],
		supplier: [...supplierMap.values()],
		customer: [...customerMap.values()],
	}
}

const filterByWarehouseScope = <T extends { warehouseId?: string }>(
	items: T[],
): T[] => {
	const scope = getWarehouseScopeIds()
	// Empty scope = no access (matches server ACL lockout; never leak Dexie).
	if (scope.length === 0) return []
	const allowed = new Set(scope)
	return items.filter(
		item => item.warehouseId !== undefined && allowed.has(item.warehouseId),
	)
}

const assertWarehouseInScope = (warehouseId?: string): boolean => {
	const scope = getWarehouseScopeIds()
	if (scope.length === 0 || !warehouseId) return false
	return scope.includes(warehouseId)
}

/** Product ids with stock in current warehouse scope. Empty scope = no access. */
const loadOfflineAccessibleProductIds = async (): Promise<string[]> => {
	const scope = getWarehouseScopeIds()
	if (scope.length === 0) return []

	const rows = filterByWarehouseScope(await offlineDb.inventory.toArray())
	return [
		...new Set(
			rows.map(row => row.productId).filter((id): id is string => Boolean(id)),
		),
	]
}

const filterProductsByWarehouseStock = async <T extends { productId?: string }>(
	products: T[],
): Promise<T[]> => {
	const accessibleProductIds = await loadOfflineAccessibleProductIds()
	if (accessibleProductIds.length === 0) return []
	const allowed = new Set(accessibleProductIds)
	return products.filter(
		product =>
			product.productId !== undefined && allowed.has(product.productId),
	)
}

/** note: sums qty across scoped warehouses; qty-weighted averageCost. */
const aggregateInventoryByProductId = <
	T extends {
		productId?: string
		quantity?: number
		availableQuantity?: number
		reservedQuantity?: number
		averageCost?: number
	},
>(
	items: T[],
): Map<string, T> => {
	const map = new Map<string, T>()
	const costQtyByProductId = new Map<string, number>()

	for (const item of items) {
		if (!item.productId) continue
		const existing = map.get(item.productId)
		const nextQty = Number(item.quantity ?? 0)
		const nextCost = finiteCost(item.averageCost)

		if (!existing) {
			map.set(item.productId, item)
			costQtyByProductId.set(item.productId, nextCost != null ? nextQty : 0)
			continue
		}

		const existingQty = Number(existing.quantity ?? 0)
		const existingCostQty = costQtyByProductId.get(item.productId) ?? 0
		const totalQty = existingQty + nextQty

		map.set(item.productId, {
			...existing,
			quantity: totalQty,
			availableQuantity:
				Number(existing.availableQuantity ?? 0) +
				Number(item.availableQuantity ?? 0),
			reservedQuantity:
				Number(existing.reservedQuantity ?? 0) +
				Number(item.reservedQuantity ?? 0),
			averageCost: mergeQtyWeightedAverageCost(
				existing.averageCost,
				existingCostQty,
				nextCost,
				nextQty,
			),
		})
		costQtyByProductId.set(
			item.productId,
			existingCostQty + (nextCost != null ? nextQty : 0),
		)
	}

	return map
}

const validateLocalSaleInventory = async (
	items: PostSellingInvoiceBody['items'],
	warehouseId: string,
): Promise<void> => {
	const allowOversell = (await getLocalInvoiceSettings()).allowOversell === true
	const availableByProductId = new Map<string, number>()

	for (const item of items) {
		const inventory = await findLocalInventoryRow(item.productId, warehouseId)
		availableByProductId.set(
			item.productId,
			Number(inventory?.availableQuantity ?? inventory?.quantity ?? 0),
		)
	}

	const insufficientItems = findOversellLines(
		items,
		availableByProductId,
		allowOversell,
	)

	if (insufficientItems.length === 0) return

	await requestInsufficientStockConfirmation(insufficientItems)
	throw new InsufficientStockCancelledError()
}

const mapInvoiceStatus = (status?: string) => {
	if (status === InvoiceStatus.DRAFT || status === InvoiceStatus.CANCELLED) {
		return status
	}
	if (status === InvoiceStatus.PAID) return InvoiceStatus.PAID
	if (status === InvoiceStatus.PARTIAL) return InvoiceStatus.PARTIAL
	return status ?? InvoiceStatus.CONFIRMED
}

const PERIOD_EXCLUDED_STATUSES = new Set<string>([
	InvoiceStatus.DRAFT,
	InvoiceStatus.CANCELLED,
	InvoiceStatus.VOID,
	InvoiceStatus.PENDING,
])

const isPeriodSummaryInvoice = (invoice: LocalInvoice) =>
	!PERIOD_EXCLUDED_STATUSES.has(
		String(invoice.status ?? InvoiceStatus.CONFIRMED),
	)

const parseSummaryDateRange = (params: URLSearchParams) => {
	const defaultDay = new Date()
	defaultDay.setHours(0, 0, 0, 0)

	const dateFrom = params.get('dateFrom')
	const dateTo = params.get('dateTo')

	const start = dateFrom ? new Date(dateFrom) : new Date(defaultDay)
	const end = dateTo ? new Date(dateTo) : new Date(defaultDay)

	start.setHours(0, 0, 0, 0)
	end.setHours(23, 59, 59, 999)

	if (start.getTime() > end.getTime()) {
		const swappedStart = new Date(end)
		const swappedEnd = new Date(start)

		swappedStart.setHours(0, 0, 0, 0)
		swappedEnd.setHours(23, 59, 59, 999)

		return { start: swappedStart, end: swappedEnd }
	}

	return { start, end }
}

const buildSellingInvoicesSummary = async (
	invoices: LocalInvoice[],
	params: URLSearchParams,
) => {
	const { start, end } = parseSummaryDateRange(params)

	const periodInvoices = invoices.filter(inv => {
		const issuedAt = inv.issuedAt ? new Date(inv.issuedAt) : null

		return (
			Boolean(issuedAt && issuedAt >= start && issuedAt <= end) &&
			isPeriodSummaryInvoice(inv)
		)
	})

	const todaySales = periodInvoices.reduce((total, inv) => {
		const { grandTotal } = getPrimaryInvoiceCurrencyAmounts(inv)

		return total + grandTotal
	}, 0)

	const { aggregates, profitReliable } = buildLocalPeriodProductAggregates(
		periodInvoices.map(invoice => ({
			items: invoice.items,
			grandTotal: getPrimaryInvoiceCurrencyAmounts(invoice).grandTotal,
		})),
	)

	return {
		todaySales,
		paidInvoices: invoices.filter(inv => inv.status === InvoiceStatus.PAID)
			.length,
		creditInvoices: invoices.filter(
			inv =>
				inv.paymentType === InvoicePaymentType.CREDIT &&
				inv.paymentStatus !== InvoicePaymentStatus.PAID,
		).length,
		totalReceivable: invoices.reduce((total, inv) => {
			const { remainingAmount } = getPrimaryInvoiceCurrencyAmounts(inv)

			return remainingAmount > 0 ? total + remainingAmount : total
		}, 0),
		averageOrder:
			periodInvoices.length > 0 ? todaySales / periodInvoices.length : 0,
		totalProfit: profitReliable ? totalProfitFromAggregates(aggregates) : 0,
		profitReliable,
		bestSeller: pickBestSellerSummaryProduct(aggregates),
		topProfitProduct: profitReliable
			? pickTopProfitSummaryProduct(aggregates)
			: null,
	}
}

const filterProducts = (
	products: Product[],
	params: URLSearchParams,
): ProductsResponse => {
	let filtered = [...products]

	const searchText = params.get('searchText')?.trim()
	if (searchText) {
		const limit = Number(params.get('limit'))
		const searchLimit =
			!Number.isNaN(limit) && limit > 0 ? limit : filtered.length
		filtered = searchProducts(filtered, searchText, searchLimit)
	}

	const supplierFilter = params.get('supplier')?.split(',').filter(Boolean)
	if (supplierFilter?.length) {
		filtered = filtered.filter(p =>
			supplierFilter.includes(p.supplierId ?? p.supplierName ?? ''),
		)
	}

	const brandFilter = params.get('brand')?.split(',').filter(Boolean)
	if (brandFilter?.length) {
		filtered = filtered.filter(p => brandFilter.includes(p.brandId ?? ''))
	}

	const categoryFilter = params.get('category')?.split(',').filter(Boolean)
	if (categoryFilter?.length) {
		filtered = filtered.filter(p =>
			categoryFilter.includes(p.categoryId ?? p.categoryName ?? ''),
		)
	}

	const stateFilter = params.get('state')?.split(',').filter(Boolean)
	if (stateFilter?.length) {
		filtered = filtered.filter(p => stateFilter.includes(p.status))
	}

	const limit = Number(params.get('limit'))
	const offset = Number(params.get('offset') ?? 0)

	const totalCount = filtered.length

	if (!Number.isNaN(limit) && limit > 0) {
		filtered = filtered.slice(offset, offset + limit)
	}

	return { products: filtered, totalCount }
}

const filterInvoices = (invoices: LocalInvoice[], params: URLSearchParams) => {
	let filtered = [...invoices]

	const customerId = params.get('customerId')?.trim()
	if (customerId) {
		filtered = filtered.filter(inv => inv.customerId === customerId)
	}

	const status = params.get('status')
	if (status && status !== 'all') {
		filtered = filtered.filter(inv => {
			if (status === InvoiceUiStatus.CREDIT) {
				return (
					inv.paymentType === InvoicePaymentType.CREDIT &&
					inv.paymentStatus !== InvoicePaymentStatus.PAID
				)
			}
			return inv.status === status || inv.paymentStatus === status
		})
	}

	const issuedDate = params.get('issuedDate')
	if (issuedDate) {
		const filterDate = new Date(issuedDate)
		filtered = filtered.filter(inv => {
			const issuedAt = inv.issuedAt ? new Date(inv.issuedAt) : null
			if (!issuedAt) return false
			return (
				issuedAt.getFullYear() === filterDate.getFullYear() &&
				issuedAt.getMonth() === filterDate.getMonth() &&
				issuedAt.getDate() === filterDate.getDate()
			)
		})
	}

	const searchText = params.get('searchText')?.trim().toLowerCase()
	if (searchText) {
		filtered = filtered.filter(inv => {
			const invoiceNumber = String(inv.invoiceNumber ?? '').toLowerCase()
			const customerName = String(inv.customerName ?? '').toLowerCase()
			return (
				invoiceNumber.includes(searchText) || customerName.includes(searchText)
			)
		})
	}

	return filtered
}

const filterBuyingInvoices = (
	invoices: LocalBuyingInvoice[],
	params: URLSearchParams,
) => {
	let filtered = [...invoices]

	const supplierId = params.get('supplierId')?.trim()
	if (supplierId) {
		filtered = filtered.filter(inv => inv.supplierId === supplierId)
	}

	const status = params.get('status')
	if (status && status !== 'all') {
		filtered = filtered.filter(inv => {
			if (status === InvoiceUiStatus.DRAFT) {
				return inv.status === InvoiceStatus.DRAFT
			}
			if (status === InvoiceUiStatus.CANCELLED) {
				return inv.status === InvoiceStatus.CANCELLED
			}
			if (status === InvoiceUiStatus.PAID) {
				return inv.status === InvoiceStatus.PAID
			}
			if (status === InvoiceUiStatus.PARTIAL) {
				return inv.status === InvoiceStatus.PARTIAL
			}
			if (status === InvoiceUiStatus.CREDIT) {
				return (
					inv.paymentType === InvoicePaymentType.CREDIT &&
					inv.paymentStatus !== InvoicePaymentStatus.PAID
				)
			}
			return true
		})
	}

	const issuedDate = params.get('issuedDate')
	if (issuedDate) {
		const filterDate = new Date(issuedDate)
		filtered = filtered.filter(inv => {
			const issuedAt = inv.issuedAt ? new Date(inv.issuedAt) : null
			if (!issuedAt) return false
			return (
				issuedAt.getFullYear() === filterDate.getFullYear() &&
				issuedAt.getMonth() === filterDate.getMonth() &&
				issuedAt.getDate() === filterDate.getDate()
			)
		})
	}

	const searchText = params.get('searchText')?.trim().toLowerCase()
	if (searchText) {
		filtered = filtered.filter(inv => {
			const invoiceNumber = String(inv.invoiceNumber ?? '').toLowerCase()
			const supplierName = String(inv.supplierName ?? '').toLowerCase()
			return (
				invoiceNumber.includes(searchText) || supplierName.includes(searchText)
			)
		})
	}

	return filtered
}

const buildBuyingInvoicesSummary = (invoices: LocalBuyingInvoice[]) => {
	const todayStart = new Date()
	todayStart.setHours(0, 0, 0, 0)
	const todayEnd = new Date()
	todayEnd.setHours(23, 59, 59, 999)

	const todaysInvoices = invoices.filter(inv => {
		const issuedAt = inv.issuedAt ? new Date(inv.issuedAt) : null
		return issuedAt && issuedAt >= todayStart && issuedAt <= todayEnd
	})

	const todayPurchases = todaysInvoices.reduce((total, inv) => {
		const { grandTotal } = getPrimaryInvoiceCurrencyAmounts(inv)
		return total + grandTotal
	}, 0)

	return {
		todayPurchases,
		paidInvoices: invoices.filter(inv => inv.status === InvoiceStatus.PAID)
			.length,
		creditInvoices: invoices.filter(
			inv =>
				inv.paymentType === InvoicePaymentType.CREDIT &&
				inv.paymentStatus !== InvoicePaymentStatus.PAID,
		).length,
		totalPayable: invoices.reduce((total, inv) => {
			const { remainingAmount } = getPrimaryInvoiceCurrencyAmounts(inv)
			return remainingAmount > 0 ? total + remainingAmount : total
		}, 0),
		averageOrder:
			todaysInvoices.length > 0 ? todayPurchases / todaysInvoices.length : 0,
	}
}

const entityFromUrl = (path: string, method: string): OutboxEntity | null => {
	const segment = path.split('/')[0]
	const map: Record<string, OutboxEntity> = {
		invoices: 'invoice',
		'selling-invoices': 'invoice',
		'buying-invoices': 'buyingInvoice',
		product: 'product',
		products: 'product',
		inventory: 'inventory',
		customers: 'customer',
		suppliers: 'supplier',
		partners: 'partner',
		categories: 'category',
		brands: 'brand',
		shelves: 'shelf',
		warehouses: 'warehouse',
		expenses: 'expense',
		'daily-actions': 'dailyAction',
		currencies: 'currency',
		units: 'unit',
		'user-settings': 'userSettings',
		'currency-settings': 'currencySettings',
		'invoice-settings': 'invoiceSettings',
	}

	if (method === 'PATCH' && segment === 'user-settings') return 'userSettings'
	if (method === 'PATCH' && segment === 'currency-settings')
		return 'currencySettings'
	if (method === 'PATCH' && segment === 'invoice-settings')
		return 'invoiceSettings'

	return map[segment] ?? null
}

const operationFromMethod = (
	method: string,
): 'create' | 'update' | 'delete' => {
	if (method === 'POST') return 'create'
	if (method === 'PATCH') return 'update'
	return 'delete'
}

const stampMissingLocalInvoiceUnitCosts = async <
	T extends { productId: string; unitCost?: number },
>(
	items: T[],
	warehouseId: string,
	existingItems?: T[],
): Promise<T[]> => {
	const unused = existingItems ? [...existingItems] : []
	const rates = ratesFromCurrencySettings(await getLocalCurrencySettings())

	return Promise.all(
		items.map(async item => {
			const existingIndex = unused.findIndex(
				row => row.productId && row.productId === item.productId,
			)

			if (existingIndex >= 0) {
				unused.splice(existingIndex, 1)

				return item
			}

			if (finiteCost(item.unitCost) != null) return item

			const inventory = await findLocalInventoryRow(item.productId, warehouseId)
			const product = await offlineDb.products.get(item.productId)
			const unitCost = resolveLocalSaleUnitCost(
				inventory?.averageCost,
				product?.price?.purchasePrice,
				product?.price?.currency,
				rates,
			)

			return unitCost == null ? item : { ...item, unitCost }
		}),
	)
}

const handlePostInvoice = async (
	body: PostSellingInvoiceBody & { invoiceId?: string },
) => {
	const invoiceId = body.invoiceId ?? generateId()
	const existingInvoice = await offlineDb.invoices.get(invoiceId)

	if (existingInvoice) {
		return {
			_id: invoiceId,
			invoiceId,
			invoiceNumber: existingInvoice.invoiceNumber,
		}
	}

	const duplicateOutbox = await findDuplicateOutboxEntry(
		'selling-invoices',
		'POST',
		{
			...body,
			invoiceId,
		} as Record<string, unknown>,
	)

	if (duplicateOutbox) {
		return {
			_id: invoiceId,
			invoiceId,
			invoiceNumber: String(
				body.invoiceNumber ?? (await getLocalNextInvoiceNumber()),
			),
		}
	}

	const clientMutationId = body.clientMutationId ?? generateId()
	const status = mapInvoiceStatus(body.status)
	const warehouseId = requireOperationalWarehouseId(body.warehouseId)

	if (
		status !== InvoiceStatus.DRAFT &&
		status !== InvoiceStatus.CANCELLED &&
		body.items?.length
	) {
		await validateLocalSaleInventory(body.items, warehouseId)
	}

	const allocatedNumber = await allocateNextInvoiceNumber()
	const invoiceNumber = formatSellingInvoiceNumber(allocatedNumber)
	let invoice: LocalInvoice | undefined

	await offlineDb.transaction(
		'rw',
		[
			offlineDb.invoices,
			offlineDb.inventory,
			offlineDb.products,
			offlineDb.syncMeta,
			offlineDb.outbox,
		],
		async () => {
			const items = body.items
				? await stampMissingLocalInvoiceUnitCosts(body.items, warehouseId)
				: body.items

			invoice = withLocalMeta(
				{
					invoiceId,
					invoiceNumber,
					customerId: body.customerId,
					customerName: body.customerName,
					salesPerson: body.salesPerson,
					paymentType: body.paymentType,
					items,
					status,
					paymentStatus: body.paymentStatus,
					currencyAmounts: body.currencyAmounts,
					notes: body.notes,
					warehouseId,
					issuedAt: body.issuedAt ?? nowIso(),
					createdAt: nowIso(),
				},
				'pending',
				clientMutationId,
			)

			await saveLocalInvoice(invoice)
			await putOutboxEntry({
				entity: 'invoice',
				operation: 'create',
				url: 'selling-invoices',
				method: 'POST',
				payload: {
					...body,
					invoiceId,
					clientMutationId,
					invoiceNumber,
					items: body.items.map(({ unitCost: _unitCost, ...item }) => item),
				},
				clientMutationId,
			})
		},
	)
	notifyOutboxChanged()

	return {
		_id: invoiceId,
		invoiceId,
		invoiceNumber: invoice?.invoiceNumber ?? invoiceNumber,
	}
}

const handlePostBuyingInvoice = async (body: PostBuyingInvoiceBody) => {
	const buyingInvoiceId = body.buyingInvoiceId ?? generateId()
	const existingInvoice = await offlineDb.buyingInvoices.get(buyingInvoiceId)

	if (existingInvoice) {
		return {
			_id: buyingInvoiceId,
			buyingInvoiceId,
			invoiceNumber: existingInvoice.invoiceNumber,
		}
	}

	const duplicateOutbox = await findDuplicateOutboxEntry(
		'buying-invoices',
		'POST',
		{
			...body,
			buyingInvoiceId,
		} as Record<string, unknown>,
	)

	if (duplicateOutbox) {
		return {
			_id: buyingInvoiceId,
			buyingInvoiceId,
			invoiceNumber: String(
				body.invoiceNumber ??
					formatBuyingInvoiceNumber(await getLocalNextBuyingInvoiceNumber()),
			),
		}
	}

	const clientMutationId = body.clientMutationId ?? generateId()
	const status = mapInvoiceStatus(body.status)
	const warehouseId = requireOperationalWarehouseId(body.warehouseId)
	const allocatedNumber = await allocateNextBuyingInvoiceNumber()
	const invoiceNumber =
		body.invoiceNumber ?? formatBuyingInvoiceNumber(allocatedNumber)

	const invoice: LocalBuyingInvoice = withLocalMeta(
		{
			buyingInvoiceId,
			invoiceNumber,
			supplierId: body.supplierId,
			supplierName: body.supplierName,
			paymentType: body.paymentType,
			items: body.items,
			status,
			paymentStatus: body.paymentStatus,
			currencyAmounts: body.currencyAmounts,
			notes: body.notes,
			warehouseId,
			issuedAt: body.issuedAt ?? nowIso(),
			createdAt: nowIso(),
			invoiceDiscount: body.invoiceDiscount,
			invoiceDiscountIsPercent: body.invoiceDiscountIsPercent,
		},
		'pending',
		clientMutationId,
	)

	await offlineDb.transaction(
		'rw',
		[
			offlineDb.buyingInvoices,
			offlineDb.inventory,
			offlineDb.syncMeta,
			offlineDb.outbox,
		],
		async () => {
			await saveLocalBuyingInvoice(invoice)
			await putOutboxEntry({
				entity: 'buyingInvoice',
				operation: 'create',
				url: 'buying-invoices',
				method: 'POST',
				payload: {
					...body,
					buyingInvoiceId,
					clientMutationId,
					invoiceNumber,
				},
				clientMutationId,
			})
		},
	)
	notifyOutboxChanged()

	return {
		_id: buyingInvoiceId,
		buyingInvoiceId,
		invoiceNumber: invoice.invoiceNumber,
	}
}

const getLocalCurrencySettings = async (): Promise<CurrencySettings> => {
	const settingsRaw = (
		await offlineDb.syncMeta.get(SYNC_META_KEYS.currencySettings)
	)?.value
	if (settingsRaw) {
		return JSON.parse(settingsRaw) as CurrencySettings
	}

	return {
		primaryCurrency: null,
		secondaryCurrencies: [],
	}
}

const getLocalInvoiceSettings = async (): Promise<InvoiceSettings> => {
	const settingsRaw = (
		await offlineDb.syncMeta.get(SYNC_META_KEYS.invoiceSettings)
	)?.value
	if (settingsRaw) {
		return JSON.parse(settingsRaw) as InvoiceSettings
	}

	return {
		noMergeInvoiceLines: false,
		allowOversell: false,
		displayName: '',
		address: '',
		phone: '',
		email: '',
		taxNumber: '',
		logoUrl: '',
		qrUrl: '',
		footerNote: '',
	}
}

const resolveLocalCurrencyFromSettings = async (
	item: Pick<CurrencySettingItem, 'currencyId' | 'name' | 'internalCode'>,
): Promise<
	Pick<CurrencySettingItem, 'currencyId' | 'name' | 'internalCode'>
> => {
	const normalizedName = item.name.trim()
	const normalizedCode = item.internalCode?.trim() || undefined

	if (item.currencyId) {
		const existing = await offlineDb.currencies.get(item.currencyId)
		if (existing) {
			await offlineDb.currencies.put({
				...existing,
				name: normalizedName,
				internalCode: normalizedCode,
				syncStatus:
					existing.syncStatus === 'synced' ? 'pending' : existing.syncStatus,
				updatedAt: nowIso(),
			})
			return {
				currencyId: existing.currencyId,
				name: normalizedName,
				internalCode: normalizedCode,
			}
		}
	}

	const all = await offlineDb.currencies.toArray()
	const byName = all.find(currency => currency.name === normalizedName)
	if (byName) {
		await offlineDb.currencies.put({
			...byName,
			name: normalizedName,
			internalCode: normalizedCode ?? byName.internalCode,
			syncStatus:
				byName.syncStatus === 'synced' ? 'pending' : byName.syncStatus,
			updatedAt: nowIso(),
		})
		return {
			currencyId: byName.currencyId,
			name: normalizedName,
			internalCode: normalizedCode ?? byName.internalCode,
		}
	}

	const currencyId = item.currencyId || generateId()
	await offlineDb.currencies.put(
		withLocalMeta(
			{
				currencyId,
				name: normalizedName,
				internalCode: normalizedCode,
			} as Currency,
			'pending',
			currencyId,
		),
	)

	return { currencyId, name: normalizedName, internalCode: normalizedCode }
}

const applyLocalCurrencySettingsUpdate = async (
	body: Pick<CurrencySettings, 'primaryCurrency' | 'secondaryCurrencies'>,
): Promise<CurrencySettings> => {
	const current = await getLocalCurrencySettings()
	const { primaryCurrency, secondaryCurrencies } = body

	if (primaryCurrency && !primaryCurrency.name?.trim()) {
		throw new Error('Primary currency name is required')
	}

	let resolvedPrimary: CurrencySettingItem | null = current.primaryCurrency

	if (primaryCurrency !== undefined) {
		resolvedPrimary = primaryCurrency
			? await resolveLocalCurrencyFromSettings(primaryCurrency)
			: null
	}

	const normalizedSecondary = Array.isArray(secondaryCurrencies)
		? secondaryCurrencies.filter(
				item => item?.name?.trim() && Number(item.exchangeRate) > 0,
			)
		: current.secondaryCurrencies

	const resolvedSecondary: CurrencySettingItem[] = await Promise.all(
		normalizedSecondary.map(async item => {
			const resolved = await resolveLocalCurrencyFromSettings(item)
			return {
				...resolved,
				exchangeRate: Number(item.exchangeRate),
				exchangeRateUnitCurrencyId: item.exchangeRateUnitCurrencyId,
			}
		}),
	)

	const previousSecondaryIds =
		current.secondaryCurrencies?.map(item => item.currencyId) ?? []
	const nextSecondaryIds = new Set(
		resolvedSecondary.map(item => item.currencyId),
	)

	for (const currencyId of previousSecondaryIds) {
		if (currencyId && !nextSecondaryIds.has(currencyId)) {
			await offlineDb.currencies.delete(currencyId)
		}
	}

	const updated: CurrencySettings = {
		...current,
		primaryCurrency: resolvedPrimary,
		secondaryCurrencies: resolvedSecondary,
		updatedAt: nowIso(),
	}

	await setSyncMeta(SYNC_META_KEYS.currencySettings, JSON.stringify(updated))

	return updated
}

const applyLocalInvoiceSettingsUpdate = async (
	payload: InvoiceSettingsUpdate,
): Promise<InvoiceSettings> => {
	const current = await getLocalInvoiceSettings()
	const updated: InvoiceSettings = {
		...current,
		...payload,
		noMergeInvoiceLines:
			payload.noMergeInvoiceLines ?? current.noMergeInvoiceLines ?? false,
		allowOversell: payload.allowOversell ?? current.allowOversell ?? false,
		updatedAt: nowIso(),
	}

	await setSyncMeta(SYNC_META_KEYS.invoiceSettings, JSON.stringify(updated))

	return updated
}

const handlePatchCurrencySettings = async (body: unknown) => {
	const payload = (body ?? {}) as Pick<
		CurrencySettings,
		'primaryCurrency' | 'secondaryCurrencies'
	>
	const duplicate = await findDuplicateOutboxEntry(
		'currency-settings',
		'PATCH',
		payload as Record<string, unknown>,
	)

	if (duplicate) {
		return getLocalCurrencySettings()
	}

	const clientMutationId = generateId()
	const updated = await applyLocalCurrencySettingsUpdate(payload)

	await addOutboxEntry({
		entity: 'currencySettings',
		operation: 'update',
		url: 'currency-settings',
		method: 'PATCH',
		payload,
		clientMutationId,
	})

	return updated
}

const handlePatchInvoiceSettings = async (body: unknown) => {
	const payload = (body ?? {}) as InvoiceSettingsUpdate
	const duplicate = await findDuplicateOutboxEntry(
		'invoice-settings',
		'PATCH',
		payload as Record<string, unknown>,
	)

	if (duplicate) {
		return getLocalInvoiceSettings()
	}

	const clientMutationId = generateId()
	const updated = await applyLocalInvoiceSettingsUpdate(payload)

	await addOutboxEntry({
		entity: 'invoiceSettings',
		operation: 'update',
		url: 'invoice-settings',
		method: 'PATCH',
		payload,
		clientMutationId,
	})

	return updated
}

const handleGenericMutation = async (
	path: string,
	method: string,
	body: unknown,
) => {
	const entity = entityFromUrl(path, method)
	if (!entity) {
		throw new Error(`Offline mutation not supported for ${path}`)
	}

	const payload = (body ?? {}) as Record<string, unknown>
	const duplicate = await findDuplicateOutboxEntry(path, method, payload)

	if (duplicate) {
		return {
			success: true,
			clientMutationId: duplicate.clientMutationId,
			offline: true,
			deduplicated: true,
		}
	}

	const clientMutationId = generateId()

	const outbox = {
		entity,
		operation: operationFromMethod(method),
		url: path,
		method,
		payload,
		clientMutationId,
	}

	if (entity === 'product') {
		await applyLocalProductMutation(method, path, payload, outbox)
	} else if (entity === 'inventory') {
		await applyLocalInventoryMutation(method, path, payload, outbox)
	} else if (entity === 'invoice') {
		await offlineDb.transaction(
			'rw',
			[
				offlineDb.invoices,
				offlineDb.products,
				offlineDb.inventory,
				offlineDb.syncMeta,
				offlineDb.outbox,
			],
			async () => {
				await applyLocalEntityMutation(entity, method, path, payload)
				await putOutboxEntry(outbox)
			},
		)
		notifyOutboxChanged()
	} else {
		await applyLocalEntityMutation(entity, method, path, payload)
		await addOutboxEntry(outbox)
	}

	return { success: true, clientMutationId, offline: true }
}

const applyLocalEntityMutation = async (
	entity: OutboxEntity,
	method: string,
	path: string,
	payload: Record<string, unknown>,
) => {
	const op = operationFromMethod(method)

	if (entity === 'customer' && op === 'create') {
		const name = String(payload.name ?? '').trim()
		if (!name) {
			throw new Error('Customer name is required')
		}
		// ponytail: O(n) local name scan; index normalized name if customer lists get huge
		const nameTaken = (await offlineDb.customers.toArray()).some(
			customer =>
				(customer.name ?? '').trim().toLowerCase() === name.toLowerCase(),
		)
		if (nameTaken) {
			throw new Error('Customer already exists in this tenant.')
		}

		const customerId = String(payload.customerId ?? generateId())
		payload.customerId = customerId
		payload.name = name
		await offlineDb.customers.put(
			withLocalMeta(
				{
					customerId,
					name,
					internalCode: payload.internalCode as string | undefined,
				} as Customer,
				'pending',
				customerId,
			),
		)
		return
	}

	if (entity === 'customer' && op === 'update') {
		const customerId = path.split('/')[1]
		const existing = await offlineDb.customers.get(customerId)
		if (existing) {
			await offlineDb.customers.put({
				...existing,
				...payload,
				syncStatus: 'pending',
				updatedAt: nowIso(),
			})
		}
		return
	}

	if (entity === 'customer' && op === 'delete') {
		await offlineDb.customers.delete(path.split('/')[1])
		return
	}

	if (entity === 'supplier' && op === 'create') {
		const name = String(payload.name ?? '').trim()
		if (!name) {
			throw new Error('Supplier name is required')
		}
		// ponytail: O(n) local name scan; index normalized name if supplier lists get huge
		const nameTaken = (await offlineDb.suppliers.toArray()).some(
			supplier =>
				(supplier.name ?? '').trim().toLowerCase() === name.toLowerCase(),
		)
		if (nameTaken) {
			throw new Error('Supplier already exists in this tenant.')
		}

		const supplierId = String(payload.supplierId ?? generateId())
		payload.supplierId = supplierId
		await offlineDb.suppliers.put(
			withLocalMeta(
				{
					supplierId,
					name,
				} as Supplier,
				'pending',
				supplierId,
			),
		)
		return
	}

	if (entity === 'supplier' && op === 'update') {
		const supplierId = path.split('/')[1]
		const existing = await offlineDb.suppliers.get(supplierId)
		if (existing) {
			await offlineDb.suppliers.put({
				...existing,
				...payload,
				syncStatus: 'pending',
				updatedAt: nowIso(),
			})
		}
		return
	}

	if (entity === 'supplier' && op === 'delete') {
		await offlineDb.suppliers.delete(path.split('/')[1])
		return
	}

	if (entity === 'partner' && op === 'create') {
		const partnerId = String(payload.partnerId ?? generateId())
		payload.partnerId = partnerId
		await offlineDb.partners.put(
			withLocalMeta(
				{
					partnerId,
					name: String(payload.name ?? ''),
				} as Partner,
				'pending',
				partnerId,
			),
		)
		return
	}

	if (entity === 'partner' && op === 'update') {
		const partnerId = path.split('/')[1]
		const existing = await offlineDb.partners.get(partnerId)
		if (existing) {
			await offlineDb.partners.put({
				...existing,
				...payload,
				syncStatus: 'pending',
				updatedAt: nowIso(),
			})
		}
		return
	}

	if (entity === 'partner' && op === 'delete') {
		await offlineDb.partners.delete(path.split('/')[1])
		return
	}

	if (entity === 'expense' && op === 'create') {
		const expenseId = String(payload.expenseId ?? generateId())
		payload.expenseId = expenseId
		await offlineDb.expenses.put(
			withLocalMeta(
				{
					expenseId,
					name: String(payload.name ?? ''),
				} as Expense,
				'pending',
				expenseId,
			),
		)
		return
	}

	if (entity === 'expense' && op === 'update') {
		const expenseId = path.split('/')[1]
		const existing = await offlineDb.expenses.get(expenseId)
		if (existing) {
			await offlineDb.expenses.put({
				...existing,
				...payload,
				syncStatus: 'pending',
				updatedAt: nowIso(),
			})
		}
		return
	}

	if (entity === 'expense' && op === 'delete') {
		await offlineDb.expenses.delete(path.split('/')[1])
		return
	}

	if (entity === 'dailyAction' && op === 'create') {
		const actionId = String(payload.actionId ?? generateId())
		payload.actionId = actionId
		payload.warehouseId = requireOperationalWarehouseId(
			typeof payload.warehouseId === 'string' ? payload.warehouseId : undefined,
		)
		await offlineDb.dailyActions.put(
			withLocalMeta(
				{
					...payload,
					actionId,
					entryType: payload.entryType as DailyAction['entryType'],
					currencyId: String(payload.currencyId ?? ''),
					currencyName: String(payload.currencyName ?? ''),
					invoiceDate: String(payload.invoiceDate ?? nowIso()),
				} as DailyAction,
				'pending',
				actionId,
			),
		)
		return
	}

	if (entity === 'dailyAction' && op === 'update') {
		const actionId = path.split('/')[1]
		const existing = await offlineDb.dailyActions.get(actionId)
		if (existing) {
			await offlineDb.dailyActions.put({
				...existing,
				...payload,
				syncStatus: 'pending',
				updatedAt: nowIso(),
			})
		}
		return
	}

	if (entity === 'dailyAction' && op === 'delete') {
		const actionIds = Array.isArray(payload.actionIds)
			? (payload.actionIds as string[])
			: [path.split('/')[1]].filter(Boolean)

		for (const actionId of actionIds) {
			await offlineDb.dailyActions.delete(actionId)
		}
		return
	}

	if (entity === 'category' && op === 'create') {
		const categoryId = String(payload.categoryId ?? generateId())
		payload.categoryId = categoryId
		await offlineDb.categories.put(
			withLocalMeta(
				{
					categoryId,
					name: String(payload.name ?? ''),
					description: payload.description as string | undefined,
				} as Category,
				'pending',
				categoryId,
			),
		)
		return
	}

	if (entity === 'brand' && op === 'create') {
		const brandId = String(payload.brandId ?? generateId())
		payload.brandId = brandId
		await offlineDb.brands.put(
			withLocalMeta(
				{
					brandId,
					name: String(payload.name ?? ''),
				} as Brand,
				'pending',
				brandId,
			),
		)
		return
	}

	if (entity === 'shelf' && op === 'create') {
		const shelfId = String(payload.shelfId ?? generateId())
		payload.shelfId = shelfId
		await offlineDb.shelves.put(
			withLocalMeta(
				{
					shelfId,
					name: String(payload.name ?? ''),
					description: payload.description as string | undefined,
				} as Shelf,
				'pending',
				shelfId,
			),
		)
		return
	}

	if (entity === 'warehouse' && op === 'create') {
		const warehouseId = String(payload.warehouseId ?? generateId())
		payload.warehouseId = warehouseId
		await offlineDb.warehouses.put(
			withLocalMeta(
				{
					warehouseId,
					name: String(payload.name ?? ''),
					code: payload.code as string | undefined,
				} as Warehouse,
				'pending',
				warehouseId,
			),
		)
		return
	}

	if (entity === 'currency' && op === 'create') {
		const currencyId = String(payload.currencyId ?? generateId())
		payload.currencyId = currencyId
		await offlineDb.currencies.put(
			withLocalMeta(
				{
					currencyId,
					name: String(payload.name ?? ''),
				} as Currency,
				'pending',
				currencyId,
			),
		)
		return
	}

	if (entity === 'unit' && op === 'create') {
		const unitId = String(payload.unitId ?? generateId())
		payload.unitId = unitId
		await offlineDb.units.put(
			withLocalMeta(
				{
					unitId,
					name: String(payload.name ?? ''),
				} as Unit,
				'pending',
				unitId,
			),
		)
	}

	if (entity === 'userSettings' && op === 'update') {
		const settingsRaw = (await offlineDb.syncMeta.get('userSettings'))?.value
		const current = settingsRaw ? JSON.parse(settingsRaw) : {}
		await setSyncMeta(
			'userSettings',
			JSON.stringify({ ...current, ...payload, updatedAt: nowIso() }),
		)
	}

	if (entity === 'currencySettings' && op === 'update') {
		await applyLocalCurrencySettingsUpdate(
			payload as Pick<
				CurrencySettings,
				'primaryCurrency' | 'secondaryCurrencies'
			>,
		)
	}

	if (entity === 'invoiceSettings' && op === 'update') {
		await applyLocalInvoiceSettingsUpdate(payload as InvoiceSettingsUpdate)
	}

	if (entity === 'invoice' && op === 'update') {
		const invoiceId = path.split('/')[1]
		const existing = await offlineDb.invoices.get(invoiceId)
		if (!existing) {
			throw new Error('Invoice not found.')
		}

		const nextItems = Array.isArray(payload.items)
			? mergeInvoiceItemsPreservingUnitCost(
					existing.items,
					payload.items as NonNullable<LocalInvoice['items']>,
				)
			: undefined
		if (nextItems) {
			payload.items = await stampMissingLocalInvoiceUnitCosts(
				nextItems,
				String(payload.warehouseId ?? existing.warehouseId ?? ''),
				existing.items,
			)
		}

		await offlineDb.invoices.put({
			...existing,
			...payload,
			invoiceId,
			syncStatus: 'pending',
			updatedAt: nowIso(),
		})
		return
	}

	if (entity === 'invoice' && op === 'delete') {
		await offlineDb.invoices.delete(path.split('/')[1])
	}

	if (entity === 'buyingInvoice' && op === 'update') {
		const buyingInvoiceId = path.split('/')[1]
		const existing = await offlineDb.buyingInvoices.get(buyingInvoiceId)
		if (existing) {
			await offlineDb.buyingInvoices.put({
				...existing,
				...payload,
				buyingInvoiceId,
				syncStatus: 'pending',
				updatedAt: nowIso(),
			})
		}
		return
	}

	if (entity === 'buyingInvoice' && op === 'delete') {
		await offlineDb.buyingInvoices.delete(path.split('/')[1])
	}
}

const SETTINGS_MUTATION_PATHS = new Set([
	'user-settings',
	'currency-settings',
	'invoice-settings',
	'label-templates',
])

const settingsLockedOfflineError = () =>
	({
		error: {
			status: 403,
			data: {
				message:
					'Settings cannot be changed while offline. Switch to online mode first.',
				code: 'SETTINGS_LOCKED_OFFLINE',
			},
		},
	}) as const

const withLocalInventory = (
	product: Product,
	inventoryByProductId: Map<string, LocalInventoryItem>,
): Product => {
	const row = inventoryByProductId.get(product.productId)

	return row
		? { ...product, inventory: { ...product.inventory, ...row } }
		: product
}

const buildOfflineDigest = async (
	digestType: string,
	cached: ProductNotificationDigestResponse | null,
): Promise<ProductNotificationDigestResponse> => {
	const [products, inventory] = await Promise.all([
		offlineDb.products.toArray(),
		offlineDb.inventory.toArray(),
	])
	const inventoryByProductId = aggregateInventoryByProductId(
		filterByWarehouseScope(inventory),
	)
	const hydrate = (product: Product) =>
		withLocalInventory(product, inventoryByProductId)

	if (cached) {
		const localById = new Map(
			products.map(product => [product.productId, product]),
		)

		return {
			runAt: cached.runAt,
			products: cached.products.flatMap(product => {
				const local = localById.get(product.productId)

				return local ? [hydrate(local)] : [hydrate(product)]
			}),
		}
	}

	// ponytail: no cached 03:00 snapshot IDs offline; live local qty/price. Online digest cache pins the snapshot.
	const runAt =
		(await getSyncMeta(SYNC_META_KEYS.lastSyncedAt)) ||
		new Date(0).toISOString()

	if (digestType === MISSING_PURCHASE_PRICE_DIGEST) {
		return {
			runAt,
			products: products
				.filter(
					product =>
						!(
							typeof product.price?.purchasePrice === 'number' &&
							product.price.purchasePrice > 0
						),
				)
				.map(hydrate),
		}
	}

	if (digestType === MISSING_RETAIL_PRICE_DIGEST) {
		return {
			runAt,
			products: products
				.filter(
					product =>
						!(
							typeof product.price?.retailPrice === 'number' &&
							product.price.retailPrice > 0
						),
				)
				.map(hydrate),
		}
	}

	if (digestType === RETAIL_BELOW_PURCHASE_DIGEST) {
		return {
			runAt,
			products: products
				.filter(product => {
					const purchasePrice = product.price?.purchasePrice
					const retailPrice = product.price?.retailPrice

					return (
						typeof purchasePrice === 'number' &&
						purchasePrice > 0 &&
						typeof retailPrice === 'number' &&
						retailPrice > 0 &&
						retailPrice < purchasePrice
					)
				})
				.map(hydrate),
		}
	}

	return {
		runAt,
		products: products
			.filter(product => {
				const quantity =
					inventoryByProductId.get(product.productId)?.quantity ??
					product.inventory?.quantity

				return typeof quantity === 'number' && quantity < 0
			})
			.map(hydrate),
	}
}

export const handleOfflineQuery = async (
	args: string | FetchArgs,
): Promise<
	| { data: unknown }
	| { error: { status: number; data: { message: string; code?: string } } }
> => {
	const url = typeof args === 'string' ? args : args.url
	const method =
		(typeof args === 'string' ? 'GET' : args.method)?.toUpperCase() ?? 'GET'
	const body = typeof args === 'string' ? undefined : args.body

	const { path } = parseUrlPath(url)
	const params = resolveRequestParams(args)

	if (
		['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) &&
		SETTINGS_MUTATION_PATHS.has(path.split('/')[0]) &&
		getWorkMode() === 'offline'
	) {
		return settingsLockedOfflineError()
	}

	try {
		if (method === 'GET') {
			if (path === 'products/catalog') {
				const tenantId = await getSyncMeta(SYNC_META_KEYS.sessionTenantId)
				const storedScope = tenantId
					? await getSyncMeta(`${SYNC_META_KEYS.catalogScope}:${tenantId}`)
					: null
				const currentScope = getWarehouseScopeIds().join(',')
				const catalogProducts =
					tenantId && storedScope === currentScope
						? await offlineDb.catalogProducts
								.where('tenantId')
								.equals(tenantId)
								.toArray()
						: []
				const includeAll =
					params.get('all') === '1' || params.get('all') === 'true'
				const products = includeAll
					? catalogProducts
					: await filterProductsByWarehouseStock(catalogProducts)

				return {
					data: {
						products,
						totalCount: products.length,
					},
				}
			}

			if (path === 'products/notifications/digest') {
				const tenantId = await getSyncMeta(SYNC_META_KEYS.sessionTenantId)
				const digestType = params.get('type') || NEGATIVE_QUANTITY_DIGEST
				const cachedRaw = tenantId
					? (await getSyncMeta(
							`${SYNC_META_KEYS.productNotificationDigest}:${tenantId}:${digestType}`,
						)) ||
						(digestType === NEGATIVE_QUANTITY_DIGEST
							? await getSyncMeta(
									`${SYNC_META_KEYS.productNotificationDigest}:${tenantId}`,
								)
							: null)
					: null
				const cached = cachedRaw
					? (JSON.parse(cachedRaw) as ProductNotificationDigestResponse)
					: null

				return { data: await buildOfflineDigest(digestType, cached) }
			}

			if (path === 'products/notifications') {
				const tenantId = await getSyncMeta(SYNC_META_KEYS.sessionTenantId)
				const cached = tenantId
					? await getSyncMeta(
							`${SYNC_META_KEYS.productNotifications}:${tenantId}`,
						)
					: null

				if (cached) {
					return {
						data: JSON.parse(cached) as ProductNotificationsResponse,
					}
				}

				return {
					error: {
						status: 503,
						data: { message: 'Offline data unavailable' },
					},
				}
			}

			if (path === 'products' || path.startsWith('products/')) {
				const inventoryByProductId = aggregateInventoryByProductId(
					filterByWarehouseScope(await offlineDb.inventory.toArray()),
				)
				if (path !== 'products') {
					const productId = path.split('/')[1]
					const product = await offlineDb.products.get(productId)
					if (!product) {
						return {
							error: { status: 404, data: { message: 'Product not found' } },
						}
					}
					const accessible = await filterProductsByWarehouseStock([product])
					if (accessible.length === 0) {
						return {
							error: { status: 404, data: { message: 'Product not found' } },
						}
					}
					return {
						data: withLocalInventory(accessible[0], inventoryByProductId),
					}
				}

				const products = await filterProductsByWarehouseStock(
					await offlineDb.products.toArray(),
				)
				return {
					data: filterProducts(
						products.map(product =>
							withLocalInventory(product, inventoryByProductId),
						),
						params,
					),
				}
			}

			if (path === 'inventory') {
				const inventory = filterByWarehouseScope(
					await offlineDb.inventory.toArray(),
				)
				return { data: inventory }
			}

			if (path === 'inventory/warehouse-transfers') {
				// note: offline has no StockMoving ledger; empty until online sync.
				return { data: { data: [] } }
			}

			if (path.startsWith('inventory/by-product/')) {
				const productId = path.split('/')[2]
				const rows = filterByWarehouseScope(
					(await offlineDb.inventory.toArray()).filter(
						row => row.productId === productId && Boolean(row.warehouseId),
					),
				)
				return {
					data: {
						data: rows.map(row => ({
							warehouseId: row.warehouseId as string,
							quantity: Number(row.quantity ?? 0),
							availableQuantity: Number(
								row.availableQuantity ?? row.quantity ?? 0,
							),
						})),
					},
				}
			}

			if (path === 'customers' || path.startsWith('customers/')) {
				if (path !== 'customers') {
					const customer = await offlineDb.customers.get(path.split('/')[1])
					if (!customer) {
						return {
							error: { status: 404, data: { message: 'Customer not found' } },
						}
					}
					const relatedActions = (
						await getLocalDailyActionsForOffline()
					).filter(
						action =>
							action.entryType !== DailyActionType.BUYING_ENTRY &&
							(action.customerId === customer.customerId ||
								// Legacy rows may still store internalCode as customerId.
								(!!customer.internalCode &&
									action.customerId === customer.internalCode)),
					)
					return { data: { ...customer, relatedActions } }
				}
				const data = await offlineDb.customers.toArray()
				return { data: { data, totalCount: data.length } }
			}

			if (path === 'suppliers' || path.startsWith('suppliers/')) {
				if (path !== 'suppliers') {
					const supplier = await offlineDb.suppliers.get(path.split('/')[1])
					if (!supplier) {
						return {
							error: { status: 404, data: { message: 'Supplier not found' } },
						}
					}
					const relatedActions = (
						await getLocalDailyActionsForOffline()
					).filter(
						action =>
							action.supplierId === supplier.supplierId ||
							// Legacy rows may still store internalCode as supplierId.
							(!!supplier.internalCode &&
								action.supplierId === supplier.internalCode),
					)
					return { data: { ...supplier, relatedActions } }
				}
				const data = await offlineDb.suppliers.toArray()
				return { data: { data, totalCount: data.length } }
			}

			if (path === 'partners' || path.startsWith('partners/')) {
				if (path !== 'partners') {
					const partner = await offlineDb.partners.get(path.split('/')[1])
					if (!partner) {
						return {
							error: { status: 404, data: { message: 'Partner not found' } },
						}
					}
					return { data: partner }
				}
				const data = await offlineDb.partners.toArray()
				return { data: { data, totalCount: data.length } }
			}

			if (path === 'categories') {
				const data = await offlineDb.categories.toArray()
				return { data: { data, totalCount: data.length } }
			}

			if (path === 'brands' || path.startsWith('brands/')) {
				if (path !== 'brands') {
					const brand = await offlineDb.brands.get(path.split('/')[1])
					return brand
						? { data: brand }
						: { error: { status: 404, data: { message: 'Brand not found' } } }
				}
				const data = await offlineDb.brands.toArray()
				return { data: { data, totalCount: data.length } }
			}

			if (path === 'shelves' || path.startsWith('shelves/')) {
				if (path !== 'shelves') {
					const shelf = await offlineDb.shelves.get(path.split('/')[1])
					return shelf
						? { data: shelf }
						: { error: { status: 404, data: { message: 'Shelf not found' } } }
				}
				const data = await offlineDb.shelves.toArray()
				return { data: { data, totalCount: data.length } }
			}

			if (path === 'warehouses' || path.startsWith('warehouses/')) {
				if (path !== 'warehouses') {
					const warehouse = await offlineDb.warehouses.get(path.split('/')[1])
					return warehouse
						? { data: warehouse }
						: {
								error: {
									status: 404,
									data: { message: 'Warehouse not found' },
								},
							}
				}
				const data = await offlineDb.warehouses.toArray()
				return { data: { data, totalCount: data.length } }
			}

			if (path === 'currencies') {
				const data = await offlineDb.currencies.toArray()
				return { data: { data, totalCount: data.length } }
			}

			if (path === 'units') {
				const data = await offlineDb.units.toArray()
				return { data: { data, totalCount: data.length } }
			}

			if (path === 'expenses' || path.startsWith('expenses/')) {
				if (path !== 'expenses') {
					const expense = await offlineDb.expenses.get(path.split('/')[1])
					return expense
						? { data: expense }
						: {
								error: { status: 404, data: { message: 'Expense not found' } },
							}
				}
				const data = await offlineDb.expenses.toArray()
				return { data: { data, totalCount: data.length } }
			}

			if (path === 'daily-actions/filter-values') {
				const actions = filterByWarehouseScope(
					await getLocalDailyActionsForOffline(),
				)
				return { data: buildDailyActionFilterValues(actions) }
			}

			if (path === 'daily-actions' || path.startsWith('daily-actions/')) {
				if (path !== 'daily-actions') {
					const action = await offlineDb.dailyActions.get(path.split('/')[1])
					return action && assertWarehouseInScope(action.warehouseId)
						? { data: action }
						: {
								error: {
									status: 404,
									data: { message: 'Daily action not found' },
								},
							}
				}
				const actions = filterDailyActionsByParams(
					filterByWarehouseScope(await getLocalDailyActionsForOffline()),
					parseDailyActionFiltersFromParams(params),
				)
				return { data: { data: actions, totalCount: actions.length } }
			}

			if (path.match(/^user\/[^/]+\/frontend-resources$/)) {
				const resourcesRaw = (
					await offlineDb.syncMeta.get(SYNC_META_KEYS.frontendResources)
				)?.value

				if (resourcesRaw) {
					return {
						data: {
							frontendResources: JSON.parse(
								resourcesRaw,
							) as FrontendResources[],
						},
					}
				}

				return {
					error: {
						status: 404,
						data: {
							message: 'Frontend resources not found. Please sync online.',
						},
					},
				}
			}

			if (
				path === 'selling-invoices' ||
				path.startsWith('selling-invoices/') ||
				path === 'invoices' ||
				path.startsWith('invoices/')
			) {
				const isCollection = path === 'selling-invoices' || path === 'invoices'
				if (!isCollection) {
					const invoice = await offlineDb.invoices.get(path.split('/')[1])
					if (!invoice || !assertWarehouseInScope(invoice.warehouseId)) {
						return {
							error: {
								status: 404,
								data: { message: 'Invoice not found' },
							},
						}
					}
					return { data: invoice }
				}

				const invoices = filterByWarehouseScope(
					await getLocalInvoicesForOffline(),
				)
				const filtered = filterInvoices(invoices, params)
				const nextInvoiceNumber = await getLocalNextInvoiceNumber()

				return {
					data: {
						invoices: filtered,
						summary: await buildSellingInvoicesSummary(invoices, params),
						nextInvoiceNumber,
						totalCount: filtered.length,
					},
				}
			}

			if (path === 'buying-invoices' || path.startsWith('buying-invoices/')) {
				const isCollection = path === 'buying-invoices'
				if (!isCollection) {
					const buyingInvoice = await offlineDb.buyingInvoices.get(
						path.split('/')[1],
					)
					if (
						!buyingInvoice ||
						!assertWarehouseInScope(buyingInvoice.warehouseId)
					) {
						return {
							error: {
								status: 404,
								data: { message: 'Buying invoice not found' },
							},
						}
					}
					return { data: buyingInvoice }
				}

				const invoices = filterByWarehouseScope(
					await getLocalBuyingInvoicesForOffline(),
				)
				const filtered = filterBuyingInvoices(invoices, params)
				const nextInvoiceNumber = await getLocalNextBuyingInvoiceNumber()

				return {
					data: {
						invoices: filtered,
						summary: buildBuyingInvoicesSummary(invoices),
						nextInvoiceNumber,
						totalCount: filtered.length,
					},
				}
			}

			if (path === 'user-settings') {
				const settingsRaw = (await offlineDb.syncMeta.get('userSettings'))
					?.value
				if (settingsRaw) {
					return { data: JSON.parse(settingsRaw) }
				}
				return {
					error: { status: 404, data: { message: 'Settings not found' } },
				}
			}

			if (path === 'currency-settings') {
				return { data: await getLocalCurrencySettings() }
			}

			if (path === 'invoice-settings') {
				return { data: await getLocalInvoiceSettings() }
			}

			if (path === 'filter-values') {
				const [products, suppliersList, brandsList, categoriesList] =
					await Promise.all([
						offlineDb.products.toArray(),
						offlineDb.suppliers.toArray(),
						offlineDb.brands.toArray(),
						offlineDb.categories.toArray(),
					])
				const supplierNameById = new Map(
					suppliersList.map(supplier => [supplier.supplierId, supplier.name]),
				)
				const brandNameById = new Map(
					brandsList.map(brand => [brand.brandId, brand.name]),
				)
				const categoryNameById = new Map(
					categoriesList.map(category => [category.categoryId, category.name]),
				)
				const suppliers = new Map<string, string>()
				const brands = new Map<string, string>()
				const categories = new Map<string, string>()

				for (const product of products) {
					if (product.supplierId) {
						suppliers.set(
							product.supplierId,
							product.supplierName ||
								supplierNameById.get(product.supplierId) ||
								product.supplierId,
						)
					}
					if (product.brandId) {
						brands.set(
							product.brandId,
							product.brandName ||
								brandNameById.get(product.brandId) ||
								product.brandId,
						)
					}
					if (product.categoryId) {
						categories.set(
							product.categoryId,
							product.categoryName ||
								categoryNameById.get(product.categoryId) ||
								product.categoryId,
						)
					}
				}

				return {
					data: {
						supplier: [...suppliers.entries()].map(([value, label]) => ({
							value,
							label,
						})),
						brand: [...brands.entries()].map(([value, label]) => ({
							value,
							label,
						})),
						category: [...categories.entries()].map(([value, label]) => ({
							value,
							label,
						})),
						state: [
							{ value: 'active', label: 'active' },
							{ value: 'inactive', label: 'inactive' },
							{ value: 'discontinued', label: 'discontinued' },
						],
					},
				}
			}

			return {
				error: {
					status: 503,
					data: { message: `Offline read not available for ${path}` },
				},
			}
		}

		if (method === 'POST' && path === 'products/notifications/read') {
			return {
				error: {
					status: 503,
					data: { message: 'Offline data unavailable' },
				},
			}
		}

		if (
			method === 'POST' &&
			(path === 'selling-invoices' || path === 'invoices')
		) {
			const data = await handlePostInvoice(body as PostSellingInvoiceBody)
			return { data }
		}

		if (method === 'POST' && path === 'buying-invoices') {
			const data = await handlePostBuyingInvoice(body as PostBuyingInvoiceBody)
			return { data }
		}

		if (method === 'POST' && path === 'inventory/warehouse-transfer') {
			return {
				error: {
					status: 503,
					data: {
						message: 'Warehouse transfer requires an online connection.',
					},
				},
			}
		}

		if (
			(method === 'PATCH' || method === 'DELETE') &&
			path.startsWith('inventory/warehouse-transfers/')
		) {
			return {
				error: {
					status: 503,
					data: {
						message: 'Warehouse transfer requires an online connection.',
					},
				},
			}
		}

		if (method === 'PATCH' && path === 'currency-settings') {
			const data = await handlePatchCurrencySettings(body)
			return { data }
		}

		if (method === 'PATCH' && path === 'invoice-settings') {
			const data = await handlePatchInvoiceSettings(body)
			return { data }
		}

		if (['POST', 'PATCH', 'DELETE'].includes(method)) {
			const data = await handleGenericMutation(path, method, body)
			return { data }
		}

		return {
			error: {
				status: 503,
				data: { message: `Offline request not supported: ${method} ${path}` },
			},
		}
	} catch (error) {
		if (error instanceof InsufficientStockCancelledError) {
			return {
				error: {
					status: 409,
					data: {
						message: error.message,
						code: 'INSUFFICIENT_STOCK_CANCELLED',
					},
				},
			}
		}

		const message = error instanceof Error ? error.message : 'Offline error'
		return { error: { status: 500, data: { message } } }
	}
}

export const isOfflineCapableEndpoint = (url: string): boolean => {
	const { path } = parseUrlPath(url)
	const unsupported = new Set([
		'login',
		'refresh',
		'logout',
		'logout-all',
		'sync/bootstrap',
		'sync/changes',
		'sync/push',
	])
	if (unsupported.has(path)) return false
	if (/^products\/[^/]+\/barcode$/.test(path)) return false
	if (path.startsWith('buying-invoices/extract')) return false
	if (path.startsWith('buying-invoices/invoice-ai-usage')) return false
	if (path.startsWith('buying-invoices/confirm-match')) return false
	if (path.startsWith('reports/chat')) return false
	if (path.startsWith('reports/watch')) return false
	if (path.startsWith('tenants')) return false
	if (path.startsWith('subscription')) return false
	if (path.startsWith('users')) return false
	if (path.startsWith('employees')) return false
	if (path.startsWith('user/')) return true
	return true
}
