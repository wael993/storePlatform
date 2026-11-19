import { BusinessLogicError } from '../middleware/errorHandler'
import { ERROR_CODES } from './errorCodes'
import type { CostCurrencyRate } from './store-domain/primaryCost'

const isRate = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value > 0

/**
 * Rate snapshot stored on a daily action (party valuation), taken once and kept:
 * - edit with the same currency keeps the stored rate (no revaluation),
 * - sync replay keeps the rate the device stamped when it queued the entry,
 * - otherwise today's settings; a currency missing there is refused, never 1 : 1.
 */
export const resolveDailyActionRate = (params: {
	currencyId: string
	rates: readonly CostCurrencyRate[]
	replaySnapshot?: unknown
	existing?: { currencyId?: string; exchangeRateToPrimary?: unknown } | null
}): number => {
	const { existing } = params

	if (
		existing?.currencyId === params.currencyId &&
		isRate(existing.exchangeRateToPrimary)
	) {
		return existing.exchangeRateToPrimary
	}

	if (isRate(params.replaySnapshot)) return params.replaySnapshot

	const rate = params.rates.find(
		item => item.currencyId === params.currencyId,
	)?.exchangeRate

	if (!isRate(rate)) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Currency is not in the currency settings.',
		)
	}

	return rate
}
