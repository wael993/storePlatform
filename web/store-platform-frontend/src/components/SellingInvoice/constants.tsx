import { Icon } from '@chakra-ui/react'

import {
	InvoicePaymentType,
	InvoiceUiStatus,
} from '../../shared/globalEnums'
import { AsCashIcon } from '../../icons/Cash'
import { AsCreditCardIcon } from '../../icons/CreditCard'
import { AsPriceTagIcon } from '../../shared/icons/PriceTag'
import type { SellingInvoicePaymentType, SellingInvoiceStatus } from './types'

export const INVOICES_PER_PAGE = 10

export const STATUS_FILTER_TABS = [
	'all',
	InvoiceUiStatus.PAID,
	InvoiceUiStatus.CREDIT,
	InvoiceUiStatus.PARTIAL,
	InvoiceUiStatus.DRAFT,
	InvoiceUiStatus.CANCELLED,
] as const

export const STATUS_CONFIG: Record<
	SellingInvoiceStatus,
	{ bg: string; color: string; labelKey: string }
> = {
	[InvoiceUiStatus.PAID]: {
		bg: '#DCFCE7',
		color: '#15803D',
		labelKey: 'components.sellingInvoices.status.paid',
	},
	[InvoiceUiStatus.CREDIT]: {
		bg: '#FEE2E2',
		color: '#DC2626',
		labelKey: 'components.sellingInvoices.status.credit',
	},
	[InvoiceUiStatus.PARTIAL]: {
		bg: '#FFEDD5',
		color: '#C2410C',
		labelKey: 'components.sellingInvoices.status.partial',
	},
	[InvoiceUiStatus.DRAFT]: {
		bg: '#F3F4F6',
		color: '#4B5563',
		labelKey: 'components.sellingInvoices.status.draft',
	},
	[InvoiceUiStatus.CANCELLED]: {
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

export const ENTRY_KIND_BADGE = {
	receipt: {
		bg: '#DBEAFE',
		color: '#1D4ED8',
		labelKey: 'common.receiptEntry',
	},
	payment: {
		bg: '#FEE2E2',
		color: '#DC2626',
		labelKey: 'common.paymentEntry',
	},
	expense: {
		bg: '#F3E8FF',
		color: '#7C3AED',
		labelKey: 'common.expenseEntry',
	},
} as const

export const PAYMENT_TYPE_CONFIG = {
	[InvoicePaymentType.CASH]: {
		icon: AsCashIcon,
		color: PAGE_COLORS.success,
		labelKey: 'components.sellingInvoices.paymentType.cash',
	},
	[InvoicePaymentType.CREDIT]: {
		icon: AsPriceTagIcon,
		color: PAGE_COLORS.danger,
		labelKey: 'components.sellingInvoices.paymentType.credit',
	},
	[InvoicePaymentType.CARD]: {
		icon: AsCreditCardIcon,
		color: PAGE_COLORS.warning,
		labelKey: 'components.sellingInvoices.paymentType.card',
	},
} as const

export const PaymentTypeIcon = ({
	type,
}: {
	type: SellingInvoicePaymentType
}) => {
	const config = PAYMENT_TYPE_CONFIG[type]

	return <Icon as={config.icon} fill="none" color={config.color} boxSize={5} />
}
