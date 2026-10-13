import { useTranslation } from 'react-i18next'
import { OVERVIEW_KPI_VISUALS } from './overviewKpiVisuals'
import { KpiCardLive } from './kpiComponents'
import { useInvoiceSummaryKpis } from './useInvoiceSummaryKpis'

const LIVE_KPI_IDS = ['salesToday', 'profit'] as const

export type InvoiceSummaryKpiId = (typeof LIVE_KPI_IDS)[number]

const ICON_TONES: Record<InvoiceSummaryKpiId, { bg: string; color: string }> = {
	salesToday: { bg: '#ECFDF5', color: '#059669' },
	profit: { bg: '#ECFDF5', color: '#047857' },
}

const iconBoxSize = { base: '1.75rem', sm: '2rem', lg: '1.35rem' } as const

const STATUS_KEYS = {
	loading: 'dashboard.kpi.loading',
	offline: 'common.onlineOnly',
	unavailable: 'dashboard.kpi.unavailable',
	error: 'dashboard.kpi.error',
} as const

interface InvoiceSummaryKpiCardProps {
	kpiId: InvoiceSummaryKpiId
	dateFrom: Date
	dateTo: Date
}

const InvoiceSummaryKpiCard = ({
	kpiId,
	dateFrom,
	dateTo,
}: InvoiceSummaryKpiCardProps) => {
	const { t } = useTranslation()
	const { status, kpis, formatMoney } = useInvoiceSummaryKpis(dateFrom, dateTo)
	const visual = OVERVIEW_KPI_VISUALS[kpiId]
	const Icon = visual.Icon
	const tone = ICON_TONES[kpiId]
	const amounts: Record<InvoiceSummaryKpiId, number | null> = {
		salesToday: kpis?.sales ?? null,
		profit: kpis?.profit ?? null,
	}
	const value =
		status === 'ready' ? formatMoney(amounts[kpiId]) : t(STATUS_KEYS[status])

	return (
		<KpiCardLive
			title={t(`dashboard.kpis.${kpiId}`)}
			value={value}
			iconBg={tone.bg}
			iconColor={tone.color}
			titleIcon={<Icon boxSize={iconBoxSize} aria-hidden />}
			hint={t(`dashboard.kpi.hints.${kpiId}`)}
			uncertain={
				kpiId === 'profit' && status === 'ready' && Boolean(kpis?.profitPartial)
			}
		/>
	)
}

export default InvoiceSummaryKpiCard
