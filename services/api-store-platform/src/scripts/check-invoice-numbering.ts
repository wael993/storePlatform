/**
 * Self-check for SI-/BI- invoice number helpers.
 * Run: npx ts-node src/scripts/check-invoice-numbering.ts
 */
import {
	formatInvoiceNumber,
	isPrefixedInvoiceNumber,
	parseInvoiceSequence,
} from '../shared/invoiceNumbering'

const assertEqual = (actual: unknown, expected: unknown, label: string) => {
	if (actual !== expected) {
		throw new Error(`${label}: expected ${expected}, got ${actual}`)
	}

	console.log(`ok: ${label}`)
}

assertEqual(formatInvoiceNumber('SI', 1), 'SI-000001', 'first selling')
assertEqual(formatInvoiceNumber('BI', 12), 'BI-000012', 'buying padded')
assertEqual(parseInvoiceSequence('SI-000001'), 1, 'parse SI')
assertEqual(parseInvoiceSequence('BI-000042'), 42, 'parse BI')
assertEqual(parseInvoiceSequence('1001'), 1001, 'parse legacy')
assertEqual(isPrefixedInvoiceNumber('SI-000001', 'SI'), true, 'is SI')
assertEqual(isPrefixedInvoiceNumber('BI-000001', 'SI'), false, 'BI not SI')
assertEqual(isPrefixedInvoiceNumber('1001', 'SI'), false, 'legacy not prefixed')

console.log('All invoice numbering checks passed.')
