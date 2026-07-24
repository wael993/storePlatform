export type InvoiceNumberPrefix = 'SI' | 'BI'

const PREFIXED_INVOICE_NUMBER = /^(SI|BI)-(\d+)$/i

/** Extract the numeric sequence from SI-000001, BI-000002, or legacy "1001". */
export const parseInvoiceSequence = (value?: string | null): number => {
	if (!value) return 0

	const trimmed = String(value).trim()
	const prefixed = PREFIXED_INVOICE_NUMBER.exec(trimmed)

	if (prefixed) {
		return Number.parseInt(prefixed[2], 10) || 0
	}

	const legacy = Number.parseInt(trimmed, 10)

	return Number.isNaN(legacy) ? 0 : legacy
}

/** Persist as SI-000001 / BI-000001. */
export const formatInvoiceNumber = (
	prefix: InvoiceNumberPrefix,
	sequence: number,
): string => `${prefix}-${String(Math.max(1, sequence)).padStart(6, '0')}`

export const isPrefixedInvoiceNumber = (
	value: string,
	prefix: InvoiceNumberPrefix,
): boolean => {
	const match = PREFIXED_INVOICE_NUMBER.exec(value.trim())

	return Boolean(match && match[1].toUpperCase() === prefix)
}
