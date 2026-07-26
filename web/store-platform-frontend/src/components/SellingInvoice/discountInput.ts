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
) => (discountIsPercent ? `${discount}%` : discount.toFixed(2))
