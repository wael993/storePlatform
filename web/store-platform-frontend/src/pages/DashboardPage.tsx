import {
	Box,
	Flex,
	Heading,
	SimpleGrid,
	Spinner,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetSuppliersQuery } from '../api/apiStore'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import EmptyState from '../components/common/EmptyState'
import DatePickerLabel from '../components/common/DatePickerLabel'
import DropdownLabel from '../components/DropdownLabel'
import CashPaymentsCard from '../components/dashboard/CashPaymentsCard'
import InvoiceSummaryKpiCard from '../components/dashboard/InvoiceSummaryKpiCard'
import OverviewKpiCard from '../components/dashboard/OverviewKpiCard'
import { ActivityListCard } from '../components/dashboard/activityCards'
import { InventoryListCard } from '../components/dashboard/inventoryCards'
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
} from '../shared/dashboardShell'
import { useSee } from '../shared/hooks/useSee'
import { generateBreadcrumbs } from '../shared/routes'
import { SEE } from '../shared/seeFlags'
import { pageContentMinHeight } from '../theme/layout'
import { datePickerStyles } from '../theme/styles'

const DashboardPage = () => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const breadCrumbItems = generateBreadcrumbs()
	const status = resolveDashboardShellStatus()
	const [dateFrom, setDateFrom] = useState(
		() => getDashboardDefaultDateRange().dateFrom,
	)
	const [dateTo, setDateTo] = useState(
		() => getDashboardDefaultDateRange().dateTo,
	)
	const [supplierId, setSupplierId] = useState('')
	const canSeeSupplier = canSee(SEE.supplier)
	const { data: suppliers = [], isLoading: isSuppliersLoading } =
		useGetSuppliersQuery({}, { skip: !canSeeSupplier })
	const supplierOptions = useMemo(
		() =>
			suppliers.map(supplier => ({
				value: supplier.supplierId,
				label: supplier.name,
			})),
		[suppliers],
	)
	const selectedSupplier = useMemo(
		() => supplierOptions.filter(option => option.value === supplierId),
		[supplierOptions, supplierId],
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
								<Flex
									align={{ base: 'stretch', sm: 'flex-end' }}
									justify="space-between"
									gap={3}
									flexWrap="wrap"
									mb={4}
								>
									<Heading
										as="h2"
										fontSize="1.125rem"
										fontWeight={700}
										color="gray.800"
										mb={0}
									>
										{t(`dashboard.sections.${sectionId}`)}
									</Heading>
									{sectionId === 'inventory' && canSeeSupplier ? (
										<Box minW="10rem" maxW="14rem" flex="1">
											<DropdownLabel
												isSingle
												isSearchable
												showClearOptions
												label={t('dashboard.inventory.supplier')}
												placeholder={t('dashboard.inventory.supplier')}
												options={supplierOptions}
												selectedOptions={selectedSupplier}
												onSelect={values => setSupplierId(values[0] ?? '')}
												isLoading={isSuppliersLoading}
											/>
										</Box>
									) : null}
								</Flex>
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
											if (kpiId === 'cashBalance') {
												return <CashPaymentsCard key={kpiId} />
											}

											if (kpiId === 'salesToday' || kpiId === 'profit') {
												return (
													<InvoiceSummaryKpiCard
														key={kpiId}
														kpiId={kpiId}
														dateFrom={dateFrom}
														dateTo={dateTo}
													/>
												)
											}

											return (
												<OverviewKpiCard
													key={kpiId}
													kpiId={kpiId}
													dateFrom={dateFrom}
													dateTo={dateTo}
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
											<InventoryListCard
												key={cardId}
												cardId={cardId}
												dateFrom={dateFrom}
												dateTo={dateTo}
												supplierId={
													cardId === 'bestSellerProducts' ||
													cardId === 'bestProfitProducts'
														? supplierId || undefined
														: undefined
												}
											/>
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
