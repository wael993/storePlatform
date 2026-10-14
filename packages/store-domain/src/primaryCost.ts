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

export const ratesFromCurrencySettings = (
	settings: {
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
	} | null,
): CostCurrencyRate[] => {
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

/**
 * Primary equivalent of an entry amount.
 * `exchangeRateToPrimary` is the settings rate stored on the entry (divide by it).
 * A missing snapshot falls back to the live rates for rows not yet migrated.
 */
export const amountToPrimaryWithSnapshot = (
	amount: number,
	currencyId: string | null | undefined,
	exchangeRateToPrimary: number | null | undefined,
	rates: readonly CostCurrencyRate[],
): number => {
	if (
		typeof exchangeRateToPrimary === 'number' &&
		Number.isFinite(exchangeRateToPrimary) &&
		exchangeRateToPrimary > 0
	) {
		return roundPrimaryAmount(amount / exchangeRateToPrimary)
	}

	return amountToPrimary(amount, currencyId ?? null, rates)
}

export type OpeningBalanceDirection = 'owed_to_us' | 'we_owe'

export type OpeningBalanceLine = {
	currencyId: string
	currencyCode: string
	amount: number
	direction: OpeningBalanceDirection
}

/**
 * Signed primary amount added to a party's outstanding.
 * Customer: owed_to_us adds, we_owe subtracts.
 * Supplier is the opposite, matching the outstanding label.
 */
export const openingBalancePrimary = (
	party: 'customer' | 'supplier',
	rows:
		| readonly Pick<OpeningBalanceLine, 'currencyId' | 'amount' | 'direction'>[]
		| null
		| undefined,
	rates: readonly CostCurrencyRate[] = [],
): number => {
	if (!rows?.length) return 0

	const total = rows.reduce((sum, row) => {
		const amount =
			typeof row.amount === 'number' ? row.amount : Number(row.amount)

		if (!Number.isFinite(amount) || amount === 0) return sum

		const towardUs = row.direction === 'owed_to_us' ? amount : -amount
		const signed = party === 'supplier' ? -towardUs : towardUs

		return sum + amountToPrimary(signed, row.currencyId || null, rates)
	}, 0)

	return roundPrimaryAmount(total)
}

/** Drops zero rows. Rejects unknown currencies, duplicates, and a bad direction. */
export const normalizeOpeningBalances = (
	input: unknown,
	currencies: readonly { currencyId: string; code: string }[],
): OpeningBalanceLine[] => {
	if (!Array.isArray(input)) {
		throw new Error('Opening balance must be a list.')
	}

	const codeById = new Map(
		currencies
			.filter(currency => currency.currencyId.trim())
			.map(currency => [
				currency.currencyId,
				currency.code.trim() || currency.currencyId,
			]),
	)
	const seen = new Set<string>()
	const rows: OpeningBalanceLine[] = []

	for (const raw of input) {
		if (!raw || typeof raw !== 'object') {
			throw new Error('Opening balance row is invalid.')
		}

		const row = raw as Record<string, unknown>
		const currencyId =
			typeof row.currencyId === 'string' ? row.currencyId.trim() : ''
		const currencyCode = codeById.get(currencyId)

		if (!currencyCode) {
			throw new Error('Opening balance currency is not configured.')
		}

		if (seen.has(currencyId)) {
			throw new Error('Opening balance currency is duplicated.')
		}

		seen.add(currencyId)

		const direction = row.direction

		if (direction !== 'owed_to_us' && direction !== 'we_owe') {
			throw new Error('Opening balance direction is invalid.')
		}

		const amount =
			typeof row.amount === 'number' ? row.amount : Number(row.amount)

		if (!Number.isFinite(amount) || amount < 0) {
			throw new Error('Opening balance amount is invalid.')
		}

		if (amount === 0) continue

		rows.push({
			currencyId,
			currencyCode,
			amount: roundPrimaryAmount(amount),
			direction,
		})
	}

	return rows
}
