import { describe, expect, it } from 'vitest'

import { newInvoiceLineTouched } from '../shared/seePermissions'

const catalog = { unitPrice: 10, discount: 2 }

describe('newInvoiceLineTouched', () => {
	it('treats present price and discount as touched when there is no catalog', () => {
		expect(newInvoiceLineTouched({ unitPrice: 10, discount: 2 }, null)).toEqual(
			{
				unitPrice: true,
				discount: true,
			},
		)

		expect(newInvoiceLineTouched({}, null)).toEqual({
			unitPrice: false,
			discount: false,
		})
	})

	it('is untouched when the line matches the catalog', () => {
		expect(
			newInvoiceLineTouched(
				{ unitPrice: 10, discount: 2, discountIsPercent: true },
				catalog,
			),
		).toEqual({ unitPrice: false, discount: false })
	})

	it('flags a unit price that differs from the catalog', () => {
		expect(
			newInvoiceLineTouched({ unitPrice: 12, discount: 2 }, catalog),
		).toEqual({ unitPrice: true, discount: false })
	})

	it('flags discount when percent diverges from the catalog default', () => {
		expect(
			newInvoiceLineTouched(
				{ unitPrice: 10, discount: 2, discountIsPercent: false },
				catalog,
			),
		).toEqual({ unitPrice: false, discount: true })
	})
})
