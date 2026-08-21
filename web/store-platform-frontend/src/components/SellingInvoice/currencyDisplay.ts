import { formatNumber } from '../../shared/utils'
import type { CurrencySettingItem, CurrencySettings } from '../../api/apiStore'

export interface DisplayCurrencyOption {
	currencyId: string
	label: string
	name: string
	exchangeRate: number
}

export const buildDisplayCurrencyOptions = (
	settings?: CurrencySettings | null,
): DisplayCurrencyOption[] => {
	if (!settings?.primaryCurrency) {
		return []
	}

	const primary = settings.primaryCurrency
	const options: DisplayCurrencyOption[] = [
		{
			currencyId: primary.currencyId,
			label: primary.internalCode || primary.name,
			name: primary.name,
			exchangeRate: 1,
		},
	]

	for (const secondary of settings.secondaryCurrencies ?? []) {
		options.push({
			currencyId: secondary.currencyId,
			label: secondary.internalCode || secondary.name,
			name: secondary.name,
			exchangeRate: secondary.exchangeRate ?? 1,
		})
	}

	return options
}

export const resolveCurrencyIdFromCode = (
	code: string | undefined,
	options: DisplayCurrencyOption[],
): string | null => {
	const normalized = code?.trim().toLowerCase()

	if (!normalized) {
		return null
	}

	const match = options.find(
		option =>
			option.label.toLowerCase() === normalized ||
			option.name.toLowerCase() === normalized,
	)

	return match?.currencyId ?? null
}

export const getExchangeRateDisplayValue = (
	canonicalRate: number | undefined,
	unitCurrencyId: string | null | undefined,
	primaryCurrencyId: string | null | undefined,
): number | undefined => {
	if (!canonicalRate || canonicalRate <= 0) {
		return undefined
	}

	if (!unitCurrencyId || unitCurrencyId === primaryCurrencyId) {
		return canonicalRate
	}

	// note: 4dp; 8dp money rounding of 1/14 is 0.07142857, and 1/that is 14.00000028 in the input.
	return Math.round((1 / canonicalRate) * 1e4) / 1e4
}

export const normalizeExchangeRateInput = (
	inputValue: number,
	unitCurrencyId: string | null | undefined,
	primaryCurrencyId: string | null | undefined,
): number => {
	if (inputValue <= 0) {
		return inputValue
	}

	if (!unitCurrencyId || unitCurrencyId === primaryCurrencyId) {
		return inputValue
	}

	return 1 / inputValue
}

export const resolveDefaultDisplayCurrencyId = (
	options: DisplayCurrencyOption[],
	preferredCurrencyId?: string | null,
): string | null => {
	if (options.length === 0) {
		return null
	}

	if (
		preferredCurrencyId &&
		options.some(option => option.currencyId === preferredCurrencyId)
	) {
		return preferredCurrencyId
	}

	return options[0]?.currencyId ?? null
}

/** Round to display-currency cents (2 decimals). */
export const roundDisplayAmount = (amount: number) =>
	Math.round(amount * 100) / 100

/**
 * Keep enough primary precision so secondary-currency edits round-trip.
 * e.g. 1175 SYP / 132 → 8.901515… (not 8.90), so 8.901515… × 132 still shows 1175.
 */
export const roundPrimaryAmount = (amount: number) =>
	Math.round(amount * 1e8) / 1e8

export const convertPrimaryAmount = (
	amount: number,
	targetCurrencyId: string,
	options: DisplayCurrencyOption[],
): number => {
	const target = options.find(option => option.currencyId === targetCurrencyId)

	if (!target) {
		return amount
	}

	return roundDisplayAmount(amount * target.exchangeRate)
}

export const convertToPrimaryAmount = (
	displayAmount: number,
	displayCurrencyId: string | null,
	options: DisplayCurrencyOption[],
): number => {
	if (!displayCurrencyId) {
		return roundPrimaryAmount(displayAmount)
	}

	const rate =
		options.find(option => option.currencyId === displayCurrencyId)
			?.exchangeRate ?? 1

	if (rate === 0) {
		return roundPrimaryAmount(displayAmount)
	}

	return roundPrimaryAmount(displayAmount / rate)
}

