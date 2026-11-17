/**
 * Invoice totals in the primary currency. One formula for the web app (building
 * the request) and the API (checking it, INV-MONEY-1): same floats on both sides.
 */

export type InvoiceTotalsLine = {
	quantity: number
	unitPrice: number
	discount: number
	discountIsPercent: boolean
}

export type InvoiceDiscountSettings = {
	useInvoiceDiscount: boolean
	invoiceDiscount: number
	invoiceDiscountIsPercent: boolean
}

export type InvoiceTotals = {
	subtotal: number
	discount: number
	tax: number
	grandTotal: number
}

export const getLineDiscountAmount = (item: InvoiceTotalsLine) => {
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

export const calculateLineItemTotal = (item: InvoiceTotalsLine) => {
	const lineSubtotal = item.quantity * item.unitPrice
	const discountAmount = getLineDiscountAmount(item)
	const afterDiscount = Math.max(0, lineSubtotal - discountAmount)
	const taxAmount = 0 //afterDiscount * (item.taxRate / 100)

	return afterDiscount + taxAmount
}

export const calculateInvoiceTotals = (
	lineItems: readonly InvoiceTotalsLine[],
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
