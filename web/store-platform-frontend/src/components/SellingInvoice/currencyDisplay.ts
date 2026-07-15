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

export const convertPrimaryAmount = (
	amount: number,
	targetCurrencyId: string,
	options: DisplayCurrencyOption[],
): number => {
	const target = options.find(option => option.currencyId === targetCurrencyId)

	if (!target) {
		return amount
	}

	return amount * target.exchangeRate
}

export const getCurrencyLabel = (
	currencyId: string | null,
	options: DisplayCurrencyOption[],
	fallback = 'ل.س',
): string => {
	if (!currencyId) {
		return fallback
	}

	return options.find(option => option.currencyId === currencyId)?.label ?? fallback
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