export const getCurrencyLabel = (
	currencyId: string | null,
	options: DisplayCurrencyOption[],
	fallback = 'ل.س',
): string => {
	if (!currencyId) {
		return fallback
	}

	return (
		options.find(option => option.currencyId === currencyId)?.label ?? fallback
	)
}

export const formatDisplayAmount = (
	amount: number,
	currencyId: string | null,
	options: DisplayCurrencyOption[],
	fallbackLabel = 'ل.س',
): string => {
	const label = getCurrencyLabel(currencyId, options, fallbackLabel)
	const converted = currencyId
		? convertPrimaryAmount(amount, currencyId, options)
		: amount

	return `${formatNumber(converted) ?? '0.00'} ${label}`
}

export const buildOptionsFromItems = (
	primary: CurrencySettingItem | null,
	secondaries: CurrencySettingItem[],
): DisplayCurrencyOption[] =>
	buildDisplayCurrencyOptions({
		primaryCurrency: primary,
		secondaryCurrencies: secondaries,
	})

export interface OtherCurrencyAmountLine {
	currencyId: string
	name: string
	text: string
}

export const getOtherCurrencyAmountLines = (
	amount: number,
	options: DisplayCurrencyOption[],
	excludeCurrencyId?: string | null,
): OtherCurrencyAmountLine[] =>
	options
		.filter(option => option.currencyId !== excludeCurrencyId)
		.map(option => ({
			currencyId: option.currencyId,
			name: option.name,
			text: formatDisplayAmount(amount, option.currencyId, options),
		}))

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

