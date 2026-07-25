import { useEffect, useMemo, useState } from 'react'
import { useGetCurrencySettingsQuery } from '../../api/apiStore'
import { useSettings } from '../../shared/context/SettingsContext'
import {
	buildDisplayCurrencyOptions,
	formatDisplayAmount,
	resolveDefaultDisplayCurrencyId,
	type DisplayCurrencyOption,
} from './currencyDisplay'

export const useInvoiceDisplayCurrency = () => {
	const { data: currencySettings } = useGetCurrencySettingsQuery(undefined, {
		refetchOnMountOrArgChange: false,
	})
	const { defaultInvoiceCurrencyId } = useSettings()

	const options = useMemo(
		() => buildDisplayCurrencyOptions(currencySettings),
		[currencySettings],
	)

	const defaultCurrencyId = useMemo(
		() =>
			resolveDefaultDisplayCurrencyId(options, defaultInvoiceCurrencyId),
		[options, defaultInvoiceCurrencyId],
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
