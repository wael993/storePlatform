import {
	Box,
	Flex,
	Heading,
	SimpleGrid,
	Spinner,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import EmptyState from '../components/common/EmptyState'
import DatePickerLabel from '../components/common/DatePickerLabel'
import { KpiCardComingSoon } from '../components/dashboard/kpiComponents'
import { ActivityListCard } from '../components/dashboard/activityCards'
import { InventoryListCard } from '../components/dashboard/inventoryCards'
import { OVERVIEW_KPI_VISUALS } from '../components/dashboard/overviewKpiVisuals'
import { KpiChartComingSoon } from '../components/dashboard/salesProfitCharts'
import { BreadCrumbItem } from '../shared/globalEnums'
import {
	ACTIVITY_CARD_IDS,
	DASHBOARD_SECTIONS,
	getDashboardDefaultDateRange,
	INVENTORY_CARD_IDS,
	OVERVIEW_KPI_IDS,
	resolveDashboardShellStatus,
	SALES_PROFIT_CHART_IDS,
	type DashboardSectionId,
	type OverviewKpiId,
} from '../shared/dashboardShell'
import { generateBreadcrumbs } from '../shared/routes'
import { pageContentMinHeight } from '../theme/layout'
import { datePickerStyles } from '../theme/styles'

const sectionTitleKey = (id: DashboardSectionId) =>
	`dashboard.sections.${id}` as const

const overviewKpiTitleKey = (id: OverviewKpiId) =>
	`dashboard.kpis.${id}` as const

const iconBoxSize = { base: '1.75rem', sm: '2rem', lg: '1.35rem' } as const

const DashboardPage = () => {
	const { t } = useTranslation()
	const breadCrumbItems = generateBreadcrumbs()
	const status = resolveDashboardShellStatus()
	const [dateFrom, setDateFrom] = useState(
		() => getDashboardDefaultDateRange().dateFrom,
	)
	const [dateTo, setDateTo] = useState(
		() => getDashboardDefaultDateRange().dateTo,
	)

	return (
		<Flex flexDir="column" pb={4} minH={pageContentMinHeight}>
			<Flex flexDir="column" px={4}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.DASHBOARD]}
				/>
			</Flex>
			<Heading
				fontSize="1.5rem"
				fontWeight={700}
				mt="0.4rem"
				px={{ base: 4, md: 8 }}
				mb={{ base: 4, md: 6 }}
			>
				{t('components.pageHeaders.dashboard')}
			</Heading>
			<Flex gap={3} flexWrap="wrap" mb={4} px={{ base: 4, md: 8 }}>
				<Box maxW={{ base: '100%', sm: '12rem' }}>
					<DatePickerLabel
						label={t('common.from')}
						onChange={date => {
							if (date) setDateFrom(date)
						}}
						defaultDate={dateFrom}
						maxDate={dateTo}
						styles={datePickerStyles}
						usePortal
					/>
				</Box>
				<Box maxW={{ base: '100%', sm: '12rem' }}>
					<DatePickerLabel
						label={t('common.to')}
						onChange={date => {
							if (date) setDateTo(date)
						}}
						defaultDate={dateTo}
						minDate={dateFrom}
						styles={datePickerStyles}
						usePortal
					/>
				</Box>
			</Flex>

			<Box px={{ base: 4, md: 8 }}>
				{status === 'loading' && (
					<Flex justify="center" py={16}>
						<Spinner size="lg" />
					</Flex>
				)}
				{status === 'error' && (
					<Text color="red.500">{t('dashboard.error')}</Text>
				)}
				{status === 'empty' && (
					<EmptyState
						title={t('dashboard.emptyTitle')}
						description={t('dashboard.emptyDescription')}
					/>
				)}
				{status === 'ready' && (
					<VStack align="stretch" spacing={{ base: 8, md: 10 }}>
						{DASHBOARD_SECTIONS.map(sectionId => (
							<Box as="section" key={sectionId}>
								<Heading
									as="h2"
									fontSize="1.125rem"
									fontWeight={700}
									mb={4}
									color="gray.800"
								>
									{t(sectionTitleKey(sectionId))}
								</Heading>
								{sectionId === 'overview' ? (
									<SimpleGrid
										minChildWidth={{
											base: '100%',
											sm: '16rem',
											lg: '13.5rem',
										}}
										spacing={4}
									>
										{OVERVIEW_KPI_IDS.map(kpiId => {
											const visual = OVERVIEW_KPI_VISUALS[kpiId]
											const Icon = visual.Icon
											return (
												<KpiCardComingSoon
													key={kpiId}
													title={t(overviewKpiTitleKey(kpiId))}
													value={visual.value}
													trend={visual.trend}
													titleIcon={
														<Icon
															boxSize={iconBoxSize}
															color="gray.500"
															aria-hidden
														/>
													}
												/>
											)
										})}
									</SimpleGrid>
								) : sectionId === 'salesProfit' ? (
									<SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
										{SALES_PROFIT_CHART_IDS.map(chartId => (
											<KpiChartComingSoon key={chartId} chartId={chartId} />
										))}
									</SimpleGrid>
								) : sectionId === 'inventory' ? (
									<SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
										{INVENTORY_CARD_IDS.map(cardId => (
											<InventoryListCard key={cardId} cardId={cardId} />
										))}
									</SimpleGrid>
								) : sectionId === 'activity' ? (
									<SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
										{ACTIVITY_CARD_IDS.map(cardId => (
											<ActivityListCard key={cardId} cardId={cardId} />
										))}
									</SimpleGrid>
								) : null}
							</Box>
						))}
					</VStack>
				)}
			</Box>
		</Flex>
	)
}

export default DashboardPage
