import type { ICurrencySettingItem } from '../../models/CurrencySettings'

export type ImportCurrencySettings = {
	primaryCurrency: ICurrencySettingItem | null
	secondaryCurrencies?: ICurrencySettingItem[]
} | null

/** Catalog price.currency label used by Add Product (internalCode || name). */
export const currencySettingLabel = (
	item: Pick<ICurrencySettingItem, 'name' | 'internalCode'>,
): string => item.internalCode?.trim() || item.name.trim()

export const configuredCurrencyItems = (
	settings: ImportCurrencySettings,
): ICurrencySettingItem[] => {
	if (!settings?.primaryCurrency) return []

	return [settings.primaryCurrency, ...(settings.secondaryCurrencies ?? [])]
}

/**
 * Resolve a client currency string to the canonical catalog label, or null if
 * it is not one of the tenant's configured currencies.
 */
export const matchConfiguredCurrencyLabel = (
	raw: unknown,
	settings: ImportCurrencySettings,
): string | null => {
	if (typeof raw !== 'string' || !raw.trim()) return null

	const normalized = raw.trim().toLowerCase()
	const items = configuredCurrencyItems(settings)

	for (const item of items) {
		const label = currencySettingLabel(item)
		const name = item.name.trim()
		const code = item.internalCode?.trim()

		if (
			label.toLowerCase() === normalized ||
			name.toLowerCase() === normalized ||
			(code && code.toLowerCase() === normalized)
		) {
			return label
		}
	}

	return null
}
