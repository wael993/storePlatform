import {
	TENANT_ACCESSIBLE_PAGE,
	TenantAccessiblePage,
} from './constants/tenantAccessiblePages'
import { TenantRole } from './tenant'

export const SEE = {
	welcome: 'welcome',
	daily: 'daily',
	barcode: 'barcode',
	orders: 'orders',
	settings: 'settings',
	settingsProducts: 'settings.products',
	settingsLanguage: 'settings.language',
	settingsCurrencies: 'settings.currencies',
	settingsWorkMode: 'settings.workMode',
	settingsInvoice: 'settings.invoice',
	products: 'products',
	productsAdd: 'products.add',
	supplier: 'supplier',
	productsBuyingPrice: 'products.buyingPrice',
	productsWholesalePrice: 'products.wholesalePrice',
	productsSemiWholesalePrice: 'products.semiWholesalePrice',
	productsEdit: 'products.edit',
	productsDelete: 'products.delete',
	productsPrintBarcode: 'products.printBarcode',
	productsNotifications: 'products.notifications',
	customers: 'customers',
	customersAdd: 'customers.add',
	customersDelete: 'customers.delete',
	customersTotalReceivable: 'customers.totalReceivable',
	suppliersAdd: 'suppliers.add',
	suppliersDelete: 'suppliers.delete',
	suppliersTotalPayable: 'suppliers.totalPayable',
	invoices: 'invoices',
	invoicesBuyingAdd: 'invoices.buying.add',
	invoicesBuyingDelete: 'invoices.buying.delete',
	invoicesEntriesAdd: 'invoices.entries.add',
	invoicesEntriesDelete: 'invoices.entries.delete',
	sellingInvoices: 'sellingInvoices',
	sellingInvoicesDelete: 'sellingInvoices.delete',
	sellingInvoicesBuyingButton: 'sellingInvoices.buyingButton',
	sellingInvoicesSellingButton: 'sellingInvoices.sellingButton',
	sellingInvoicesEntriesButton: 'sellingInvoices.entriesButton',
	sellingInvoicesSummary: 'sellingInvoices.summary',
	sellingInvoicesAiRead: 'sellingInvoices.aiRead',
	reports: 'reports',
	categories: 'categories',
	categoriesDelete: 'categories.delete',
	partners: 'partners',
	partnersDelete: 'partners.delete',
	employees: 'employees',
	usersInvite: 'users.invite',
	usersList: 'users.list',
} as const

export type SeeId = (typeof SEE)[keyof typeof SEE]

export type SeeCatalogNode = {
	id: SeeId
	tenantPage?: TenantAccessiblePage | null
	locked?: boolean
	children?: SeeCatalogNode[]
}

export const PACKAGE_SEE_IDS: SeeId[] = [
	SEE.productsAdd,
	SEE.supplier,
	SEE.productsBuyingPrice,
]

export const SEE_CATALOG: SeeCatalogNode[] = [
	{ id: SEE.welcome, tenantPage: null },
	{ id: SEE.daily, tenantPage: TENANT_ACCESSIBLE_PAGE.DAILY },
	{ id: SEE.barcode, tenantPage: TENANT_ACCESSIBLE_PAGE.BARCODE },
	{ id: SEE.orders, tenantPage: TENANT_ACCESSIBLE_PAGE.ORDERS },
	{
		id: SEE.settings,
		tenantPage: TENANT_ACCESSIBLE_PAGE.SETTINGS,
		children: [
			{ id: SEE.settingsProducts },
			{ id: SEE.settingsLanguage },
			{ id: SEE.settingsCurrencies },
			{ id: SEE.settingsWorkMode },
			{ id: SEE.settingsInvoice },
		],
	},
	{
		id: SEE.products,
		tenantPage: TENANT_ACCESSIBLE_PAGE.PRODUCTS,
		locked: true,
		children: [
			{ id: SEE.productsAdd },
			{
				id: SEE.supplier,
				tenantPage: TENANT_ACCESSIBLE_PAGE.SUPPLIERS,
				children: [
					{ id: SEE.suppliersAdd },
					{ id: SEE.suppliersDelete },
					{ id: SEE.suppliersTotalPayable },
				],
			},
			{ id: SEE.productsBuyingPrice },
			{ id: SEE.productsWholesalePrice },
			{ id: SEE.productsSemiWholesalePrice },
			{ id: SEE.productsEdit },
			{ id: SEE.productsDelete },
			{ id: SEE.productsPrintBarcode },
			{ id: SEE.productsNotifications },
		],
	},
	{
		id: SEE.customers,
		tenantPage: TENANT_ACCESSIBLE_PAGE.CUSTOMERS,
		children: [
			{ id: SEE.customersAdd },
			{ id: SEE.customersDelete },
			{ id: SEE.customersTotalReceivable },
		],
	},
	{
		id: SEE.invoices,
		tenantPage: TENANT_ACCESSIBLE_PAGE.SELLING_INVOICES,
		children: [
			{
				id: SEE.sellingInvoicesBuyingButton,
				children: [
					{ id: SEE.invoicesBuyingAdd },
					{ id: SEE.invoicesBuyingDelete },
					{
						id: SEE.sellingInvoicesAiRead,
						tenantPage: TENANT_ACCESSIBLE_PAGE.INVOICE_AI,
					},
				],
			},
			{
				id: SEE.sellingInvoices,
				children: [
					{ id: SEE.sellingInvoicesSellingButton },
					{ id: SEE.sellingInvoicesDelete },
				],
			},
			{
				id: SEE.sellingInvoicesEntriesButton,
				children: [
					{ id: SEE.invoicesEntriesAdd },
					{ id: SEE.invoicesEntriesDelete },
				],
			},
			{ id: SEE.sellingInvoicesSummary },
		],
	},
	{ id: SEE.reports, tenantPage: TENANT_ACCESSIBLE_PAGE.REPORTS },
	{
		id: SEE.categories,
		tenantPage: TENANT_ACCESSIBLE_PAGE.CATEGORIES,
		children: [{ id: SEE.categoriesDelete }],
	},
	{
		id: SEE.partners,
		tenantPage: TENANT_ACCESSIBLE_PAGE.PARTNERS,
		children: [{ id: SEE.partnersDelete }],
	},
	{ id: SEE.employees, tenantPage: TENANT_ACCESSIBLE_PAGE.EMPLOYEES },
	{ id: SEE.usersInvite, tenantPage: TENANT_ACCESSIBLE_PAGE.USERS },
	{ id: SEE.usersList, tenantPage: TENANT_ACCESSIBLE_PAGE.USERS },
]

