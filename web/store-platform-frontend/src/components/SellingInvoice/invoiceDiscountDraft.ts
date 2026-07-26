import type { InvoiceDiscountDraftFields } from './types'

export const getInvoiceDiscountSettings = (
	draft: InvoiceDiscountDraftFields,
) => ({
	useInvoiceDiscount: draft.useInvoiceDiscount,
	invoiceDiscount: draft.invoiceDiscount,
	invoiceDiscountIsPercent: draft.invoiceDiscountIsPercent,
})

export const clearInvoiceDiscountFields = (): InvoiceDiscountDraftFields => ({
	useInvoiceDiscount: false,
	invoiceDiscount: 0,
	invoiceDiscountIsPercent: false,
})

export const applyInvoiceLevelDiscount = (
	discount: number,
	discountIsPercent: boolean,
): InvoiceDiscountDraftFields => {
	if (discount <= 0) {
		return clearInvoiceDiscountFields()
	}

	return {
		useInvoiceDiscount: true,
		invoiceDiscount: discount,
		invoiceDiscountIsPercent: discountIsPercent,
	}
}
