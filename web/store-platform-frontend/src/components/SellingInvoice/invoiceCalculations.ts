import { roundPrimaryAmount } from './currencyDisplay'
import type { InvoiceTotals, SellingInvoiceLineItem } from './types'

const getLineDiscountAmount = (item: SellingInvoiceLineItem) => {
	const lineSubtotal = item.quantity * item.unitPrice

	return item.discountIsPercent
		? lineSubtotal * (item.discount / 100)
		: item.discount
}

export const calculateLineItemTotal = (item: SellingInvoiceLineItem) => {
	const lineSubtotal = item.quantity * item.unitPrice
	const discountAmount = getLineDiscountAmount(item)
	const afterDiscount = Math.max(0, lineSubtotal - discountAmount)
	const taxAmount = 0 //afterDiscount * (item.taxRate / 100)

	return afterDiscount + taxAmount
}

/** Derive unit price from a desired line total (resets discount semantics). */
export const unitPriceFromLineTotal = (total: number, quantity: number) => {
	if (quantity <= 0) return 0
	return roundPrimaryAmount(total / quantity)
}

export const calculateInvoiceTotals = (
	lineItems: SellingInvoiceLineItem[],
): InvoiceTotals => {
	return lineItems.reduce(
		(totals, item) => {
			const lineSubtotal = item.quantity * item.unitPrice
			const discountAmount = getLineDiscountAmount(item)
			const afterDiscount = Math.max(0, lineSubtotal - discountAmount)
			const taxAmount = 0 //afterDiscount * (item.taxRate / 100)

			return {
				subtotal: totals.subtotal + lineSubtotal,
				discount: totals.discount + discountAmount,
				tax: totals.tax + taxAmount,
				grandTotal: totals.grandTotal + afterDiscount + taxAmount,
			}
		},
		{ subtotal: 0, discount: 0, tax: 0, grandTotal: 0 },
	)
}
