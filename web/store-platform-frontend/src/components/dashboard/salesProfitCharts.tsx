import { Box, Flex, Text } from '@chakra-ui/react'
import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TimeIcon } from '../../shared/icons/Time'
import type { SalesProfitChartId } from '../../shared/dashboardShell'
import EChartsHost from './EChartsHost'

const CHART_COLORS = [
	'#94A3B8',
	'#64748B',
	'#CBD5E1',
	'#475569',
	'#E2E8F0',
] as const

const chartCardStyles = {
	card: {
		position: 'relative',
		overflow: 'hidden',
		bg: 'white',
		border: '1px solid',
		borderColor: 'gray.200',
		borderRadius: '2xl',
		minW: 0,
		h: '100%',
		px: { base: 4, sm: 5 },
		py: { base: 4, sm: 5 },
		boxShadow: '0 8px 30px rgba(15, 23, 42, 0.06)',
	},
	ribbon: {
		position: 'absolute',
		top: { base: '1.5rem', lg: '1.25rem' },
		right: { base: '-3.75rem', lg: '-3.25rem' },
		w: { base: '11rem', lg: '9.5rem' },
		transform: 'rotate(45deg)',
		bg: 'gray.500',
		color: 'white',
		py: { base: 1.5, lg: 1 },
		boxShadow: '0 3px 8px rgba(15, 23, 42, 0.15)',
		zIndex: 2,
		pointerEvents: 'none',
	},
	ribbonLabel: {
		alignItems: 'center',
		justifyContent: 'center',
		gap: 1.5,
		fontSize: { base: '0.65rem', lg: '0.55rem' },
		fontWeight: 800,
		letterSpacing: '0.08em',
		textTransform: 'uppercase',
	},
	title: {
		fontSize: { base: 'md', sm: 'lg' },
		fontWeight: 600,
		color: 'gray.500',
		lineHeight: '1.2',
		mb: 3,
		pr: 10,
	},
} satisfies StylesObject

const buildSalesByCategoryOption = (labels: string[]): EChartsOption => ({
	backgroundColor: '#F8FAFC',
	color: [...CHART_COLORS],
	tooltip: {
		trigger: 'item',
		backgroundColor: 'rgba(15, 23, 42, 0.95)',
		borderWidth: 0,
		padding: [10, 14],
		textStyle: { color: '#FFFFFF', fontSize: 13 },
		formatter: (params: unknown) => {
			const p = params as {
				name: string
				value: number
				percent: number
			}
			return `<div style="font-weight:600;margin-bottom:4px;">${p.name}</div>
<div style="color:#CBD5E1;">${p.value.toLocaleString()} <span style="color:#94A3B8;">(${p.percent}%)</span></div>`
		},
	},
	legend: {
		bottom: '4%',
		left: 'center',
		icon: 'circle',
		itemWidth: 9,
		itemHeight: 9,
		itemGap: 16,
		textStyle: { color: '#475569', fontSize: 12, fontWeight: 500 },
	},
	series: [
		{
			name: 'Sales',
			type: 'pie',
			radius: '70%',
			center: ['50%', '43%'],
			avoidLabelOverlap: true,
			itemStyle: {
				borderRadius: 8,
				borderColor: '#F8FAFC',
				borderWidth: 4,
			},
			label: { show: false },
			labelLine: { show: false },
			emphasis: {
				scale: true,
				scaleSize: 6,
				itemStyle: {
					shadowBlur: 20,
					shadowOffsetX: 0,
					shadowColor: 'rgba(15, 23, 42, 0.18)',
				},
				label: {
					show: true,
					position: 'center',
					formatter: (params: unknown) => {
						const p = params as {
							name: string
							value: number
							percent: number
						}
						return [
							`{name|${p.name}}`,
							`{value|${p.value.toLocaleString()}}`,
							`{percent|${p.percent}%}`,
						].join('\n')
					},
					rich: {
						name: {
							color: '#64748B',
							fontSize: 14,
							fontWeight: 500,
							lineHeight: 24,
						},
						value: {
							color: '#0F172A',
							fontSize: 28,
							fontWeight: 700,
							lineHeight: 36,
						},
						percent: {
							color: '#64748B',
							fontSize: 13,
							fontWeight: 600,
							lineHeight: 22,
						},
					},
				},
			},
			data: [
				{ value: 1048, name: labels[0] },
				{ value: 735, name: labels[1] },
				{ value: 580, name: labels[2] },
				{ value: 484, name: labels[3] },
				{ value: 300, name: labels[4] },
			],
		},
	],
})