const ROLE_DEFAULTS: SeeId[] = [
	SEE.welcome,
	SEE.products,
	SEE.invoices,
	SEE.sellingInvoices,
	SEE.sellingInvoicesSellingButton,
]

const walk = (
	nodes: SeeCatalogNode[],
	visit: (node: SeeCatalogNode, parent?: SeeCatalogNode) => void,
	parent?: SeeCatalogNode,
) => {
	for (const node of nodes) {
		visit(node, parent)
		if (node.children) walk(node.children, visit, node)
	}
}

export const tenantHasPage = (
	pages: readonly string[],
	page: TenantAccessiblePage | null | undefined,
): boolean => {
	if (page === undefined || page === null) return true

	return pages.includes(page)
}

export const filterCatalogForTenant = (
	pages: readonly string[],
): SeeCatalogNode[] => {
	const filterNodes = (nodes: SeeCatalogNode[]): SeeCatalogNode[] =>
		nodes.flatMap(node => {
			if (!tenantHasPage(pages, node.tenantPage)) return []

			const children = node.children ? filterNodes(node.children) : undefined

			return [{ ...node, children }]
		})

	return filterNodes(SEE_CATALOG)
}

export const availableSeeIds = (pages: readonly string[]): SeeId[] => {
	const ids: SeeId[] = []

	walk(filterCatalogForTenant(pages), node => {
		ids.push(node.id)
	})

	return ids
}

export const lockedSeeIds = (pages: readonly string[]): SeeId[] => {
	const ids: SeeId[] = []

	walk(filterCatalogForTenant(pages), node => {
		if (node.locked) ids.push(node.id)
	})

	return ids
}

export const defaultSeeIds = (
	role: TenantRole,
	pages: readonly string[],
): SeeId[] => {
	const available = new Set(availableSeeIds(pages))
	const locked = lockedSeeIds(pages)

	if (role === 'owner') {
		return [...available]
	}

	return [...new Set([...ROLE_DEFAULTS, ...locked])].filter(id =>
		available.has(id),
	)
}

export const resolveSeeIds = (
	role: TenantRole,
	pages: readonly string[],
	stored: string[] | null | undefined,
): SeeId[] => {
	const available = new Set(availableSeeIds(pages))
	const locked = lockedSeeIds(pages)

	if (role === 'owner') {
		return [...available]
	}

	const base =
		stored == null
			? defaultSeeIds(role, pages)
			: stored.filter((id): id is SeeId => available.has(id as SeeId))

	if (
		stored != null &&
		base.includes(SEE.sellingInvoices) &&
		!base.includes(SEE.invoices) &&
		available.has(SEE.invoices)
	) {
		base.push(SEE.invoices)
	}

	return [...new Set([...base, ...locked])]
}

export const sanitizeSeeIdsForSave = (
	pages: readonly string[],
	incoming: unknown,
): SeeId[] => {
	if (!Array.isArray(incoming)) {
		return lockedSeeIds(pages)
	}

	const available = new Set(availableSeeIds(pages))
	const keep = new Set(
		incoming.filter((id): id is SeeId => available.has(id as SeeId)),
	)
	const catalog = filterCatalogForTenant(pages)
	const visit = (nodes: SeeCatalogNode[], parentOn: boolean) => {
		for (const node of nodes) {
			const on = parentOn && (Boolean(node.locked) || keep.has(node.id))

			if (!on) keep.delete(node.id)

			if (node.children) visit(node.children, on)
		}
	}

	visit(catalog, true)

	return [...new Set([...keep, ...lockedSeeIds(pages)])]
}

export const stripProductSeeFields = (product: any, see: Set<SeeId>): any => {
	const next = { ...product }

	if (!see.has(SEE.supplier)) {
		next.supplierId = undefined
		next.supplierName = undefined
	}

	if (!see.has(SEE.productsBuyingPrice) && next.price) {
		next.price = { ...next.price, purchasePrice: undefined }
		next.averageCost = undefined
		next.lastBuyingPrice = undefined
		if (next.inventory) {
			next.inventory = { ...next.inventory, averageCost: undefined }
		}
	}

	if (!see.has(SEE.productsWholesalePrice) && next.price) {
		next.price = { ...next.price, wholesalePrice: undefined }
	}

	if (!see.has(SEE.productsSemiWholesalePrice) && next.price) {
		next.price = { ...next.price, semiWholesalePrice: undefined }
	}

	return next
}
