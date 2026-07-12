import {
	Box,
	Button,
	Flex,
	Heading,
	HStack,
	Spinner,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	BreadCrumbItem,
	AllowedActions,
	TargetType,
	DailyActionType,
} from '../../shared/globalEnums'
import { ENTRY_TYPE_LABELS_MAP } from '../../shared/globalConstant'
import { useResources } from '../../shared/hooks/useResources'
import { useUser } from '../../shared/hooks/useUser'
import { generateBreadcrumbs } from '../../shared/routes'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import CustomBreadcrumb from '../CustomBreadcrumb'
import Filters from '../filters/Filters'
import { FilterSelectOption, ProductFilterValues } from '../filters/FilterModal'
import { AddSquareIcon } from '../icons/AddSquare'
import AddDailyActionModal from '../modals/DailyAction/AddDailyActionModal'
import DailyActionsListWithActionBar from '../daily/list/DailyActionsListWithActionBar'
import {
	useGetDailyActionFilterValuesQuery,
	useGetDailyActionsQuery,
} from '../../api/apiStore'
import { ExcelDownload } from '../ExcelDownload'
import { BudgetOverview } from '../common/BudgetOverview'
import { compareBreakpoint, mapFee } from '../../shared/utils'
import { useBreakpoints } from '../../shared/hooks/useBreakpoints'

const fullWidth = '100%'

const CASH_BALANCE_TABLE_ENTRY_TYPES = [
	DailyActionType.PAYMENT_ENTRY,
	DailyActionType.RECEIPT_ENTRY,
	DailyActionType.EXPENSE_ENTRY,
	DailyActionType.SELLING_ENTRY,
] as const

const getDateInputValueFromDate = (date: Date) => {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')

	return `${year}-${month}-${day}`
}

const getDefaultCashBalanceFilters = (): ProductFilterValues => {
	const today = new Date()
	const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
	const endOfCurrentMonth = new Date(
		today.getFullYear(),
		today.getMonth() + 1,
		0,
	)

	return {
		searchText: '',
		supplier: [],
		brand: [],
		state: [],
		category: [],
		entryType: [],
		productName: [],
		customer: [],
		invoiceDateFrom: getDateInputValueFromDate(startOfCurrentMonth),
		invoiceDateTo: getDateInputValueFromDate(endOfCurrentMonth),
	}
}

const getEffectiveCashBalanceFilters = (
	filters: ProductFilterValues,
): ProductFilterValues => {
	const allowedTypes = CASH_BALANCE_TABLE_ENTRY_TYPES as unknown as string[]
	const userTypes = filters.entryType ?? []
	const entryType =
		userTypes.length > 0
			? userTypes.filter(type => allowedTypes.includes(type))
			: [...allowedTypes]

	return { ...filters, entryType }
}

const getEntryTypeValue = (entryType: DailyAction['entryType']) => {
	if (!entryType) return undefined
	if (typeof entryType === 'string') return entryType
	return entryType.value
}

const parseDailyActionAmount = (dailyAction: DailyAction) => {
	const entryTypeValue = getEntryTypeValue(dailyAction.entryType)
	const isAmountOnlyAction =
		entryTypeValue === DailyActionType.PAYMENT_ENTRY ||
		entryTypeValue === DailyActionType.RECEIPT_ENTRY ||
		entryTypeValue === DailyActionType.EXPENSE_ENTRY
	const rawAmount = isAmountOnlyAction
		? (dailyAction.singleUnitPrice ?? dailyAction.totalPrice ?? '0')
		: (dailyAction.totalPrice ?? dailyAction.singleUnitPrice ?? '0')
	const amount = parseFloat(rawAmount.replace(/,/g, ''))

	return Number.isFinite(amount) ? amount : 0
}

