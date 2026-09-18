import { finiteCost } from './inventoryCost'

/**
 * Inventory.averageCost and sale StockMoving.unitCost are primary-currency amounts.
 * Convert catalog purchasePrice at cost-write time; never re-infer from live
 * product.price.currency after the cost is established.
 *
 * note: rates empty → treat amount as already primary (no settings / unmatched).
 * Upgrade: refuse unmatched secondary codes instead of passthrough.
 */

export type CostCurrencyRate = {
	currencyId: string
	label: string
	name: string
	exchangeRate: number
}

export const roundPrimaryAmount = (amount: number) =>
	Math.round(amount * 1e8) / 1e8

export const resolveCurrencyIdFromCode = (
	code: string | undefined,
	rates: readonly CostCurrencyRate[],
): string | null => {
	const normalized = code?.trim().toLowerCase()

	if (!normalized || rates.length === 0) return null

	const match = rates.find(
		rate =>
			rate.label.toLowerCase() === normalized ||
			rate.name.toLowerCase() === normalized,
	)

	return match?.currencyId ?? null
}

export const amountToPrimary = (
	amount: number,
	currencyId: string | null,
	rates: readonly CostCurrencyRate[],
): number => {
	if (!currencyId || rates.length === 0) {
		return roundPrimaryAmount(amount)
	}

	const rate =
		rates.find(option => option.currencyId === currencyId)?.exchangeRate ?? 1

	if (rate === 0) return roundPrimaryAmount(amount)

	return roundPrimaryAmount(amount / rate)
}

/** Catalog purchasePrice (+ price.currency) → primary inventory/sale cost. */
export const catalogCostToPrimary = (
	purchasePrice: unknown,
	currencyCode: string | undefined,
	rates: readonly CostCurrencyRate[],
): number | undefined => {
	const cost = finiteCost(purchasePrice)

	if (cost == null) return undefined

	if (rates.length === 0) return cost

	return amountToPrimary(
		cost,
		resolveCurrencyIdFromCode(currencyCode, rates),
		rates,
	)
}

export const ratesFromCurrencySettings = (settings: {
	primaryCurrency?: {
		currencyId: string
		name: string
		internalCode?: string
	} | null
	secondaryCurrencies?: Array<{
		currencyId: string
		name: string
		internalCode?: string
		exchangeRate?: number
	}>
} | null): CostCurrencyRate[] => {
	const primary = settings?.primaryCurrency

	if (!primary) return []

	return [
		{
			currencyId: primary.currencyId,
			label: primary.internalCode || primary.name,
			name: primary.name,
			exchangeRate: 1,
		},
		...(settings.secondaryCurrencies ?? []).map(secondary => ({
			currencyId: secondary.currencyId,
			label: secondary.internalCode || secondary.name,
			name: secondary.name,
			exchangeRate: secondary.exchangeRate ?? 1,
		})),
	]
}
