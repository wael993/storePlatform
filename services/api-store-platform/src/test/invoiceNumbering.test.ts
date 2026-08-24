import { describe, expect, it } from 'vitest'

import {
	formatInvoiceNumber,
	isPrefixedInvoiceNumber,
	parseInvoiceSequence,
} from '../shared/invoiceNumbering'

describe('invoice numbering', () => {
	it('pads selling and buying sequences', () => {
		expect(formatInvoiceNumber('SI', 1)).toBe('SI-000001')
		expect(formatInvoiceNumber('BI', 12)).toBe('BI-000012')
	})

	it('parses prefixed and legacy numbers', () => {
		expect(parseInvoiceSequence('SI-000001')).toBe(1)
		expect(parseInvoiceSequence('BI-000042')).toBe(42)
		expect(parseInvoiceSequence('1001')).toBe(1001)
	})

	it('detects a matching prefix', () => {
		expect(isPrefixedInvoiceNumber('SI-000001', 'SI')).toBe(true)
		expect(isPrefixedInvoiceNumber('BI-000001', 'SI')).toBe(false)
		expect(isPrefixedInvoiceNumber('1001', 'SI')).toBe(false)
	})
})
