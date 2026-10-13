import { Box, Flex, Text } from '@chakra-ui/react'
import { useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FiCreditCard, FiShield } from 'react-icons/fi'
import type { IconProps } from '@chakra-ui/react'

import {
	useGetCashAccountBalancesQuery,
	useGetCurrencySettingsQuery,
} from '../../api/apiStore'
import { CashBalanceIcon } from '../../icons/CashBalance'
import { WalletIcon } from '../../icons/Wallet'
import { getWorkMode } from '../../offline/workMode'
import { RoutePaths } from '../../shared/routes'
import { useOfflineSync } from '../../shared/hooks/useOfflineSync'
import { useSee } from '../../shared/hooks/useSee'
import { useUser } from '../../shared/hooks/useUser'
import { SEE } from '../../shared/seeFlags'
import {
	CashCurrencyBalanceList,
	CashCurrencyExpandButton,
	cashCurrencyLines,
	type CashCurrencyLine,
} from './cashCurrencyBalances'

/** Soft icon tint only — cards stay white like Coming Soon. */
const ICON_TONES: Record<string, { bg: string; color: string }> = {
	daily_cash: { bg: '#ECFDF5', color: '#059669' },
	cash_reserve: { bg: '#FFFBEB', color: '#D97706' },
	online: { bg: '#EFF6FF', color: '#2563EB' },
	total: { bg: '#F0FDFA', color: '#0D9488' },
}

const ACCOUNT_ORDER = ['daily_cash', 'cash_reserve', 'online'] as const

const ACCOUNT_SEE: Record<(typeof ACCOUNT_ORDER)[number] | 'total', string> = {
	daily_cash: SEE.dashboardDailyCash,
	cash_reserve: SEE.dashboardCashReserve,
	online: SEE.dashboardOnline,
	total: SEE.dashboardCashTotal,
}

const ACCOUNT_CLICK_SEE: Record<
	(typeof ACCOUNT_ORDER)[number] | 'total',
	string
> = {
	daily_cash: SEE.dashboardDailyCashClick,
	cash_reserve: SEE.dashboardCashReserveClick,
	online: SEE.dashboardOnlineClick,
	total: SEE.dashboardCashTotalClick,
}

const ACCOUNT_LABEL_KEYS: Record<string, string> = {
	daily_cash: 'dashboard.cashAccounts.dailyCash',
	cash_reserve: 'dashboard.cashAccounts.cashReserve',
	online: 'dashboard.cashAccounts.online',
	total: 'dashboard.cashAccounts.total',
}

const ACCOUNT_ICONS: Record<string, ComponentType<IconProps>> = {
	daily_cash: CashBalanceIcon,
	cash_reserve: WalletIcon,
	online: FiCreditCard as ComponentType<IconProps>,
	total: FiShield as ComponentType<IconProps>,
}

/** Same shell as KpiCardComingSoon — white, quiet; live signal is chip + icon tint. */
const cardStyles = {
	card: {
		position: 'relative',
		bg: 'white',
		border: '1px solid',
		borderColor: 'gray.200',
		borderRadius: '2xl',
		minW: 0,
		minH: { base: '9rem', md: '10rem' },
		h: '100%',
		px: { base: 4, sm: 5, lg: 4 },
		py: { base: 4, sm: 5, lg: 4 },
		boxShadow: '0 8px 30px rgba(15, 23, 42, 0.06)',
	},
	liveChip: {
		display: 'inline-flex',
		alignItems: 'center',
		px: 2,
		py: '0.15rem',
		borderRadius: 'full',
		bg: 'green.50',
		color: 'green.700',
		fontSize: { base: '0.65rem', lg: '0.6rem' },
		fontWeight: 700,
		letterSpacing: '0.04em',
		textTransform: 'uppercase',
		border: '1px solid',
		borderColor: 'green.100',
	},
	iconWrap: {
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		w: { base: 12, sm: 14, lg: 10 },
		h: { base: 12, sm: 14, lg: 10 },
		borderRadius: 'full',
	},
	divider: {
		alignSelf: 'stretch',
		w: '1px',
		my: { base: 2, lg: 1 },
		mx: { base: 3, sm: 4, lg: 2.5 },
		bg: 'gray.200',
		flexShrink: 0,
	},
	title: {
		fontSize: { base: 'md', sm: 'lg', lg: 'sm' },
		fontWeight: 600,
		color: 'gray.800',
		lineHeight: '1.2',
	},
	value: {
		mt: { base: 4, lg: 3 },
		fontSize: { base: 'xl', sm: '2xl', lg: 'xl' },
		fontWeight: 800,
		color: 'gray.900',
		lineHeight: '1',
	},
} satisfies StylesObject

const iconBoxSize = { base: '1.75rem', sm: '2rem', lg: '1.35rem' } as const

type CashKpiCardProps = {
	cardKey: string
	title: string
	value: ReactNode
	lines?: CashCurrencyLine[]
	isLoading?: boolean
	isError?: boolean
	onOpen?: () => void
}