const buildSalesByMonthOption = (
	months: string[],
	salesLabel: string,
): EChartsOption => ({
	backgroundColor: '#F8FAFC',
	color: [...CHART_COLORS],
	tooltip: {
		trigger: 'axis',
		backgroundColor: 'rgba(15, 23, 42, 0.95)',
		borderWidth: 0,
		textStyle: { color: '#FFFFFF', fontSize: 13 },
	},
	grid: { left: 40, right: 16, top: 24, bottom: 32 },
	xAxis: {
		type: 'category',
		data: months,
		axisLine: { lineStyle: { color: '#E2E8F0' } },
		axisLabel: { color: '#64748B' },
	},
	yAxis: {
		type: 'value',
		axisLine: { show: false },
		splitLine: { lineStyle: { color: '#E2E8F0' } },
		axisLabel: { color: '#64748B' },
	},
	series: [
		{
			name: salesLabel,
			type: 'bar',
			barWidth: '48%',
			itemStyle: { borderRadius: [6, 6, 0, 0], color: '#94A3B8' },
			data: [4200, 5100, 4800, 6200, 5900, 7100, 8000, 7600, 4000],
		},
	],
})

const buildSalesProfit7DaysOption = (
	days: string[],
	salesLabel: string,
	profitLabel: string,
): EChartsOption => ({
	backgroundColor: '#F8FAFC',
	color: ['#64748B', '#94A3B8'],
	tooltip: {
		trigger: 'axis',
		backgroundColor: 'rgba(15, 23, 42, 0.95)',
		borderWidth: 0,
		textStyle: { color: '#FFFFFF', fontSize: 13 },
	},
	legend: {
		bottom: 0,
		icon: 'circle',
		itemWidth: 9,
		itemHeight: 9,
		textStyle: { color: '#475569', fontSize: 12, fontWeight: 500 },
	},
	grid: { left: 40, right: 16, top: 24, bottom: 48 },
	xAxis: {
		type: 'category',
		data: days,
		boundaryGap: false,
		axisLine: { lineStyle: { color: '#E2E8F0' } },
		axisLabel: { color: '#64748B' },
	},
	yAxis: {
		type: 'value',
		axisLine: { show: false },
		splitLine: { lineStyle: { color: '#E2E8F0' } },
		axisLabel: { color: '#64748B' },
	},
	series: [
		{
			name: salesLabel,
			type: 'line',
			smooth: true,
			symbol: 'circle',
			symbolSize: 7,
			lineStyle: { width: 3 },
			data: [820, 932, 901, 1134, 1290, 1330, 1420],
		},
		{
			name: profitLabel,
			type: 'line',
			smooth: true,
			symbol: 'circle',
			symbolSize: 7,
			lineStyle: { width: 3 },
			data: [220, 282, 251, 314, 390, 410, 450],
		},
	],
})

interface KpiChartComingSoonProps {
	chartId: SalesProfitChartId
}

export const KpiChartComingSoon = ({ chartId }: KpiChartComingSoonProps) => {
	const { t } = useTranslation()

	const option = useMemo(() => {
		if (chartId === 'salesByCategory') {
			return buildSalesByCategoryOption([
				t('dashboard.charts.mockCategories.electronics'),
				t('dashboard.charts.mockCategories.food'),
				t('dashboard.charts.mockCategories.clothing'),
				t('dashboard.charts.mockCategories.toys'),
				t('dashboard.charts.mockCategories.other'),
			])
		}
		if (chartId === 'salesByMonth') {
			return buildSalesByMonthOption(
				[
					t('dashboard.charts.mockMonths.jan'),
					t('dashboard.charts.mockMonths.feb'),
					t('dashboard.charts.mockMonths.mar'),
					t('dashboard.charts.mockMonths.apr'),
					t('dashboard.charts.mockMonths.may'),
					t('dashboard.charts.mockMonths.jun'),
					t('dashboard.charts.mockMonths.jul'),
					t('dashboard.charts.mockMonths.aug'),
					t('dashboard.charts.mockMonths.sep'),
				],
				t('dashboard.charts.series.sales'),
			)
		}
		return buildSalesProfit7DaysOption(
			[
				t('dashboard.charts.mockDays.mon'),
				t('dashboard.charts.mockDays.tue'),
				t('dashboard.charts.mockDays.wed'),
				t('dashboard.charts.mockDays.thu'),
				t('dashboard.charts.mockDays.fri'),
				t('dashboard.charts.mockDays.sat'),
				t('dashboard.charts.mockDays.sun'),
			],
			t('dashboard.charts.series.sales'),
			t('dashboard.charts.series.profit'),
		)
	}, [chartId, t])

	return (
		<Box sx={chartCardStyles.card}>
			<Box sx={chartCardStyles.ribbon}>
				<Flex sx={chartCardStyles.ribbonLabel}>
					<TimeIcon boxSize={{ base: '0.8rem', lg: '0.65rem' }} />
					{t('dashboard.kpi.comingSoon')}
				</Flex>
			</Box>
			<Text sx={chartCardStyles.title} noOfLines={2}>
				{t(`dashboard.charts.${chartId}`)}
			</Text>
			<Box borderRadius="xl" overflow="hidden" bg="#F8FAFC">
				<EChartsHost option={option} height={{ base: '16rem', md: '18rem' }} />
			</Box>
		</Box>
	)
}
