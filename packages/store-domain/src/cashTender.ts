import { roundPrimaryAmount } from './primaryCost'

export type CashTenderInput = {
	currencyId: string
	tenderedAmount: number
}

export type CashTender = CashTenderInput & {
	appliedAmount: number
	changeAmount: number
}

export type CashTenderRate = {
	currencyId: string
	exchangeRate: number
}

/** Apply tenders in order. Change is the part of a tender that is not kept. */
export const allocateCashTenders = (
	tenders: readonly CashTenderInput[],
	amountDuePrimary: number,
	rates: readonly CashTenderRate[],
): CashTender[] => {
	let remaining = roundPrimaryAmount(Math.max(0, amountDuePrimary))

	return tenders.flatMap(tender => {
		const currencyId = tender.currencyId?.trim()
		const tendered = roundPrimaryAmount(
			Math.max(0, Number(tender.tenderedAmount)),
		)

		if (!currencyId || !(tendered > 0)) return []

		const rate =
			rates.find(row => row.currencyId === currencyId)?.exchangeRate ?? 1
		const tenderPrimary =
			rate === 0 ? tendered : roundPrimaryAmount(tendered / rate)
		const applyPrimary = roundPrimaryAmount(
			Math.min(Math.max(tenderPrimary, 0), remaining),
		)

		remaining = roundPrimaryAmount(remaining - applyPrimary)

		const applied =
			tenderPrimary === 0
				? 0
				: roundPrimaryAmount(tendered * (applyPrimary / tenderPrimary))

		return [
			{
				currencyId,
				tenderedAmount: tendered,
				appliedAmount: applied,
				changeAmount: roundPrimaryAmount(Math.max(0, tendered - applied)),
			},
		]
	})
}

export const normalizeCashBalances = (
	value: unknown,
): Record<string, number> => {
	if (!value || typeof value !== 'object') return {}

	const entries =
		value instanceof Map
			? [...value.entries()]
			: Object.entries(value as Record<string, unknown>)
	const record: Record<string, number> = {}

	for (const [key, amount] of entries) {
		if (
			typeof key !== 'string' ||
			!key ||
			key.includes('.') ||
			key.includes('$')
		) {
			continue
		}

		const number = typeof amount === 'number' ? amount : Number(amount)

		if (Number.isFinite(number)) record[key] = number
	}

	return record
}

export const currencyBalanceOf = (
	balances: Record<string, number> | null | undefined,
	currencyId: string,
) => {
	const amount = balances?.[currencyId]

	return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}

/** A debit can spend only the selected currency. A missing balance is zero. */
export const debitFitsCurrencyBalance = (
	balances: Record<string, number> | null | undefined,
	currencyId: string,
	debit: number,
	allowNegativeBalance = false,
) => {
	if (!(debit > 0)) return true
	if (allowNegativeBalance) return true

	return currencyBalanceOf(balances, currencyId) + 1e-8 >= debit
}

export const addCashBalances = (
	left: Record<string, number>,
	right: Record<string, number>,
) => {
	const next = { ...left }

	for (const [currencyId, amount] of Object.entries(right)) {
		next[currencyId] = roundPrimaryAmount((next[currencyId] ?? 0) + amount)
	}

	return next
}
