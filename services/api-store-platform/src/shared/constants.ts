import {
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
	InvoiceUiStatus,
} from './globalEnums'

export const today = new Date()

export const mapInvoiceFiltersToUiStatus = (
	invoice: Record<string, unknown>,
): string => {
	if (invoice.status === InvoiceStatus.DRAFT) return InvoiceUiStatus.DRAFT

	if (invoice.status === InvoiceStatus.CANCELLED) {
		return InvoiceUiStatus.CANCELLED
	}

	if (invoice.status === InvoiceStatus.PAID) return InvoiceUiStatus.PAID

	if (invoice.status === InvoiceStatus.PARTIAL) return InvoiceUiStatus.PARTIAL

	if (
		invoice.paymentType === InvoicePaymentType.CREDIT &&
		invoice.paymentStatus !== InvoicePaymentStatus.PAID
	) {
		return InvoiceUiStatus.CREDIT
	}

	if (invoice.paymentStatus === InvoicePaymentStatus.PARTIAL) {
		return InvoiceUiStatus.PARTIAL
	}

	return String(invoice.status ?? InvoiceStatus.CONFIRMED)
}