const styles = {
	wrapper: {
		width: fullWidth,
		flexDir: 'column',
		paddingBottom: '1rem',
	},
	header: {
		flexDir: 'column',
		width: fullWidth,
		paddingX: { base: 0, md: '1rem' },
	},
	title: {
		fontSize: { base: 'xl', md: '1.5rem' },
		fontWeight: 700,
		marginTop: { base: 0, md: '0.4rem' },
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		display: 'block',
		whiteSpace: { base: 'normal', md: 'nowrap' },
		paddingX: { base: 0, md: '1rem' },
	},
	mobileSummaryCard: {
		width: '100%',
		bg: 'white',
		borderRadius: 'xl',
		border: '1px solid',
		borderColor: 'gray.100',
		p: 4,
		mb: 4,
		boxShadow: 'sm',
	},
	cashBalanceRow: {
		justifyContent: 'space-between',
		alignItems: 'center',
		pt: 3,
		mt: 1,
		borderTop: '1px solid',
		borderColor: 'gray.100',
	},
	cashBalanceLabel: {
		fontSize: 'sm',
		fontWeight: 600,
		color: 'gray.600',
	},
	cashBalanceValue: {
		fontSize: 'md',
		fontWeight: 700,
		color: 'gray.900',
	},
	actionsRow: {
		width: { base: '100%', md: 'auto' },
		justifyContent: { base: 'flex-end', md: 'flex-end' },
		flexWrap: 'wrap',
		gap: 2,
	},
	divider: {
		borderBottom: '1px solid #EAEAEA}',
		marginTop: '1px',
		marginRight: {
			base: '0',
			md: '0.5rem',
			xl: '0.5rem',
		},
	},
	addProductButton: {
		...hoverFocusActiveButtonStyles,
		gap: '0.25rem',
	},
	addProductButtonText: {
		fontSize: '0.875rem',
		fontWeight: 700,
		color: '#1E1E1E',
	},
} satisfies StylesObject

