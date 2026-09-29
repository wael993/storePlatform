import {
	Box,
	Button,
	Flex,
	Heading,
	HStack,
	Spinner,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	VStack,
} from '@chakra-ui/react'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import {
	useGetCashAccountLedgerQuery,
	useGetCurrencySettingsQuery,
} from '../api/apiStore'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import DatePickerLabel from '../components/common/DatePickerLabel'
import EmptyState from '../components/common/EmptyState'
import DropdownLabel from '../components/DropdownLabel'
import { BreadCrumbItem } from '../shared/globalEnums'
import { getDashboardDefaultDateRange } from '../shared/dashboardShell'
import { generateBreadcrumbs } from '../shared/routes'
import { formatNumber } from '../shared/utils'
import { pageContentMinHeight } from '../theme/layout'
import { datePickerStyles } from '../theme/styles'

const PAGE_SIZE = 50

const ACCOUNT_OPTIONS = [
	{ value: '', labelKey: 'dashboard.cashAccounts.historyFilters.allAccounts' },
	{ value: 'daily_cash', labelKey: 'dashboard.cashAccounts.dailyCash' },
	{ value: 'cash_reserve', labelKey: 'dashboard.cashAccounts.cashReserve' },
	{ value: 'online', labelKey: 'dashboard.cashAccounts.online' },
] as const

const MOVEMENT_OPTIONS = [
	{ value: '', labelKey: 'dashboard.cashAccounts.historyFilters.allTypes' },
	{ value: 'SALE', labelKey: 'dashboard.cashAccounts.movementTypes.SALE' },
	{
		value: 'PURCHASE',
		labelKey: 'dashboard.cashAccounts.movementTypes.PURCHASE',
	},
	{
		value: 'RECEIPT',
		labelKey: 'dashboard.cashAccounts.movementTypes.RECEIPT',
	},
	{
		value: 'PAYMENT',
		labelKey: 'dashboard.cashAccounts.movementTypes.PAYMENT',
	},
	{
		value: 'EXPENSE',
		labelKey: 'dashboard.cashAccounts.movementTypes.EXPENSE',
	},
	{
		value: 'TRANSFER',
		labelKey: 'dashboard.cashAccounts.movementTypes.TRANSFER',
	},
] as const

const ACCOUNT_LABEL_KEYS: Record<string, string> = {
	daily_cash: 'dashboard.cashAccounts.dailyCash',
	cash_reserve: 'dashboard.cashAccounts.cashReserve',
	online: 'dashboard.cashAccounts.online',
}

const REFERENCE_LABEL_KEYS: Record<string, string> = {
	selling_invoice: 'dashboard.cashAccounts.referenceTypes.selling_invoice',
	buying_invoice: 'dashboard.cashAccounts.referenceTypes.buying_invoice',
	daily_action: 'dashboard.cashAccounts.referenceTypes.daily_action',
	cash_transfer: 'dashboard.cashAccounts.referenceTypes.cash_transfer',
	opening_balance: 'dashboard.cashAccounts.referenceTypes.opening_balance',
	migration: 'dashboard.cashAccounts.referenceTypes.migration',
}

const defaultDateStrings = () => {
	const { dateFrom, dateTo } = getDashboardDefaultDateRange()
	return {
		dateFrom: dayjs(dateFrom).format('YYYY-MM-DD'),
		dateTo: dayjs(dateTo).format('YYYY-MM-DD'),
	}
}

