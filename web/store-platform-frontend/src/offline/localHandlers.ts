import type { FetchArgs } from '@reduxjs/toolkit/query'

import type { PostSellingInvoiceBody, ProductsResponse } from '../api/apiStore'
import {
	filterDailyActionsByParams,
	parseDailyActionFiltersFromParams,
} from './dailyActionFilters'
import { offlineDb, setSyncMeta, SYNC_META_KEYS } from './db'
import {
	getLocalDailyActionsForOffline,
	getLocalInvoicesForOffline,
} from './offlineRetention'
import {
	addOutboxEntry,
	allocateNextInvoiceNumber,
	findDuplicateOutboxEntry,
	getLocalNextInvoiceNumber,
	saveLocalInvoice,
} from './localStore'
import type { LocalInvoice, OutboxEntity } from './types'
import {
	InsufficientStockCancelledError,
	requestInsufficientStockConfirmation,
	type InsufficientStockItem,
} from './insufficientStockConfirmation'
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

const validateLocalSaleInventory = async (
	items: PostSellingInvoiceBody['items'],
): Promise<void> => {
	const insufficientItems: InsufficientStockItem[] = []

	for (const item of items) {
		const inventory = await offlineDb.inventory
			.where('productId')
			.equals(item.productId)
			.first()
		const available = Number(
			inventory?.availableQuantity ?? inventory?.quantity ?? 0,
		)

		if (available < item.quantity) {
			insufficientItems.push({
				productId: item.productId,
				name: item.name,
				requested: item.quantity,
				available,
			})
		}
	}

	if (insufficientItems.length === 0) return

	const confirmed =
		await requestInsufficientStockConfirmation(insufficientItems)
	if (!confirmed) {
		throw new InsufficientStockCancelledError()
	}
}

const mapInvoiceStatus = (status?: string) => {
	if (status === 'draft' || status === 'cancelled') return status
	if (status === 'paid') return 'paid'
	if (status === 'partial') return 'partial'
	return status ?? 'confirmed'
}

const buildSellingInvoicesSummary = (invoices: LocalInvoice[]) => {
	const todayStart = new Date()
	todayStart.setHours(0, 0, 0, 0)
	const todayEnd = new Date()
	todayEnd.setHours(23, 59, 59, 999)

	const todaysInvoices = invoices.filter(inv => {
		const issuedAt = inv.issuedAt ? new Date(inv.issuedAt) : null
		return issuedAt && issuedAt >= todayStart && issuedAt <= todayEnd
	})

	const todaySales = todaysInvoices.reduce(
		(total, inv) => total + (Number(inv.amount) || 0),
		0,
	)

	return {
		todaySales,
		paidInvoices: invoices.filter(inv => inv.status === 'paid').length,
		creditInvoices: invoices.filter(
			inv => inv.paymentType === 'credit' && inv.paymentStatus !== 'paid',
		).length,
		totalReceivable: invoices.reduce((total, inv) => {
			const remaining = Number(inv.remainingAmount) || 0
			return remaining > 0 ? total + remaining : total
		}, 0),
		averageOrder:
			todaysInvoices.length > 0 ? todaySales / todaysInvoices.length : 0,
	}
}

