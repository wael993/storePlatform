import type { SellingInvoiceStatus } from './types'

export const INVOICES_PER_PAGE = 10

export const STATUS_FILTER_TABS = [
	'all',
	'paid',
	'credit',
	'partial',
	'draft',
	'cancelled',
] as const

export const STATUS_CONFIG: Record<
	SellingInvoiceStatus,
	{ bg: string; color: string; labelKey: string }
> = {
	paid: {
		bg: '#DCFCE7',
		color: '#15803D',
		labelKey: 'components.sellingInvoices.status.paid',
	},
	credit: {
		bg: '#FEE2E2',
		color: '#DC2626',
		labelKey: 'components.sellingInvoices.status.credit',
	},
	partial: {
		bg: '#FFEDD5',
		color: '#C2410C',
		labelKey: 'components.sellingInvoices.status.partial',
	},
	draft: {
		bg: '#F3F4F6',
		color: '#4B5563',
		labelKey: 'components.sellingInvoices.status.draft',
	},
	cancelled: {
		bg: '#F3F4F6',
		color: '#6B7280',
		labelKey: 'components.sellingInvoices.status.cancelled',
	},
}

export const PAGE_COLORS = {
	primary: '#2563EB',
	success: '#10B981',
	warning: '#F59E0B',
	danger: '#EF4444',
	border: '#E5E7EB',
	muted: '#6B7280',
	cardShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
} as const

export const INVOICE_KIND_BADGE = {
	selling: {
		bg: '#FEF3C7',
		color: '#B45309',
		labelKey: 'components.sellingInvoices.invoiceKind.selling',
	},
	buying: {
		bg: '#DCFCE7',
		color: '#15803D',
		labelKey: 'components.sellingInvoices.invoiceKind.buying',
	},
} as const

export const PAYMENT_TYPE_CONFIG = {
	cash: {
		color: PAGE_COLORS.success,
		labelKey: 'components.sellingInvoices.paymentType.cash',
	},
	credit: {
		color: PAGE_COLORS.danger,
		labelKey: 'components.sellingInvoices.paymentType.credit',
	},
	card: {
		color: PAGE_COLORS.warning,
		labelKey: 'components.sellingInvoices.paymentType.card',
	},
} as const
