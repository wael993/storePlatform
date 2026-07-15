export interface InvoiceCurrencyAmount {
	currencyId: string
	name: string
	internalCode?: string
	exchangeRate: number
	isPrimary: boolean
	amount: number
	paidAmount: number
	remainingAmount: number
	subtotal: number
	tax: number
	discount: number
}

export interface InvoiceAmountSource {
	currencyAmounts?: InvoiceCurrencyAmount[]
	amount?: number
	paidAmount?: number
	remainingAmount?: number
	totalAmount?: number
	totalTax?: number
	totalDiscount?: number
}

export const getPrimaryInvoiceCurrencyAmounts = (
	invoice: InvoiceAmountSource,
) => {
	const primary =
		invoice.currencyAmounts?.find(amount => amount.isPrimary) ??
		invoice.currencyAmounts?.[0]

	if (primary) {
		return {
			grandTotal: primary.amount,
			paidAmount: primary.paidAmount,
			remainingAmount: primary.remainingAmount,
			subtotal: primary.subtotal,
			tax: primary.tax,
			discount: primary.discount,
			currencyId: primary.currencyId,
		}
	}

	const grandTotal = Number(invoice.amount ?? invoice.totalAmount ?? 0)

	return {
		grandTotal,
		paidAmount: Number(invoice.paidAmount ?? 0),
		remainingAmount: Number(invoice.remainingAmount ?? 0),
		subtotal: Number(invoice.totalAmount ?? grandTotal),
		tax: Number(invoice.totalTax ?? 0),
		discount: Number(invoice.totalDiscount ?? 0),
		currencyId: undefined as string | undefined,
	}
}
