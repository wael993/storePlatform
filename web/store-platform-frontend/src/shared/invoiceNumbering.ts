const PREFIXED_INVOICE_NUMBER = /^(SI|BI)-(\d+)$/i

/** Numeric sequence for UI display from SI-000001 / BI-000002 / legacy "12". */
export const parseInvoiceSequence = (
	value?: string | number | null,
): number => {
	if (value == null || value === '') return 0

	if (typeof value === 'number') {
		return Number.isFinite(value) ? Math.trunc(value) : 0
	}

	const trimmed = String(value).trim()
	const prefixed = PREFIXED_INVOICE_NUMBER.exec(trimmed)

	if (prefixed) {
		return Number.parseInt(prefixed[2], 10) || 0
	}

	const legacy = Number.parseInt(trimmed, 10)

	return Number.isNaN(legacy) ? 0 : legacy
}

export const formatSellingInvoiceNumber = (sequence: number): string =>
	`SI-${String(Math.max(1, sequence)).padStart(6, '0')}`

export const formatBuyingInvoiceNumber = (sequence: number): string =>
	`BI-${String(Math.max(1, sequence)).padStart(6, '0')}`
