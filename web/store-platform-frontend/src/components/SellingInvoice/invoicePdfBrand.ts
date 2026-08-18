import type { InvoiceSettings } from '../../api/apiStore'

export interface ResolvedInvoiceBrand {
	displayName: string
	address?: string
	phone?: string
	email?: string
	taxNumber?: string
	logoUrl?: string
	qrUrl?: string
	footerNote?: string
}

const trimOrUndefined = (value?: string) => {
	const trimmed = value?.trim()
	return trimmed ? trimmed : undefined
}

/** Read-time fallback: use tenant name when display name is empty. */
export const resolveInvoiceBrand = (
	settings: InvoiceSettings | null | undefined,
	tenantName?: string | null,
): ResolvedInvoiceBrand => ({
	displayName:
		trimOrUndefined(settings?.displayName) ||
		trimOrUndefined(tenantName ?? undefined) ||
		'Invoice',
	address: trimOrUndefined(settings?.address),
	phone: trimOrUndefined(settings?.phone),
	email: trimOrUndefined(settings?.email),
	taxNumber: trimOrUndefined(settings?.taxNumber),
	logoUrl: trimOrUndefined(settings?.logoUrl),
	qrUrl: trimOrUndefined(settings?.qrUrl),
	footerNote: trimOrUndefined(settings?.footerNote),
})

export const sanitizeInvoiceFilenamePart = (value: string) =>
	[...value]
		.filter(char => char.charCodeAt(0) >= 0x20)
		.join('')
		.trim()
		.replace(/[<>:"/\\|?*]+/g, '-')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '') || 'invoice'

export const buildInvoicePdfFilename = (
	displayName: string,
	invoiceNumber: string,
) =>
	`${sanitizeInvoiceFilenamePart(displayName)}-${sanitizeInvoiceFilenamePart(
		invoiceNumber,
	)}.pdf`