const filterProducts = (
	products: Product[],
	params: URLSearchParams,
): ProductsResponse => {
	let filtered = [...products]

	const searchText = params.get('searchText')?.trim().toLowerCase()
	if (searchText) {
		filtered = filtered.filter(
			p =>
				p.name?.toLowerCase().includes(searchText) ||
				p.barcode?.toLowerCase().includes(searchText) ||
				p.internalCode?.toLowerCase().includes(searchText),
		)
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

	const status = params.get('status')
	if (status && status !== 'all') {
		filtered = filtered.filter(inv => {
			if (status === 'credit') {
				return inv.paymentType === 'credit' && inv.paymentStatus !== 'paid'
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

const entityFromUrl = (path: string, method: string): OutboxEntity | null => {
	const segment = path.split('/')[0]
	const map: Record<string, OutboxEntity> = {
		invoices: 'invoice',
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
	}

	if (method === 'PATCH' && segment === 'user-settings') return 'userSettings'

	return map[segment] ?? null
}

const operationFromMethod = (
	method: string,
): 'create' | 'update' | 'delete' => {
	if (method === 'POST') return 'create'
	if (method === 'PATCH') return 'update'
	return 'delete'
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

	const duplicateOutbox = await findDuplicateOutboxEntry('invoices', 'POST', {
		...body,
		invoiceId,
	} as Record<string, unknown>)

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

	if (status !== 'draft' && status !== 'cancelled' && body.items?.length) {
		await validateLocalSaleInventory(body.items)
	}

	const allocatedNumber = await allocateNextInvoiceNumber()
	const invoiceNumber = String(allocatedNumber)

	const invoice: LocalInvoice = withLocalMeta(
		{
			invoiceId,
			invoiceNumber,
			customerId: body.customerId,
			customerName: body.customerName,
			salesPerson: body.salesPerson,
			paymentType: body.paymentType,
			items: body.items,
			status,
			paymentStatus: body.paymentStatus,
			paidAmount: body.paidAmount,
			remainingAmount: body.remainingAmount,
			amount: body.amount,
			totalAmount: body.totalAmount,
			totalTax: body.totalTax,
			totalDiscount: body.totalDiscount,
			notes: body.notes,
			issuedAt: body.issuedAt ?? nowIso(),
			createdAt: nowIso(),
		},
		'pending',
		clientMutationId,
	)

	await saveLocalInvoice(invoice)
	await addOutboxEntry({
		entity: 'invoice',
		operation: 'create',
		url: 'invoices',
		method: 'POST',
		payload: {
			...body,
			invoiceId,
			clientMutationId,
			invoiceNumber: allocatedNumber,
		},
		clientMutationId,
	})

	return {
		_id: invoiceId,
		invoiceId,
		invoiceNumber: invoice.invoiceNumber,
	}
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

	await applyLocalEntityMutation(entity, method, path, payload)

	await addOutboxEntry({
		entity,
		operation: operationFromMethod(method),
		url: path,
		method,
		payload,
		clientMutationId,
	})

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
		const customerId = String(payload.customerId ?? generateId())
		payload.customerId = customerId
		await offlineDb.customers.put(
			withLocalMeta(
				{
					customerId,
					name: String(payload.name ?? ''),
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
		const supplierId = String(payload.supplierId ?? generateId())
		payload.supplierId = supplierId
		await offlineDb.suppliers.put(
			withLocalMeta(
				{
					supplierId,
					name: String(payload.name ?? ''),
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

	if (entity === 'product' && op === 'create') {
		const productId = String(payload.productId ?? generateId())
		payload.productId = productId
		await offlineDb.products.put(
			withLocalMeta(
				{
					...payload,
					productId,
					name: String(payload.name ?? ''),
					price: payload.price ?? { retailPrice: 0, currency: 'USD' },
					status: (payload.status as Product['status']) ?? 'active',
				} as Product,
				'pending',
				productId,
			),
		)
		if (payload.quantity !== undefined) {
			await offlineDb.inventory.put(
				withLocalMeta(
					{
						inventoryId: generateId(),
						productId,
						quantity: Number(payload.quantity),
						availableQuantity: Number(payload.quantity),
					},
					'pending',
				),
			)
		}
		return
	}

	if (entity === 'product' && op === 'update') {
		const productId = path.split('/')[1]
		const existing = await offlineDb.products.get(productId)
		if (existing) {
			await offlineDb.products.put({
				...existing,
				...payload,
				syncStatus: 'pending',
				updatedAt: nowIso(),
			})
		}
		return
	}

	if (entity === 'product' && op === 'delete') {
		const productId = path.split('/')[1]
		await offlineDb.products.delete(productId)
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

	try {
		if (method === 'GET') {
			if (path === 'products' || path.startsWith('products/')) {
				if (path !== 'products') {
					const productId = path.split('/')[1]
					const product = await offlineDb.products.get(productId)
					if (!product) {
						return {
							error: { status: 404, data: { message: 'Product not found' } },
						}
					}
					return { data: product }
				}

				const products = await offlineDb.products.toArray()
				return { data: filterProducts(products, params) }
			}

			if (path === 'inventory') {
				const inventory = await offlineDb.inventory.toArray()
				return { data: inventory }
			}

			if (path === 'customers' || path.startsWith('customers/')) {
				if (path !== 'customers') {
					const customer = await offlineDb.customers.get(path.split('/')[1])
					if (!customer) {
						return {
							error: { status: 404, data: { message: 'Customer not found' } },
						}
					}
					return { data: customer }
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
					return { data: supplier }
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
				const actions = await getLocalDailyActionsForOffline()
				return { data: buildDailyActionFilterValues(actions) }
			}

			if (path === 'daily-actions' || path.startsWith('daily-actions/')) {
				if (path !== 'daily-actions') {
					const action = await offlineDb.dailyActions.get(path.split('/')[1])
					return action
						? { data: action }
						: {
								error: {
									status: 404,
									data: { message: 'Daily action not found' },
								},
							}
				}
				const actions = filterDailyActionsByParams(
					await getLocalDailyActionsForOffline(),
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

			if (path === 'invoices') {
				const invoices = await getLocalInvoicesForOffline()
				const filtered = filterInvoices(invoices, params)
				const nextInvoiceNumber = await getLocalNextInvoiceNumber()

				return {
					data: {
						invoices: filtered,
						summary: buildSellingInvoicesSummary(invoices),
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

			if (path === 'filter-values') {
				const products = await offlineDb.products.toArray()
				const suppliers = new Map<string, string>()
				const brands = new Map<string, string>()
				const categories = new Map<string, string>()

				for (const product of products) {
					if (product.supplierId && product.supplierName) {
						suppliers.set(product.supplierId, product.supplierName)
					}
					if (product.brandId) {
						brands.set(product.brandId, product.brandId)
					}
					if (product.categoryId && product.categoryName) {
						categories.set(product.categoryId, product.categoryName)
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

		if (method === 'POST' && path === 'invoices') {
			const data = await handlePostInvoice(body as PostSellingInvoiceBody)
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
	if (path.startsWith('tenants')) return false
	if (path.startsWith('users')) return false
	if (path.startsWith('user/')) return true
	return true
}
