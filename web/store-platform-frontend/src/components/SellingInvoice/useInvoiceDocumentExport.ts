import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import dayjs from 'dayjs'

import {
	useGetCurrencySettingsQuery,
	useGetInvoiceSettingsQuery,
	useGetUnitsQuery,
	useGetUserSettingsQuery,
	useLazyGetBuyingInvoiceQuery,
	useLazyGetSellingInvoiceQuery,
} from '../../api/apiStore'
import { formatNumber } from '../../shared/utils'
import type { RootState } from '../../store/store'
import type { ApiBuyingInvoice } from '../BuyingInvoice/buyingInvoiceApiMappers'
import {
	downloadInvoiceDocumentPdf,
	openInvoicePrintWindow,
	printInvoiceDocument,
} from './invoiceDocumentActions'
import type {
	InvoiceDocumentLabels,
	InvoiceDocumentModel,
} from './invoiceDocumentModel'
import {
	calculateLineItemTotal,
	getLineDiscountAmount,
} from './invoiceCalculations'
import {
	buildDisplayCurrencyOptions,
	getCurrencyLabel,
	getInvoicePdfCurrencyAmounts,
	resolveDefaultDisplayCurrencyId,
	roundDisplayAmount,
	type DisplayCurrencyOption,
} from './currencyDisplay'
import type { ApiSellingInvoice } from './invoiceApiMappers'
import { resolveInvoiceBrand } from './invoicePdfBrand'
import type { SellingInvoiceStatus } from './types'

const mapStatus = (
	invoice: ApiSellingInvoice | ApiBuyingInvoice,
): SellingInvoiceStatus => {
	if (invoice.status === 'draft') return 'draft'
	if (invoice.status === 'cancelled') return 'cancelled'
	if (invoice.status === 'paid' || invoice.paymentStatus === 'paid')
		return 'paid'
	if (invoice.status === 'partial' || invoice.paymentStatus === 'partial') {
		return 'partial'
	}
	if (invoice.paymentType === 'credit') return 'credit'
	return 'paid'
}

const buildLabels = (t: (key: string) => string): InvoiceDocumentLabels => ({
	invoiceTitle: t('components.sellingInvoices.invoiceKind.selling'),
	buyingInvoiceTitle: t('components.sellingInvoices.invoiceKind.buying'),
	billTo: t('components.sellingInvoices.drawer.customer'),
	supplier: t('components.buyingInvoices.drawer.supplier'),
	invoiceNumber: t('components.sellingInvoices.document.invoiceNumber'),
	date: t('components.sellingInvoices.drawer.invoiceDate'),
	time: t('components.sellingInvoices.drawer.invoiceTime'),
	status: t('components.sellingInvoices.columns.status'),
	paymentType: t('components.sellingInvoices.columns.paymentType'),
	salesPerson: t('components.sellingInvoices.drawer.salesPerson'),
	item: t('components.sellingInvoices.document.item'),
	qty: t('components.sellingInvoices.document.qty'),
	unit: t('components.sellingInvoices.document.unit'),
	unitPrice: t('components.sellingInvoices.document.unitPrice'),
	discount: t('components.sellingInvoices.drawer.discount'),
	lineTotal: t('components.sellingInvoices.document.lineTotal'),
	subtotal: t('components.sellingInvoices.drawer.subtotal'),
	invoiceDiscount: t('components.sellingInvoices.drawer.discount'),
	tax: t('components.sellingInvoices.document.tax'),
	grandTotal: t('components.sellingInvoices.drawer.grandTotal'),
	paid: t('components.sellingInvoices.columns.paid'),
	due: t('components.sellingInvoices.columns.due'),
	notes: t('components.sellingInvoices.drawer.additionalInfo'),
	phone: t('components.invoiceSettings.phone'),
	email: t('components.invoiceSettings.email'),
	taxNumber: t('components.invoiceSettings.taxNumber'),
	address: t('components.invoiceSettings.address'),
})

const trimOptional = (value?: string) => {
	const trimmed = value?.trim()
	return trimmed ? trimmed : undefined
}

