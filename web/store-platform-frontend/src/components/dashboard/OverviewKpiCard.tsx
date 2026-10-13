import { useTranslation } from 'react-i18next'
import type { OverviewKpiId } from '../../shared/dashboardShell'
import { formatNumber } from '../../shared/utils'
import { KpiCardLive } from './kpiComponents'
import { OVERVIEW_KPI_VISUALS } from './overviewKpiVisuals'
import { useOverviewKpis } from './useOverviewKpis'

const LIVE_IDS = [
	'products',
	'registeredCustomers',
	'newCustomers',
	'inventoryCost',
	'invoicesToday',
	'totalReceivable',
	'totalPayable',
] as const

export type OverviewLiveKpiId = (typeof LIVE_IDS)[number]

const ICON_TONES: Record<OverviewLiveKpiId, { bg: string; color: string }> = {
	products: { bg: '#EFF6FF', color: '#2563EB' },
	registeredCustomers: { bg: '#F5F3FF', color: '#6D28D9' },
	newCustomers: { bg: '#ECFDF5', color: '#059669' },
	inventoryCost: { bg: '#FFFBEB', color: '#D97706' },
	invoicesToday: { bg: '#EEF2FF', color: '#4F46E5' },
	totalReceivable: { bg: '#FEE2E2', color: '#DC2626' },
	totalPayable: { bg: '#FFF7ED', color: '#C2410C' },
}

const STATUS_KEYS = {
	loading: 'dashboard.kpi.loading',
	offline: 'common.onlineOnly',
	unavailable: 'dashboard.kpi.unavailable',
	error: 'dashboard.kpi.error',
} as const

const iconBoxSize = { base: '1.75rem', sm: '2rem', lg: '1.35rem' } as const

const MONEY_IDS = new Set<OverviewLiveKpiId>([
	'inventoryCost',
	'totalReceivable',
	'totalPayable',
])

interface OverviewKpiCardProps {
	kpiId: OverviewLiveKpiId
	dateFrom: Date
	dateTo: Date
}

const OverviewKpiCard = ({ kpiId, dateFrom, dateTo }: OverviewKpiCardProps) => {
	const { t } = useTranslation()
	const overview = useOverviewKpis(dateFrom, dateTo)
	const visual = OVERVIEW_KPI_VISUALS[kpiId satisfies OverviewKpiId]
	const Icon = visual.Icon
	const tone = ICON_TONES[kpiId]
	const slice =
		kpiId === 'totalReceivable'
			? overview.owedToUs
			: kpiId === 'totalPayable'
				? overview.weOwe
				: overview[kpiId]
	const amountText = MONEY_IDS.has(kpiId)
		? overview.formatMoney(slice.amount)
		: (formatNumber(slice.amount) ?? String(slice.amount))
	const value =
		slice.status === 'ready' ? amountText : t(STATUS_KEYS[slice.status])

	return (
		<KpiCardLive
			title={t(`dashboard.kpis.${kpiId}`)}
			value={value}
			iconBg={tone.bg}
			iconColor={tone.color}
			titleIcon={<Icon boxSize={iconBoxSize} aria-hidden />}
			hint={t(`dashboard.kpi.hints.${kpiId}`)}
			uncertain={
				kpiId === 'inventoryCost' &&
				overview.inventoryCost.partial &&
				slice.status === 'ready'
			}
		/>
	)
}

export default OverviewKpiCard
