import { format } from 'date-fns'
import { useMemo } from 'react'
import {
	useGetCurrencySettingsQuery,
	useGetSellingInvoicesQuery,
} from '../../api/apiStore'
import { mapApiSummaryToUi } from '../SellingInvoice/invoiceApiMappers'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'
import { formatNumber } from '../../shared/utils'
import { readInvoiceSummaryKpis } from './invoiceSummaryKpis'

export type InvoiceSummaryKpiStatus =
	'loading' | 'offline' | 'unavailable' | 'error' | 'ready'

export const useInvoiceSummaryKpis = (dateFrom: Date, dateTo: Date) => {
	const { canSee } = useSee()
	const allowed = canSee(SEE.sellingInvoicesSummary)
	const params = useMemo(
		() => ({
			dateFrom: format(dateFrom, 'yyyy-MM-dd'),
			dateTo: format(dateTo, 'yyyy-MM-dd'),
			summaryOnly: true,
		}),
		[dateFrom, dateTo],
	)
	const query = useGetSellingInvoicesQuery(params, {
		skip: !allowed,
		refetchOnMountOrArgChange: false,
	})
	const { data: currencySettings } = useGetCurrencySettingsQuery(undefined, {
		skip: !allowed,
		refetchOnMountOrArgChange: false,
	})

	const summary = query.data?.summary
	const kpis = summary
		? readInvoiceSummaryKpis(mapApiSummaryToUi(summary))
		: null
	const isLoading =
		allowed && (query.isLoading || (query.isFetching && !query.data))

	let status: InvoiceSummaryKpiStatus = 'ready'
	if (!allowed) status = 'unavailable'
	else if (isLoading) status = 'loading'
	else if (query.isError) status = 'error'
	else if (!kpis) status = 'unavailable'

	const currencyLabel =
		currencySettings?.primaryCurrency?.internalCode ||
		currencySettings?.primaryCurrency?.name ||
		''

	const formatMoney = (amount: number | null) => {
		if (amount == null) return '—'
		const formatted = formatNumber(amount) ?? String(amount)
		return currencyLabel ? `${formatted} ${currencyLabel}` : formatted
	}

	return { status, kpis, formatMoney }
}