const toDocumentModel = ({
	kind,
	invoice,
	brand,
	labels,
	pdfCurrencyId,
	currencyOptions,
	resolveUnitName,
	t,
}: {
	kind: 'selling' | 'buying'
	invoice: ApiSellingInvoice | ApiBuyingInvoice
	brand: ReturnType<typeof resolveInvoiceBrand>
	labels: InvoiceDocumentLabels
	pdfCurrencyId: string | null
	currencyOptions: DisplayCurrencyOption[]
	resolveUnitName: (unitIdOrName?: string) => string
	t: (key: string, options?: Record<string, unknown>) => string
}): InvoiceDocumentModel => {
	const formatAmount = (amount: number) => formatNumber(amount) ?? ''

	// Default Invoice Currency (settings), not the table display toggle.
	const pdfAmounts = getInvoicePdfCurrencyAmounts(
		invoice,
		pdfCurrencyId,
		currencyOptions,
	)
	// Same rate for lines and totals so they cannot drift.
	const convertAmount = (amount: number) =>
		roundDisplayAmount(amount * pdfAmounts.exchangeRate)
	const currencyLabel = getCurrencyLabel(pdfCurrencyId, currencyOptions, '')
	const status = mapStatus(invoice)
	const issuedAt = invoice.issuedAt ?? invoice.createdAt
	const paymentType = invoice.paymentType ?? 'cash'
	const partyName =
		kind === 'buying'
			? ((invoice as ApiBuyingInvoice).supplierName ?? '—')
			: ((invoice as ApiSellingInvoice).customerName ??
				t('components.sellingInvoices.drawer.walkInCustomer'))
	const salesPerson =
		kind === 'selling'
			? trimOptional((invoice as ApiSellingInvoice).salesPerson)
			: undefined

	const lines = (invoice.items ?? []).map(item => {
		const lineItem = {
			id: item.productId,
			productId: item.productId,
			name: item.name,
			barcode: item.barcode,
			quantity: item.quantity,
			unit: item.unit ?? '',
			unitPrice: item.unitPrice,
			discount: item.discount ?? 0,
			discountIsPercent: item.discountIsPercent ?? true,
			taxRate: item.taxRate ?? 0,
		}
		const discountAmount = getLineDiscountAmount(lineItem)
		return {
			name: lineItem.name,
			quantity: lineItem.quantity,
			unit: resolveUnitName(lineItem.unit),
			unitPrice: convertAmount(lineItem.unitPrice),
			discountLabel:
				discountAmount <= 0
					? '—'
					: lineItem.discountIsPercent
						? `${lineItem.discount}%`
						: formatAmount(convertAmount(discountAmount)),
			lineTotal: convertAmount(calculateLineItemTotal(lineItem)),
		}
	})

	return {
		kind,
		brand,
		invoiceNumber: invoice.invoiceNumber,
		invoiceDate: issuedAt ? dayjs(issuedAt).format('YYYY-MM-DD') : '—',
		invoiceTime: issuedAt ? dayjs(issuedAt).format('HH:mm') : '—',
		status,
		statusLabel: t(`components.sellingInvoices.status.${status}`),
		paymentTypeLabel: t(
			`components.sellingInvoices.paymentType.${paymentType}`,
		),
		partyName,
		salesPerson,
		currencyLabel,
		lines,
		subtotal: pdfAmounts.subtotal,
		discount: pdfAmounts.discount,
		tax: pdfAmounts.tax,
		grandTotal: pdfAmounts.grandTotal,
		paid: pdfAmounts.paidAmount,
		due: pdfAmounts.remainingAmount,
		notes: trimOptional(invoice.notes),
		labels,
		formatAmount,
	}
}

export const useInvoiceDocumentExport = () => {
	const { t, i18n } = useTranslation()
	const tenantName = useSelector(
		(state: RootState) => state.user.user?.tenantName,
	)
	const { data: invoiceSettings, refetch: refetchInvoiceSettings } =
		useGetInvoiceSettingsQuery()

	const { data: currencySettings, refetch: refetchCurrencySettings } =
		useGetCurrencySettingsQuery()

	const { data: userSettings, refetch: refetchUserSettings } =
		useGetUserSettingsQuery()
	const { data: units = [] } = useGetUnitsQuery({})
	const [fetchSellingInvoice] = useLazyGetSellingInvoiceQuery()
	const [fetchBuyingInvoice] = useLazyGetBuyingInvoiceQuery()
	const [isExporting, setIsExporting] = useState(false)

	const resolveUnitName = useCallback(
		(unitIdOrName?: string) => {
			const value = unitIdOrName?.trim()
			if (!value) return ''
			return units.find(unit => unit.unitId === value)?.name ?? value
		},
		[units],
	)

	const runExport = useCallback(
		async (
			invoiceId: string,
			kind: 'selling' | 'buying',
			mode: 'print' | 'download',
		) => {
			// Preserve the user gesture so popup blockers allow the print window.
			const printWindow = mode === 'print' ? openInvoicePrintWindow() : null

			setIsExporting(true)
			try {
				const [
					{ data: freshCurrencySettings },
					{ data: freshUserSettings },
					{ data: freshInvoiceSettings },
					invoice,
				] = await Promise.all([
					refetchCurrencySettings(),
					refetchUserSettings(),
					refetchInvoiceSettings(),
					kind === 'selling'
						? fetchSellingInvoice(invoiceId).unwrap()
						: fetchBuyingInvoice(invoiceId).unwrap(),
				])

				const brand = resolveInvoiceBrand(
					freshInvoiceSettings ?? invoiceSettings,
					tenantName,
				)
				const settings = freshCurrencySettings ?? currencySettings
				const currencyOptions = buildDisplayCurrencyOptions(settings)
				const pdfCurrencyId = resolveDefaultDisplayCurrencyId(
					currencyOptions,
					freshUserSettings?.defaultInvoiceCurrencyId ??
						userSettings?.defaultInvoiceCurrencyId,
				)

				const model = toDocumentModel({
					kind,
					invoice,
					brand,
					labels: buildLabels(t),
					pdfCurrencyId,
					currencyOptions,
					resolveUnitName,
					t,
				})

				if (mode === 'print' && printWindow) {
					await printInvoiceDocument(model, printWindow)
				} else {
					await downloadInvoiceDocumentPdf(model)
				}
			} catch (error) {
				printWindow?.close()
				throw error
			} finally {
				setIsExporting(false)
			}
		},
		[
			currencySettings,
			fetchBuyingInvoice,
			fetchSellingInvoice,
			i18n.language,
			invoiceSettings,
			refetchCurrencySettings,
			refetchInvoiceSettings,
			refetchUserSettings,
			resolveUnitName,
			t,
			tenantName,
			userSettings?.defaultInvoiceCurrencyId,
		],
	)

	return {
		isExporting,
		printInvoice: (invoiceId: string, kind: 'selling' | 'buying') =>
			runExport(invoiceId, kind, 'print'),
		downloadInvoice: (invoiceId: string, kind: 'selling' | 'buying') =>
			runExport(invoiceId, kind, 'download'),
	}
}
