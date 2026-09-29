import type { SellingInvoiceLineItem } from './types'
import {
	convertEntryAmountToPrimary,
	resolveCurrencyIdFromCode,
	type DisplayCurrencyOption,
} from './currencyDisplay'
import { finiteCost } from 'store-domain'
import { PricingLabelsType } from '../../shared/globalEnums'

const DEFAULT_TAX_RATE = 15

export type InvoiceLineItemKind = 'selling' | 'buying'

const toPrimaryAmount = (
	amount: number | undefined,
	product: Product,
	currencyOptions: DisplayCurrencyOption[],
): number | undefined => {
	if (amount == null) {
		return undefined
	}

	if (currencyOptions.length === 0) {
		return amount
	}

	const entryCurrencyId = resolveCurrencyIdFromCode(
		product.price?.currency,
		currencyOptions,
	)

	return convertEntryAmountToPrimary(amount, entryCurrencyId, currencyOptions)
}

export type SellingCatalogPriceField =
	'retailPrice' | 'wholesalePrice' | 'semiWholesalePrice'

/** Which product.price field the invoice pricing label should read/write. */
export const sellingCatalogPriceField = (
	pricingLabels: PricingLabelsType = PricingLabelsType.RETAIL_PRICE,
): SellingCatalogPriceField => {
	if (pricingLabels === PricingLabelsType.WHOLESALE_PRICE) {
		return 'wholesalePrice'
	}
	if (pricingLabels === PricingLabelsType.SEMI_WHOLESALE_PRICE) {
		return 'semiWholesalePrice'
	}
	return 'retailPrice'
}

/** True when the labeled catalog field is set (do not invent wholesale/semi from retail). */
export const hasSellingCatalogPrice = (
	price: Product['price'] | undefined,
	pricingLabels: PricingLabelsType,
): boolean => price?.[sellingCatalogPriceField(pricingLabels)] != null

/** Catalog amount (product currency) for a selling invoice's pricing label. */
export const pickSellingCatalogPrice = (
	price: Product['price'] | undefined,
	pricingLabels: PricingLabelsType = PricingLabelsType.RETAIL_PRICE,
): number => {
	const field = sellingCatalogPriceField(pricingLabels)
	if (field === 'retailPrice') {
		return price?.retailPrice ?? 0
	}
	// note: line prefill only — catalog pencil must use hasSellingCatalogPrice first
	return price?.[field] ?? price?.retailPrice ?? 0
}

const getDefaultUnitPrice = (
	product: Product,
	kind: InvoiceLineItemKind,
	currencyOptions: DisplayCurrencyOption[],
	pricingLabels: PricingLabelsType = PricingLabelsType.RETAIL_PRICE,
) => {
	const raw =
		kind === 'buying'
			? (product.price?.purchasePrice ?? 0)
			: pickSellingCatalogPrice(product.price, pricingLabels)

	return toPrimaryAmount(raw, product, currencyOptions) ?? raw
}

const getLastBuyingPrice = (
	product: Product,
	currencyOptions: DisplayCurrencyOption[],
) =>
	toPrimaryAmount(
		product.lastBuyingPrice ?? product.price?.purchasePrice,
		product,
		currencyOptions,
	)

export const syncLineItemCostReferences = (
	lineItems: SellingInvoiceLineItem[],
	products: Product[],
	currencyOptions: DisplayCurrencyOption[] = [],
): SellingInvoiceLineItem[] => {
	if (lineItems.length === 0 || products.length === 0) return lineItems

	const productsById = new Map(
		products.map(product => [product.productId, product]),
	)
	let changed = false

	const next = lineItems.map(item => {
		const product = productsById.get(item.productId)
		if (!product) return item

		const averageCost =
			finiteCost(product.inventory?.averageCost) ?? item.averageCost
		const lastBuyingPrice =
			getLastBuyingPrice(product, currencyOptions) ?? item.lastBuyingPrice
		const lastSellingPrice =
			toPrimaryAmount(product.lastSellingPrice, product, currencyOptions) ??
			item.lastSellingPrice

		if (
			averageCost === item.averageCost &&
			lastBuyingPrice === item.lastBuyingPrice &&
			lastSellingPrice === item.lastSellingPrice
		) {
			return item
		}

		changed = true
		return { ...item, averageCost, lastBuyingPrice, lastSellingPrice }
	})

	return changed ? next : lineItems
}

export const createLineItemFromProduct = (
	product: Product,
	kind: InvoiceLineItemKind = 'selling',
	currencyOptions: DisplayCurrencyOption[] = [],
	pricingLabels: PricingLabelsType = PricingLabelsType.RETAIL_PRICE,
): SellingInvoiceLineItem => {
	const taxRate = Number.parseFloat(product.taxRate ?? '') || DEFAULT_TAX_RATE

	return {
		id: `${product.productId}-${Date.now()}`,
		productId: product.productId,
		name: product.name,
		modelCode: product.productFactoryCode ?? product.internalCode,
		barcode: product.barcode,
		imageUrl: product.images?.[0],
		quantity: 1,
		unit: product.unitId ?? 'pcs',
		unitPrice: getDefaultUnitPrice(
			product,
			kind,
			currencyOptions,
			pricingLabels,
		),
		discount: product.price?.discount ?? 0,
		discountIsPercent: true,
		taxRate,
		averageCost: product.inventory?.averageCost,
		lastBuyingPrice: getLastBuyingPrice(product, currencyOptions),
		lastSellingPrice: toPrimaryAmount(
			product.lastSellingPrice,
			product,
			currencyOptions,
		),
	}
}

export const addProductToLineItems = (
	lineItems: SellingInvoiceLineItem[],
	product: Product,
	kind: InvoiceLineItemKind = 'selling',
	options?: {
		noMergeInvoiceLines?: boolean
		currencyOptions?: DisplayCurrencyOption[]
		pricingLabels?: PricingLabelsType
	},
) => {
	const currencyOptions = options?.currencyOptions ?? []
	const pricingLabels = options?.pricingLabels ?? PricingLabelsType.RETAIL_PRICE

	if (options?.noMergeInvoiceLines) {
		return [
			...lineItems,
			createLineItemFromProduct(product, kind, currencyOptions, pricingLabels),
		]
	}

	const existingIndex = lineItems.findIndex(
		item => item.productId === product.productId,
	)

	if (existingIndex === -1) {
		return [
			...lineItems,
			createLineItemFromProduct(product, kind, currencyOptions, pricingLabels),
		]
	}

	return lineItems.map((item, index) =>
		index === existingIndex
			? {
					...item,
					quantity: item.quantity + 1,
					averageCost:
						finiteCost(product.inventory?.averageCost) ?? item.averageCost,
					lastBuyingPrice:
						getLastBuyingPrice(product, currencyOptions) ??
						item.lastBuyingPrice,
					lastSellingPrice:
						toPrimaryAmount(
							product.lastSellingPrice,
							product,
							currencyOptions,
						) ?? item.lastSellingPrice,
				}
			: item,
	)
}
