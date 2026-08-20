import {
	ConfidenceBand,
	RawExtractedField,
	RawInvoiceExtraction,
	ScoredField,
	ScoredInvoiceExtraction,
	ScoredInvoiceLine,
} from './types'

const HIGH = 0.9
const AMOUNT_HIGH = 0.92
const MISSING = 0.5
const ARITHMETIC_ABS = 0.05
const ARITHMETIC_REL = 0.01

const clampConfidence = (value: number | null): number | null => {
	if (value == null || !Number.isFinite(value)) return null

	return Math.min(1, Math.max(0, value))
}

const hasValue = <T>(field: RawExtractedField<T>): boolean => {
	if (field.value == null) return false

	if (typeof field.value === 'string') return field.value.trim().length > 0

	return true
}

export const bandForField = (
	field: RawExtractedField<unknown>,
	highThreshold = HIGH,
): ConfidenceBand => {
	if (!hasValue(field)) return 'missing'

	const confidence = clampConfidence(field.confidence)

	if (confidence == null || confidence < MISSING) return 'missing'

	if (field.isHandwritten) return 'review'

	if (confidence >= highThreshold) return 'high'

	return 'review'
}

const scoreField = <T>(
	field: RawExtractedField<T>,
	highThreshold = HIGH,
): ScoredField<T> => {
	const band = bandForField(field, highThreshold)

	return {
		value: band === 'missing' ? null : field.value,
		confidence: clampConfidence(field.confidence),
		band,
		isHandwritten: Boolean(field.isHandwritten),
	}
}

const amountsClose = (left: number, right: number): boolean => {
	const delta = Math.abs(left - right)

	return delta <= ARITHMETIC_ABS || delta <= Math.abs(right) * ARITHMETIC_REL
}

const downgrade = <T>(
	field: ScoredField<T>,
	band: ConfidenceBand,
): ScoredField<T> => {
	if (band === 'missing') {
		return { ...field, band, value: null }
	}

	if (field.band === 'missing') return field

	if (field.band === 'high' && band === 'review') {
		return { ...field, band }
	}

	return field
}

export const scoreInvoiceExtraction = (
	raw: RawInvoiceExtraction,
): ScoredInvoiceExtraction => {
	const items: ScoredInvoiceLine[] = raw.items.map(item => ({
		name: scoreField(item.name),
		quantity: scoreField(item.quantity, AMOUNT_HIGH),
		unit: scoreField(item.unit),
		unitPrice: scoreField(item.unitPrice, AMOUNT_HIGH),
		barcode: item.barcode?.value?.trim() || null,
		sku: item.sku?.value?.trim() || null,
	}))

	const scored: ScoredInvoiceExtraction = {
		supplierName: scoreField(raw.supplierName),
		invoiceNumber: scoreField(raw.invoiceNumber),
		invoiceDate: scoreField(raw.invoiceDate),
		vat: scoreField(raw.vat, AMOUNT_HIGH),
		total: scoreField(raw.total, AMOUNT_HIGH),
		supplierVatId: raw.supplierVatId?.value?.trim() || null,
		items,
	}

	const lineSum = items.reduce((sum, item) => {
		if (item.quantity.value == null || item.unitPrice.value == null) return sum

		return sum + item.quantity.value * item.unitPrice.value
	}, 0)

	const completeLineCount = items.filter(
		item => item.quantity.value != null && item.unitPrice.value != null,
	).length

	if (
		scored.total.value != null &&
		completeLineCount > 0 &&
		!amountsClose(lineSum, scored.total.value)
	) {
		const farOff =
			Math.abs(lineSum - scored.total.value) >
			Math.max(1, Math.abs(scored.total.value) * 0.2)

		scored.total = downgrade(scored.total, farOff ? 'missing' : 'review')
	}

	if (
		scored.vat.value != null &&
		scored.total.value != null &&
		scored.vat.value > scored.total.value + ARITHMETIC_ABS
	) {
		scored.vat = downgrade(scored.vat, 'review')
	}

	return scored
}
