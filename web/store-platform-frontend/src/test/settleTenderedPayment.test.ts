import { describe, expect, it } from 'vitest'

import { settleTenderedPayment } from '../components/SellingInvoice/invoiceCalculations'

describe('settleTenderedPayment', () => {
	it('stores the total when the tender is higher and keeps the rest as change', () => {
		expect(settleTenderedPayment(50, 30)).toEqual({
			paidAmount: 30,
			changeAmount: 20,
		})
	})

	it('keeps a short payment', () => {
		expect(settleTenderedPayment(20, 30)).toEqual({
			paidAmount: 20,
			changeAmount: -10,
		})
	})
})
