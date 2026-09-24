import { formatNumber } from '../../shared/utils'
import {
	convertPrimaryAmount,
	convertToPrimaryAmount,
	type DisplayCurrencyOption,
} from './currencyDisplay'

export interface ParsedDiscountInput {
	discount: number
	discountIsPercent: boolean
}

export const parseDiscountInput = (
	input: string,
): ParsedDiscountInput | null => {
	const trimmed = input.trim()
	if (!trimmed) {
		return { discount: 0, discountIsPercent: false }
	}

	const discountIsPercent = trimmed.includes('%')
	const numeric = Number.parseFloat(trimmed.replace('%', '').trim())

	if (!Number.isFinite(numeric) || numeric < 0) {
		return null
	}

	if (discountIsPercent && numeric > 100) {
		return null
	}

	return { discount: numeric, discountIsPercent }
}

export const formatDiscountEditValue = (
	discount: number,
	discountIsPercent: boolean,
) => (discountIsPercent ? `${discount}%` : (formatNumber(discount) ?? '0'))

/** Absolute discounts: primary → display for the edit draft. Percent: unchanged. */
export const formatDiscountEditDraft = (
	discount: number,
	discountIsPercent: boolean,
	displayCurrencyId?: string | null,
	currencyOptions?: DisplayCurrencyOption[],
) => {
	if (discountIsPercent) {
		return formatDiscountEditValue(discount, true)
	}

	const options = currencyOptions ?? []
	const editAmount = displayCurrencyId
		? convertPrimaryAmount(discount, displayCurrencyId, options)
		: discount

	return formatDiscountEditValue(editAmount, false)
}

/** Absolute discounts: display → primary before onSave. Percent: unchanged. */
export const toPrimaryDiscountSave = (
	parsed: ParsedDiscountInput,
	displayCurrencyId?: string | null,
	currencyOptions?: DisplayCurrencyOption[],
): ParsedDiscountInput => {
	if (parsed.discountIsPercent) {
		return parsed
	}

	return {
		discount: convertToPrimaryAmount(
			parsed.discount,
			displayCurrencyId ?? null,
			currencyOptions ?? [],
		),
		discountIsPercent: false,
	}
}
