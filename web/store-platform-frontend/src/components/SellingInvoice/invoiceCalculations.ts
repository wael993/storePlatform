import { roundPrimaryAmount } from './currencyDisplay'
import type { InvoiceTotals, SellingInvoiceLineItem } from './types'

export interface InvoiceDiscountSettings {
	useInvoiceDiscount: boolean
	invoiceDiscount: number
	invoiceDiscountIsPercent: boolean
}

export const getLineDiscountAmount = (item: SellingInvoiceLineItem) => {
	const lineSubtotal = item.quantity * item.unitPrice

	return item.discountIsPercent
		? lineSubtotal * (item.discount / 100)
		: item.discount
}

const getInvoiceLevelDiscountAmount = (
	subtotal: number,
	settings: InvoiceDiscountSettings,
) =>
	settings.invoiceDiscountIsPercent
		? subtotal * (settings.invoiceDiscount / 100)
		: settings.invoiceDiscount

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

export const calculateInvoiceTotals = (
	lineItems: SellingInvoiceLineItem[],
	invoiceDiscountSettings?: InvoiceDiscountSettings,
): InvoiceTotals => {
	const lineTotals = lineItems.reduce(
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

	if (!invoiceDiscountSettings?.useInvoiceDiscount) {
		return lineTotals
	}

	const discountAmount = getInvoiceLevelDiscountAmount(
		lineTotals.subtotal,
		invoiceDiscountSettings,
	)
	const afterDiscount = Math.max(0, lineTotals.subtotal - discountAmount)

	return {
		subtotal: lineTotals.subtotal,
		discount: discountAmount,
		tax: 0,
		grandTotal: afterDiscount,
	}
}
