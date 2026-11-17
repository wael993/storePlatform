import { roundPrimaryAmount } from './currencyDisplay'

// shared with the API, which recomputes totals to check a request (INV-MONEY-1)
export {
	calculateInvoiceTotals,
	calculateLineItemTotal,
	getLineDiscountAmount,
	type InvoiceDiscountSettings,
} from 'store-domain'

export const unitPriceFromLineTotalWithDiscount = (
	total: number,
	quantity: number,
	discount: number,
	discountIsPercent: boolean,
) => {
	if (quantity <= 0) return 0

	if (discountIsPercent) {
		const factor = 1 - discount / 100
		if (factor <= 0) return 0
		return roundPrimaryAmount(total / (quantity * factor))
	}

	return roundPrimaryAmount((total + discount) / quantity)
}

/** A tender above the total is change. The invoice stores at most the total. */
export const settleTenderedPayment = (
	tendered: number,
	grandTotal: number,
) => ({
	paidAmount: Math.min(tendered, grandTotal),
	changeAmount: tendered - grandTotal,
})
