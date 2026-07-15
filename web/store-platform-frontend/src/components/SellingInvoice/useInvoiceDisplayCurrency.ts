import { useEffect, useMemo, useState } from 'react'
import {
	useGetCurrencySettingsQuery,
	useGetUserSettingsQuery,
} from '../../api/apiStore'
import {
	buildDisplayCurrencyOptions,
	formatDisplayAmount,
	resolveDefaultDisplayCurrencyId,
	type DisplayCurrencyOption,
} from './currencyDisplay'

export const useInvoiceDisplayCurrency = () => {
	const { data: currencySettings } = useGetCurrencySettingsQuery()
	const { data: userSettings } = useGetUserSettingsQuery()

	const options = useMemo(
		() => buildDisplayCurrencyOptions(currencySettings),
		[currencySettings],
	)

	const defaultCurrencyId = useMemo(
		() =>
			resolveDefaultDisplayCurrencyId(
				options,
				userSettings?.defaultInvoiceCurrencyId,
			),
		[options, userSettings?.defaultInvoiceCurrencyId],
	)

	const [displayCurrencyId, setDisplayCurrencyId] = useState<string | null>(
		defaultCurrencyId,
	)

	useEffect(() => {
		setDisplayCurrencyId(defaultCurrencyId)
	}, [defaultCurrencyId])

	const formatAmount = (amount: number) =>
		formatDisplayAmount(amount, displayCurrencyId, options)

	return {
		options,
		displayCurrencyId,
		setDisplayCurrencyId,
		formatAmount,
		hasCurrencyOptions: options.length > 0,
		currencySettings,
	}
}

export type { DisplayCurrencyOption }
