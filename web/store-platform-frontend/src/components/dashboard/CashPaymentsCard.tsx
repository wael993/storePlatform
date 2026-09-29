import { Box, Flex, Text } from '@chakra-ui/react'
import type { ComponentType, ReactNode } from 'react'
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
import { formatNumber } from '../../shared/utils'

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

const ACCOUNT_CLICK_SEE: Record<(typeof ACCOUNT_ORDER)[number] | 'total', string> =
	{
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
		overflow: 'hidden',
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
	description: {
		mt: 1.5,
		fontSize: { base: 'sm', lg: 'xs' },
		color: 'gray.500',
		lineHeight: '1.4',
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
	isLoading?: boolean
	isError?: boolean
	onOpen?: () => void
}

const CashKpiCard = ({
	cardKey,
	title,
	value,
	isLoading,
	isError,
	onOpen,
}: CashKpiCardProps) => {
	const { t } = useTranslation()
	const Icon = ACCOUNT_ICONS[cardKey] ?? CashBalanceIcon
	const tone = ICON_TONES[cardKey] ?? ICON_TONES.daily_cash

	return (
		<Box
			sx={cardStyles.card}
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
			_hover={
				onOpen
					? {
							borderColor: 'gray.300',
							boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
						}
					: undefined
			}
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
			{/* Quiet decoration — same language as Coming Soon, not painted fills. */}
			<Box
				position="absolute"
				inset={0}
				pointerEvents="none"
				aria-hidden
				opacity={0.5}
			>
				<Box
					position="absolute"
					top={6}
					left={6}
					w={{ base: '7rem', lg: '4.5rem' }}
					h={{ base: '5rem', lg: '3.5rem' }}
					opacity={0.35}
					bgImage="radial-gradient(circle, #CBD5E0 1.5px, transparent 1.5px)"
					bgSize="1.25rem 1.25rem"
				/>
				<Box
					position="absolute"
					right="-5rem"
					bottom="-5rem"
					w={{ base: '18rem', lg: '12rem' }}
					h={{ base: '10rem', lg: '7rem' }}
					borderRadius="50%"
					bg="gray.50"
					transform="rotate(-12deg)"
				/>
			</Box>

			<Flex
				position="relative"
				align="center"
				h="100%"
				minH={{ base: '6.5rem', lg: '5.5rem' }}
				zIndex={1}
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

				<Box flex="1" minW={0} pr={{ base: 2, lg: 1 }}>
					<Flex align="center" gap={2} flexWrap="wrap" mb={0.5}>
						<Text sx={cardStyles.title} noOfLines={2}>
							{title}
						</Text>
						<Text as="span" sx={cardStyles.liveChip}>
							{t('dashboard.cashAccounts.live')}
						</Text>
					</Flex>
					<Text sx={cardStyles.description} noOfLines={2}></Text>
					<Text sx={cardStyles.value}>
						{isLoading
							? t('dashboard.kpi.loading')
							: isError
								? t('dashboard.kpi.error')
								: value}
					</Text>
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
			skip: !cashOpsOnline || !showAnyCash,
		})
	const { data: currencySettings } = useGetCurrencySettingsQuery(undefined, {
		skip: !cashOpsOnline || !showAnyCash,
		refetchOnMountOrArgChange: false,
	})

	const currencyLabel =
		currencySettings?.primaryCurrency?.internalCode ||
		currencySettings?.primaryCurrency?.name ||
		''

	const formatBalance = (amount: number | undefined) => {
		if (!cashOpsOnline) return t('common.onlineOnly')
		if (amount == null) return '—'
		const formatted = formatNumber(amount) ?? String(amount)

		return currencyLabel ? `${formatted} ${currencyLabel}` : formatted
	}

	const openHistory = (accountType?: string) => {
		const params = accountType
			? `?accountType=${encodeURIComponent(accountType)}`
			: ''
		navigate(`${RoutePaths.CASH_ACCOUNT_HISTORY}${params}`)
	}

	const showLoading = cashOpsOnline && (isLoading || (isFetching && !data))
	const balanceByType = new Map(
		(data?.accounts ?? []).map(account => [account.type, account.balance]),
	)

	if (!showAnyCash) return null

	return (
		<>
			{visibleAccounts.map(type => (
				<CashKpiCard
					key={type}
					cardKey={type}
					title={t(ACCOUNT_LABEL_KEYS[type])}
					value={formatBalance(balanceByType.get(type))}
					isLoading={showLoading}
					isError={cashOpsOnline && isError}
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
					value={formatBalance(data?.total)}
					isLoading={showLoading}
					isError={cashOpsOnline && isError}
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
