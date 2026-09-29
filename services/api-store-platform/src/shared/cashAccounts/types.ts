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

export const resolveCashAccountType = (
	value: unknown,
): CashAccountType =>
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

export const CASH_MOVEMENT_TYPES = {
	SALE: 'SALE',
	PURCHASE: 'PURCHASE',
	RECEIPT: 'RECEIPT',
	PAYMENT: 'PAYMENT',
	EXPENSE: 'EXPENSE',
	TRANSFER: 'TRANSFER',
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
	OPENING: 'opening_balance',
	MIGRATION: 'migration',
} as const

export type CashReferenceType =
	(typeof CASH_REFERENCE_TYPES)[keyof typeof CASH_REFERENCE_TYPES]

export type DesiredCashPost = {
	accountType: CashAccountType
	/** Signed primary-currency amount: + in, − out. */
	amount: number
	movementType: CashMovementType
}
