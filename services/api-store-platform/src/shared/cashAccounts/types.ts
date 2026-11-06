/** Extensible account type codes — seed three for v1, do not hard-close the set. */
export const CASH_ACCOUNT_TYPES = {
	DAILY_CASH: 'daily_cash',
	CASH_RESERVE: 'cash_reserve',
	ONLINE: 'online',
} as const

export type CashAccountType =
	(typeof CASH_ACCOUNT_TYPES)[keyof typeof CASH_ACCOUNT_TYPES]

export const INITIAL_CASH_ACCOUNT_TYPES: readonly CashAccountType[] = [
	CASH_ACCOUNT_TYPES.DAILY_CASH,
	CASH_ACCOUNT_TYPES.CASH_RESERVE,
	CASH_ACCOUNT_TYPES.ONLINE,
]

export const CASH_ACCOUNT_DEFAULT_NAMES: Record<CashAccountType, string> = {
	[CASH_ACCOUNT_TYPES.DAILY_CASH]: 'Daily Cash',
	[CASH_ACCOUNT_TYPES.CASH_RESERVE]: 'Cash Reserve',
	[CASH_ACCOUNT_TYPES.ONLINE]: 'Online',
}

export const isCashAccountType = (value: unknown): value is CashAccountType =>
	typeof value === 'string' &&
	(INITIAL_CASH_ACCOUNT_TYPES as readonly string[]).includes(value)

export const resolveCashAccountType = (value: unknown): CashAccountType =>
	isCashAccountType(value) ? value : CASH_ACCOUNT_TYPES.DAILY_CASH

/** Pure transfer input checks (no DB). */
export const validateCashTransferInput = (params: {
	fromAccountType: unknown
	toAccountType: unknown
	amount: unknown
}): {
	fromAccountType: CashAccountType
	toAccountType: CashAccountType
	amount: number
} => {
	const amount =
		typeof params.amount === 'number' ? params.amount : Number(params.amount)

	if (!Number.isFinite(amount) || amount <= 0) {
		throw new Error('Transfer amount must be greater than zero.')
	}

	if (!isCashAccountType(params.fromAccountType)) {
		throw new Error('From account type is invalid.')
	}

	if (!isCashAccountType(params.toAccountType)) {
		throw new Error('To account type is invalid.')
	}

	if (params.fromAccountType === params.toAccountType) {
		throw new Error('From and To accounts must be different.')
	}

	return {
		fromAccountType: params.fromAccountType,
		toAccountType: params.toAccountType,
		amount: Math.round(amount * 1e8) / 1e8,
	}
}

const finitePositive = (value: unknown) => {
	const n = typeof value === 'number' ? value : Number(value)

	return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Pure exchange input checks (no DB). Trusts the client rate snapshot but
 * rejects a `toAmount` that does not match primary-pivot math.
 */
export const validateCashExchangeInput = (params: {
	accountType: unknown
	fromCurrencyId: unknown
	toCurrencyId: unknown
	fromAmount: unknown
	toAmount: unknown
	fromExchangeRateToPrimary: unknown
	toExchangeRateToPrimary: unknown
	/** Current settings rates; pass for live requests, omit for sync replays (snapshot wins). */
	settingsRates?: ReadonlyMap<string, number>
}) => {
	if (!isCashAccountType(params.accountType)) {
		throw new Error('Cash account type is invalid.')
	}

	const fromCurrencyId =
		typeof params.fromCurrencyId === 'string'
			? params.fromCurrencyId.trim()
			: ''
	const toCurrencyId =
		typeof params.toCurrencyId === 'string' ? params.toCurrencyId.trim() : ''

	if (!fromCurrencyId || !toCurrencyId) {
		throw new Error('Exchange currencies are required.')
	}

	if (fromCurrencyId === toCurrencyId) {
		throw new Error('From and To currencies must be different.')
	}

	const fromAmount = finitePositive(params.fromAmount)
	const toAmount = finitePositive(params.toAmount)

	if (fromAmount === null || toAmount === null) {
		throw new Error('Exchange amounts must be greater than zero.')
	}

	const fromRate = finitePositive(params.fromExchangeRateToPrimary)
	const toRate = finitePositive(params.toExchangeRateToPrimary)

	if (fromRate === null || toRate === null) {
		throw new Error('Exchange rates must be greater than zero.')
	}

	// Same math as FE currencyDisplay: primary at 8dp, display at 2dp.
	const primary = Math.round((fromAmount / fromRate) * 1e8) / 1e8
	const expectedTo = Math.round(primary * toRate * 100) / 100

	if (Math.abs(expectedTo - toAmount) > 0.011) {
		throw new Error('Exchange amount does not match the exchange rates.')
	}

	if (params.settingsRates) {
		for (const [currencyId, rate] of [
			[fromCurrencyId, fromRate],
			[toCurrencyId, toRate],
		] as const) {
			const settingsRate = params.settingsRates.get(currencyId)

			if (
				settingsRate === undefined ||
				Math.abs(rate - settingsRate) > settingsRate * 1e-9
			) {
				throw new Error('Exchange rate does not match currency settings.')
			}
		}
	}

	return {
		accountType: params.accountType,
		fromCurrencyId,
		toCurrencyId,
		fromAmount: Math.round(fromAmount * 1e8) / 1e8,
		toAmount: Math.round(toAmount * 1e8) / 1e8,
		fromExchangeRateToPrimary: fromRate,
		toExchangeRateToPrimary: toRate,
	}
}

export const CASH_MOVEMENT_TYPES = {
	SALE: 'SALE',
	PURCHASE: 'PURCHASE',
	RECEIPT: 'RECEIPT',
	PAYMENT: 'PAYMENT',
	EXPENSE: 'EXPENSE',
	TRANSFER: 'TRANSFER',
	EXCHANGE: 'EXCHANGE',
	OPENING_BALANCE: 'OPENING_BALANCE',
	ADJUSTMENT: 'ADJUSTMENT',
	REVERSAL: 'REVERSAL',
} as const

export type CashMovementType =
	(typeof CASH_MOVEMENT_TYPES)[keyof typeof CASH_MOVEMENT_TYPES]

export const CASH_REFERENCE_TYPES = {
	SELLING_INVOICE: 'selling_invoice',
	BUYING_INVOICE: 'buying_invoice',
	DAILY_ACTION: 'daily_action',
	TRANSFER: 'cash_transfer',
	EXCHANGE: 'cash_exchange',
	OPENING: 'opening_balance',
	MIGRATION: 'migration',
} as const

export type DesiredCashPost = {
	accountType: CashAccountType
	/** Currency the notes were received or paid in. */
	currencyId: string
	/** Signed amount in `currencyId`: + in, − out. */
	amount: number
	movementType: CashMovementType
}