const CashAccountHistoryPage = () => {
	const { t } = useTranslation()
	const [searchParams, setSearchParams] = useSearchParams()
	const breadCrumbItems = generateBreadcrumbs()
	const defaults = useMemo(() => defaultDateStrings(), [])

	const appliedAccountType = searchParams.get('accountType') ?? ''
	const appliedMovementType = searchParams.get('movementType') ?? ''
	const appliedDateFrom = searchParams.get('dateFrom') ?? defaults.dateFrom
	const appliedDateTo = searchParams.get('dateTo') ?? defaults.dateTo
	const page = Math.max(1, Number(searchParams.get('page')) || 1)

	const [draftAccountType, setDraftAccountType] = useState(appliedAccountType)
	const [draftMovementType, setDraftMovementType] =
		useState(appliedMovementType)
	const [draftDateFrom, setDraftDateFrom] = useState<Date>(() =>
		dayjs(appliedDateFrom).toDate(),
	)
	const [draftDateTo, setDraftDateTo] = useState<Date>(() =>
		dayjs(appliedDateTo).toDate(),
	)

	useEffect(() => {
		if (searchParams.get('dateFrom') && searchParams.get('dateTo')) return
		const next = new URLSearchParams(searchParams)
		if (!next.get('dateFrom')) next.set('dateFrom', defaults.dateFrom)
		if (!next.get('dateTo')) next.set('dateTo', defaults.dateTo)
		setSearchParams(next, { replace: true })
	}, [defaults.dateFrom, defaults.dateTo, searchParams, setSearchParams])

	const queryArgs = useMemo(
		() => ({
			...(appliedAccountType ? { accountType: appliedAccountType } : {}),
			...(appliedMovementType ? { movementType: appliedMovementType } : {}),
			dateFrom: appliedDateFrom,
			dateTo: appliedDateTo,
			page,
			limit: PAGE_SIZE,
		}),
		[
			appliedAccountType,
			appliedMovementType,
			appliedDateFrom,
			appliedDateTo,
			page,
		],
	)

	const { data, isLoading, isError, isFetching, refetch } =
		useGetCashAccountLedgerQuery(queryArgs)
	const { data: currencySettings } = useGetCurrencySettingsQuery(undefined, {
		refetchOnMountOrArgChange: false,
	})

	const currencyLabel =
		currencySettings?.primaryCurrency?.internalCode ||
		currencySettings?.primaryCurrency?.name ||
		''

	const applyFilters = () => {
		const next = new URLSearchParams()
		if (draftAccountType) next.set('accountType', draftAccountType)
		if (draftMovementType) next.set('movementType', draftMovementType)
		next.set('dateFrom', dayjs(draftDateFrom).format('YYYY-MM-DD'))
		next.set('dateTo', dayjs(draftDateTo).format('YYYY-MM-DD'))
		setSearchParams(next)
	}

	const setPage = (nextPage: number) => {
		const next = new URLSearchParams(searchParams)
		if (nextPage <= 1) next.delete('page')
		else next.set('page', String(nextPage))
		if (!next.get('dateFrom')) next.set('dateFrom', appliedDateFrom)
		if (!next.get('dateTo')) next.set('dateTo', appliedDateTo)
		setSearchParams(next)
	}

	const totalCount = data?.totalCount ?? 0
	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
	const entries = data?.entries ?? []

	const formatAmount = (amount: number) => {
		const formatted = formatNumber(Math.abs(amount)) ?? String(Math.abs(amount))
		const signed = amount < 0 ? `−${formatted}` : `+${formatted}`
		return currencyLabel ? `${signed} ${currencyLabel}` : signed
	}

	const formatReferenceDetail = (entry: {
		referenceType: string
		referenceLabel?: string
		referenceId: string
	}) => {
		if (!entry.referenceLabel) return entry.referenceId
		if (entry.referenceType === 'cash_transfer') {
			return t(ACCOUNT_LABEL_KEYS[entry.referenceLabel] ?? entry.referenceLabel)
		}
		return entry.referenceLabel
	}

	const accountOptions = ACCOUNT_OPTIONS.map(option => ({
		value: option.value,
		label: t(option.labelKey),
	}))
	const movementOptions = MOVEMENT_OPTIONS.map(option => ({
		value: option.value,
		label: t(option.labelKey),
	}))

	const selectedAccount =
		accountOptions.find(option => option.value === draftAccountType) ??
		accountOptions[0]
	const selectedMovement =
		movementOptions.find(option => option.value === draftMovementType) ??
		movementOptions[0]

	return (
		<Flex flexDir="column" pb={4} minH={pageContentMinHeight}>
			<Flex flexDir="column" px={4}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.CASH_ACCOUNT_HISTORY]}
				/>
			</Flex>
			<Heading
				fontSize="1.5rem"
				fontWeight={700}
				mt="0.4rem"
				px={{ base: 4, md: 8 }}
				mb={{ base: 4, md: 6 }}
			>
				{t('dashboard.cashAccounts.historyTitle')}
			</Heading>

			<Flex
				gap={3}
				flexWrap="wrap"
				align="flex-end"
				mb={4}
				px={{ base: 4, md: 8 }}
			>
				<Box minW="10rem" maxW="14rem" flex="1">
					<DropdownLabel
						label={t('dashboard.cashAccounts.historyFilters.account')}
						options={accountOptions}
						selectedOptions={[selectedAccount]}
						onSelect={values => setDraftAccountType(values[0] ?? '')}
						isSingle
						placeholder={t('dashboard.cashAccounts.historyFilters.account')}
					/>
				</Box>
				<Box minW="10rem" maxW="14rem" flex="1">
					<DropdownLabel
						label={t('dashboard.cashAccounts.historyFilters.movementType')}
						options={movementOptions}
						selectedOptions={[selectedMovement]}
						onSelect={values => setDraftMovementType(values[0] ?? '')}
						isSingle
						placeholder={t(
							'dashboard.cashAccounts.historyFilters.movementType',
						)}
					/>
				</Box>
				<Box maxW={{ base: '100%', sm: '12rem' }}>
					<DatePickerLabel
						label={t('common.from')}
						onChange={date => {
							if (date) setDraftDateFrom(date)
						}}
						defaultDate={draftDateFrom}
						maxDate={draftDateTo}
						styles={datePickerStyles}
						usePortal
					/>
				</Box>
				<Box maxW={{ base: '100%', sm: '12rem' }}>
					<DatePickerLabel
						label={t('common.to')}
						onChange={date => {
							if (date) setDraftDateTo(date)
						}}
						defaultDate={draftDateTo}
						minDate={draftDateFrom}
						styles={datePickerStyles}
						usePortal
					/>
				</Box>
				<Button
					size="sm"
					colorScheme="blue"
					onClick={applyFilters}
					alignSelf="flex-end"
					mb="0.15rem"
				>
					{t('dashboard.cashAccounts.historyFilters.apply')}
				</Button>
			</Flex>

			<Box px={{ base: 4, md: 8 }} flex="1">
				{isLoading || (isFetching && !data) ? (
					<Flex justify="center" py={16}>
						<Spinner />
					</Flex>
				) : isError ? (
					<VStack py={12} spacing={3}>
						<Text color="red.500">
							{t('dashboard.cashAccounts.historyError')}
						</Text>
						<Button size="sm" onClick={() => refetch()}>
							{t('common.retry')}
						</Button>
					</VStack>
				) : entries.length === 0 ? (
					<EmptyState
						title={t('dashboard.cashAccounts.historyEmpty')}
						description={t('dashboard.cashAccounts.historyEmptyHint')}
					/>
				) : (
					<>
						<Box
							overflowX="auto"
							border="1px solid"
							borderColor="gray.200"
							borderRadius="lg"
							bg="white"
						>
							<Table size="sm">
								<Thead bg="gray.50">
									<Tr>
										<Th>{t('dashboard.cashAccounts.historyColumns.date')}</Th>
										<Th>
											{t('dashboard.cashAccounts.historyColumns.account')}
										</Th>
										<Th>{t('dashboard.cashAccounts.historyColumns.type')}</Th>
										<Th isNumeric>
											{t('dashboard.cashAccounts.historyColumns.amount')}
										</Th>
										<Th>
											{t('dashboard.cashAccounts.historyColumns.reference')}
										</Th>
										<Th>{t('dashboard.cashAccounts.historyColumns.reason')}</Th>
										<Th>{t('dashboard.cashAccounts.historyColumns.by')}</Th>
									</Tr>
								</Thead>
								<Tbody>
									{entries.map(entry => (
										<Tr key={entry.ledgerEntryId}>
											<Td whiteSpace="nowrap">
												{dayjs(entry.createdAt).format('YYYY-MM-DD HH:mm')}
											</Td>
											<Td>
												{t(
													ACCOUNT_LABEL_KEYS[entry.accountType] ??
														entry.accountType,
												)}
											</Td>
											<Td>
												{t(
													`dashboard.cashAccounts.movementTypes.${entry.movementType}`,
													{ defaultValue: entry.movementType },
												)}
											</Td>
											<Td
												isNumeric
												color={entry.amount < 0 ? 'red.600' : 'green.700'}
												fontWeight={600}
											>
												{formatAmount(entry.amount)}
											</Td>
											<Td>
												<Text fontSize="sm">
													{t(
														REFERENCE_LABEL_KEYS[entry.referenceType] ??
															entry.referenceType,
													)}
												</Text>
												<Text fontSize="xs" color="gray.500">
													{formatReferenceDetail(entry)}
												</Text>
											</Td>
											<Td>{entry.reason || '—'}</Td>
											<Td>{entry.createdBy?.displayName || '—'}</Td>
										</Tr>
									))}
								</Tbody>
							</Table>
						</Box>

						<HStack justify="space-between" mt={4} flexWrap="wrap" gap={2}>
							<Text fontSize="sm" color="gray.600">
								{t('dashboard.cashAccounts.historyPagination', {
									from: (page - 1) * PAGE_SIZE + 1,
									to: Math.min(page * PAGE_SIZE, totalCount),
									total: totalCount,
								})}
							</Text>
							<HStack>
								<Button
									size="sm"
									variant="outline"
									isDisabled={page <= 1}
									onClick={() => setPage(page - 1)}
								>
									{t('pagination.previous')}
								</Button>
								<Text fontSize="sm">
									{page} / {totalPages}
								</Text>
								<Button
									size="sm"
									variant="outline"
									isDisabled={page >= totalPages}
									onClick={() => setPage(page + 1)}
								>
									{t('pagination.next')}
								</Button>
							</HStack>
						</HStack>
					</>
				)}
			</Box>
		</Flex>
	)
}

export default CashAccountHistoryPage