const CashBalancePage = () => {
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const { isActionAllowed } = useResources()
	const { isOwnerOrAdmin, isAdmin } = useUser()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const [cashBalanceFilters, setCashBalanceFilters] =
		useState<ProductFilterValues>(getDefaultCashBalanceFilters)
	const { isMobile } = compareBreakpoint(useBreakpoints())

	const effectiveFilters = useMemo(
		() => getEffectiveCashBalanceFilters(cashBalanceFilters),
		[cashBalanceFilters],
	)

	const { data: dailyActions = [], isLoading: isDailyActionsLoading } =
		useGetDailyActionsQuery(effectiveFilters)
	const { data: dailyFilterValues } = useGetDailyActionFilterValuesQuery()

	const cashBalanceOverview = useMemo(() => {
		const totals = dailyActions.reduce(
			(accumulator, dailyAction) => {
				const amount = parseDailyActionAmount(dailyAction)
				const entryTypeValue = getEntryTypeValue(dailyAction.entryType)

				if (entryTypeValue === DailyActionType.SELLING_ENTRY) {
					accumulator.sales += amount
				}

				if (entryTypeValue === DailyActionType.EXPENSE_ENTRY) {
					accumulator.expenses += amount
				}

				if (entryTypeValue === DailyActionType.RECEIPT_ENTRY) {
					accumulator.receipts += amount
				}

				if (entryTypeValue === DailyActionType.PAYMENT_ENTRY) {
					accumulator.payments += amount
				}

				return accumulator
			},
			{ sales: 0, expenses: 0, receipts: 0, payments: 0 },
		)

		const currency =
			dailyActions.find(dailyAction => dailyAction.currencyName)
				?.currencyName ??
			dailyActions.find(dailyAction => dailyAction.currencyId)?.currencyId ??
			'N.SYP'

		return {
			expenses: totals.expenses.toFixed(2),
			receipts: totals.receipts.toFixed(2),
			payments: totals.payments.toFixed(2),
			sales: totals.sales.toFixed(2),
			cashBalance: (
				totals.receipts -
				totals.payments -
				totals.expenses
			).toFixed(2),
			currency,
		}
	}, [dailyActions])

	const budgetOverviewLabels = useMemo(
		() => ({
			tooltip: t('components.cashBalance.budgetOverview.tooltip'),
			title: t('components.cashBalance.budgetOverview.title'),
			purchase: t('components.cashBalance.budgetOverview.receipts'),
			payments: t('components.cashBalance.budgetOverview.payments'),
			balance: t('components.cashBalance.budgetOverview.expenses'),
		}),
		[t],
	)

	const entryTypeOptions: FilterSelectOption[] = useMemo(() => {
		const allowedTypes = new Set(
			CASH_BALANCE_TABLE_ENTRY_TYPES as unknown as string[],
		)

		return (dailyFilterValues?.entryType ?? [])
			.filter(option => allowedTypes.has(option.value))
			.map(option => {
				const translationKey = ENTRY_TYPE_LABELS_MAP[option.value]
				return {
					...option,
					label: translationKey ? t(translationKey) : option.label,
				}
			})
	}, [dailyFilterValues?.entryType, t])

	const handleApplyFilters = (filters: ProductFilterValues) => {
		setCashBalanceFilters(filters)
	}

	const handleResetFilters = () => {
		setCashBalanceFilters(getDefaultCashBalanceFilters())
	}

	return (
		<Flex sx={styles.wrapper}>
			{!isMobile && (
				<Flex sx={styles.header}>
					<CustomBreadcrumb
						marginTop="2rem"
						items={breadCrumbItems[BreadCrumbItem.CASH_BALANCE]}
					/>
				</Flex>
			)}

			<Flex
				direction={{ base: 'column', md: 'row' }}
				justify="space-between"
				align={{ base: 'stretch', md: 'center' }}
				gap={{ base: 3, md: 0 }}
				mb={{ base: 4, md: '4rem' }}
			>
				<Heading sx={styles.title} variant="h5">
					{t('components.pageHeaders.cashBalance')}
				</Heading>
				{isOwnerOrAdmin && (
					<HStack sx={styles.actionsRow}>
						{!isMobile &&
							isActionAllowed(AllowedActions.CAN_SEE_BUDGET_OVERVIEW) && (
								<BudgetOverview
									purchase={cashBalanceOverview.receipts}
									payments={cashBalanceOverview.payments}
									balance={cashBalanceOverview.expenses}
									currency={cashBalanceOverview.currency}
									isFetching={isDailyActionsLoading}
									labels={budgetOverviewLabels}
								/>
							)}

						{isAdmin &&
							isActionAllowed(AllowedActions.CAN_EDIT_CASH_BALANCE) && (
								<Button
									leftIcon={<AddSquareIcon />}
									onClick={onOpen}
									sx={styles.addProductButton}
									variant="ghost"
									size={isMobile ? 'sm' : 'md'}
								>
									<Text sx={styles.addProductButtonText}>
										{t('common.addDailyAction')}
									</Text>
								</Button>
							)}
						<ExcelDownload
							targetType={TargetType.DAILY_ACTION}
							queryParams={effectiveFilters}
						/>
					</HStack>
				)}
			</Flex>

			{isMobile && (
				<Box sx={styles.mobileSummaryCard}>
					<BudgetOverview
						purchase={cashBalanceOverview.receipts}
						payments={cashBalanceOverview.payments}
						balance={cashBalanceOverview.expenses}
						currency={cashBalanceOverview.currency}
						isFetching={isDailyActionsLoading}
						labels={budgetOverviewLabels}
					/>
					<Flex sx={styles.cashBalanceRow}>
						<Text sx={styles.cashBalanceLabel}>
							{t('components.cashBalance.cashBalance')}
						</Text>
						<Text sx={styles.cashBalanceValue}>
							{mapFee(cashBalanceOverview.cashBalance) ?? '0'}{' '}
							{cashBalanceOverview.currency}
						</Text>
					</Flex>
				</Box>
			)}

			{!isMobile && (
				<>
					{isDailyActionsLoading && <Spinner />}
					<Box sx={styles.divider} />
					<HStack>
						<Text sx={styles.title}>
							{t('components.cashBalance.cashBalance')}:
						</Text>
						<Text sx={styles.title}>
							{mapFee(cashBalanceOverview.cashBalance) ?? '0'}{' '}
							{cashBalanceOverview.currency}
						</Text>
					</HStack>
					<Box sx={styles.divider} />
				</>
			)}

			{isMobile && isDailyActionsLoading && (
				<Flex justify="center" py={2} mb={2}>
					<Spinner size="sm" />
				</Flex>
			)}

			<Filters
				filters={cashBalanceFilters}
				onApplyFilters={handleApplyFilters}
				onResetFilters={handleResetFilters}
				supplierOptions={dailyFilterValues?.supplier ?? []}
				brandOptions={[]}
				stateOptions={[]}
				categoryOptions={[]}
				entryTypeOptions={entryTypeOptions}
				productNameOptions={dailyFilterValues?.productName ?? []}
				customerOptions={dailyFilterValues?.customer ?? []}
				showSupplierFilter={true}
				searchPlaceholder={t('components.filters.dailySearchPlaceholder')}
				fieldVisibility={{
					entryType: true,
					productName: true,
					supplier: true,
					customer: true,
					invoiceDate: true,
					brand: false,
					state: false,
					category: false,
				}}
			/>

			<DailyActionsListWithActionBar
				dailyActions={dailyActions}
				isLoading={isDailyActionsLoading}
			/>

			<AddDailyActionModal
				isOpen={isOpen}
				onClose={onClose}
				targetType={TargetType.CASH_BALANCE}
			/>
		</Flex>
	)
}

export default CashBalancePage