export const CashKpiCard = ({
	cardKey,
	title,
	value,
	lines,
	isLoading,
	isError,
	onOpen,
}: CashKpiCardProps) => {
	const { t } = useTranslation()
	const [expanded, setExpanded] = useState(false)
	const Icon = ACCOUNT_ICONS[cardKey] ?? CashBalanceIcon
	const tone = ICON_TONES[cardKey] ?? ICON_TONES.daily_cash
	const showLines = !isLoading && !isError && (lines?.length ?? 0) > 0
	const canExpand = showLines && (lines?.length ?? 0) > 2

	return (
		<Box
			sx={cardStyles.card}
			_hover={
				onOpen
					? {
							borderColor: 'gray.300',
							boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
						}
					: undefined
			}
		>
			{canExpand ? (
				<CashCurrencyExpandButton
					expanded={expanded}
					onToggle={() => setExpanded(open => !open)}
				/>
			) : null}
			<Flex
				position="relative"
				align="center"
				h="100%"
				minH={{ base: '6.5rem', lg: '5.5rem' }}
				zIndex={1}
				role={onOpen ? 'button' : undefined}
				tabIndex={onOpen ? 0 : undefined}
				onClick={onOpen}
				onKeyDown={
					onOpen
						? event => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault()
									onOpen()
								}
							}
						: undefined
				}
				cursor={onOpen ? 'pointer' : undefined}
				_focusVisible={
					onOpen
						? {
								outline: '2px solid',
								outlineColor: 'blue.400',
								outlineOffset: '2px',
							}
						: undefined
				}
			>
				<Flex
					sx={{
						...cardStyles.iconWrap,
						bg: tone.bg,
						color: tone.color,
					}}
				>
					<Icon boxSize={iconBoxSize} aria-hidden />
				</Flex>
				<Box sx={cardStyles.divider} />

				<Box
					flex="1"
					minW={0}
					pr={canExpand ? { base: 8, lg: 6 } : { base: 2, lg: 1 }}
				>
					<Flex align="center" gap={2} flexWrap="wrap" mb={0.5}>
						<Text sx={cardStyles.title} noOfLines={2}>
							{title}
						</Text>
						<Text as="span" sx={cardStyles.liveChip}>
							{t('dashboard.cashAccounts.live')}
						</Text>
					</Flex>
					{showLines && lines ? (
						<CashCurrencyBalanceList lines={lines} expanded={expanded} />
					) : (
						<Text sx={cardStyles.value}>
							{isLoading
								? t('dashboard.kpi.loading')
								: isError
									? t('dashboard.kpi.error')
									: value}
						</Text>
					)}
				</Box>
			</Flex>
		</Box>
	)
}

/** Four live cash KPI cards — Coming Soon shell, unlocked as live. */
const CashPaymentsCard = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { canSee } = useSee()
	const { user } = useUser()
	const { isOnline } = useOfflineSync(user?.tenantId)
	const cashOpsOnline = isOnline && getWorkMode() !== 'offline'
	const visibleAccounts = ACCOUNT_ORDER.filter(type =>
		canSee(ACCOUNT_SEE[type]),
	)
	const showTotal = canSee(ACCOUNT_SEE.total)
	const showAnyCash = visibleAccounts.length > 0 || showTotal
	const { data, isLoading, isError, isFetching } =
		useGetCashAccountBalancesQuery(undefined, {
			skip: !showAnyCash,
		})
	const { data: currencySettings } = useGetCurrencySettingsQuery(undefined, {
		skip: !showAnyCash,
		refetchOnMountOrArgChange: false,
	})

	const openHistory = (accountType?: string) => {
		const params = accountType
			? `?accountType=${encodeURIComponent(accountType)}`
			: ''
		navigate(`${RoutePaths.CASH_ACCOUNT_HISTORY}${params}`)
	}

	const showLoading = isLoading || (isFetching && !data)
	const balancesByType = new Map(
		(data?.accounts ?? []).map(account => [account.type, account.balances]),
	)

	const linesFor = (balances: Record<string, number> | undefined) => {
		if (showLoading || isError || !balances) return undefined
		const lines = cashCurrencyLines(currencySettings, balances)
		return lines.length > 0 ? lines : undefined
	}

	if (!showAnyCash) return null

	return (
		<>
			{visibleAccounts.map(type => (
				<CashKpiCard
					key={type}
					cardKey={type}
					title={t(ACCOUNT_LABEL_KEYS[type])}
					value="—"
					lines={linesFor(balancesByType.get(type))}
					isLoading={showLoading}
					isError={isError}
					onOpen={
						cashOpsOnline && canSee(ACCOUNT_CLICK_SEE[type])
							? () => openHistory(type)
							: undefined
					}
				/>
			))}
			{showTotal ? (
				<CashKpiCard
					key="total"
					cardKey="total"
					title={t(ACCOUNT_LABEL_KEYS.total)}
					value="—"
					lines={linesFor(data?.totals)}
					isLoading={showLoading}
					isError={isError}
					onOpen={
						cashOpsOnline && canSee(ACCOUNT_CLICK_SEE.total)
							? () => openHistory()
							: undefined
					}
				/>
			) : null}
		</>
	)
}

export default CashPaymentsCard