export const buildInvoiceCurrencyAmounts = (
	settings: CurrencySettings | null | undefined,
	totals: {
		grandTotal: number
		subtotal: number
		tax: number
		discount: number
	},
	paidAmount: number,
	remainingAmount: number,
): InvoiceCurrencyAmount[] => {
	if (!settings?.primaryCurrency) {
		return []
	}

	const currencies: Array<
		CurrencySettingItem & { exchangeRate: number; isPrimary: boolean }
	> = [
		{
			...settings.primaryCurrency,
			exchangeRate: 1,
			isPrimary: true,
		},
		...(settings.secondaryCurrencies ?? []).map(secondary => ({
			...secondary,
			exchangeRate: secondary.exchangeRate ?? 1,
			isPrimary: false,
		})),
	]

	return currencies.map(currency => ({
		currencyId: currency.currencyId,
		name: currency.name,
		internalCode: currency.internalCode,
		exchangeRate: currency.exchangeRate,
		isPrimary: currency.isPrimary,
		amount: totals.grandTotal * currency.exchangeRate,
		paidAmount: paidAmount * currency.exchangeRate,
		remainingAmount: remainingAmount * currency.exchangeRate,
		subtotal: totals.subtotal * currency.exchangeRate,
		tax: totals.tax * currency.exchangeRate,
		discount: totals.discount * currency.exchangeRate,
	}))
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

export type SavedCurrencyAmountField =
	'amount' | 'paidAmount' | 'remainingAmount'

export const formatSavedCurrencyAmount = (
	currencyAmounts: InvoiceCurrencyAmount[] | undefined,
	field: SavedCurrencyAmountField,
	currencyId: string,
): string | null => {
	const entry = currencyAmounts?.find(
		amount => amount.currencyId === currencyId,
	)

	if (!entry) {
		return null
	}

	const label = entry.internalCode || entry.name

	return `${formatNumber(entry[field]) ?? '0.00'} ${label}`
}

export const getSavedOtherCurrencyAmountLines = (
	currencyAmounts: InvoiceCurrencyAmount[] | undefined,
	field: SavedCurrencyAmountField,
	excludeCurrencyId?: string | null,
): OtherCurrencyAmountLine[] => {
	if (!currencyAmounts?.length) {
		return []
	}

	return currencyAmounts
		.filter(entry => entry.currencyId !== excludeCurrencyId)
		.map(entry => ({
			currencyId: entry.currencyId,
			name: entry.name,
			text: `${formatNumber(entry[field]) ?? '0.00'} ${entry.internalCode || entry.name}`,
		}))
}

export const formatInvoiceAmountForDisplay = (
	currencyAmounts: InvoiceCurrencyAmount[] | undefined,
	field: SavedCurrencyAmountField,
	displayCurrencyId: string | null,
	primaryAmount: number,
	options: DisplayCurrencyOption[],
): string => {
	if (displayCurrencyId && currencyAmounts?.length) {
		const savedDisplay = formatSavedCurrencyAmount(
			currencyAmounts,
			field,
			displayCurrencyId,
		)

		if (savedDisplay) {
			return savedDisplay
		}
	}

	return formatDisplayAmount(primaryAmount, displayCurrencyId, options)
}

export const convertEntryAmountToPrimary = (
	amount: number,
	entryCurrencyId: string | null | undefined,
	options: DisplayCurrencyOption[],
): number => {
	if (!entryCurrencyId) {
		return roundPrimaryAmount(amount)
	}

	return convertToPrimaryAmount(amount, entryCurrencyId, options)
}

export const formatEntryAmountForDisplay = (
	amount: number,
	entryCurrencyId: string | null | undefined,
	displayCurrencyId: string | null,
	options: DisplayCurrencyOption[],
): string => {
	const primaryAmount = convertEntryAmountToPrimary(
		amount,
		entryCurrencyId,
		options,
	)

	return formatDisplayAmount(primaryAmount, displayCurrencyId, options)
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

export type InvoicePdfCurrencyAmounts = {
	grandTotal: number
	paidAmount: number
	remainingAmount: number
	subtotal: number
	tax: number
	discount: number
	currencyId: string | undefined
	/** Multiply primary amounts by this to match PDF totals/lines. */
	exchangeRate: number
}

/**
 * Amounts for PDF / print: Default Invoice Currency when present on the invoice,
 * otherwise convert primary amounts. Always returns the exchangeRate used so
 * line items can convert with the same rate as the totals.
 */
export const getInvoicePdfCurrencyAmounts = (
	invoice: InvoiceAmountSource,
	pdfCurrencyId: string | null | undefined,
	options: DisplayCurrencyOption[],
): InvoicePdfCurrencyAmounts => {
	const optionRate =
		(pdfCurrencyId &&
			options.find(option => option.currencyId === pdfCurrencyId)
				?.exchangeRate) ||
		1

	if (pdfCurrencyId) {
		const saved = invoice.currencyAmounts?.find(
			amount => amount.currencyId === pdfCurrencyId,
		)
		if (saved) {
			return {
				grandTotal: saved.amount,
				paidAmount: saved.paidAmount,
				remainingAmount: saved.remainingAmount,
				subtotal: saved.subtotal,
				tax: saved.tax,
				discount: saved.discount,
				currencyId: saved.currencyId,
				exchangeRate: saved.exchangeRate > 0 ? saved.exchangeRate : optionRate,
			}
		}
	}

	const primary = getPrimaryInvoiceCurrencyAmounts(invoice)
	if (!pdfCurrencyId) {
		return { ...primary, exchangeRate: 1 }
	}

	const exchangeRate = optionRate > 0 ? optionRate : 1
	const convert = (amount: number) => roundDisplayAmount(amount * exchangeRate)

	return {
		grandTotal: convert(primary.grandTotal),
		paidAmount: convert(primary.paidAmount),
		remainingAmount: convert(primary.remainingAmount),
		subtotal: convert(primary.subtotal),
		tax: convert(primary.tax),
		discount: convert(primary.discount),
		currencyId: pdfCurrencyId,
		exchangeRate,
	}
}
