import { Box, Flex, Text } from '@chakra-ui/react'
import type { ComponentType } from 'react'
import type { IconProps } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { InventoryCardId } from '../../shared/dashboardShell'
import { PriceTagIcon } from '../../shared/icons/PriceTag'
import { StarIcon } from '../../shared/icons/Star'
import { TimeIcon } from '../../shared/icons/Time'
import { WarningIcon } from '../../shared/icons/Warning'
import { KpiHint } from './kpiComponents'
import { useInvoiceSummaryKpis } from './useInvoiceSummaryKpis'

const cardStyles = {
	card: {
		position: 'relative',
		overflow: 'hidden',
		bg: 'white',
		border: '1px solid',
		borderColor: 'gray.200',
		borderRadius: '2xl',
		minW: 0,
		h: '100%',
		display: 'flex',
		flexDir: 'column',
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
	header: {
		alignItems: 'center',
		gap: 3,
		mb: 4,
		pr: 10,
	},
	iconWrap: {
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		w: 10,
		h: 10,
		borderRadius: 'full',
		bg: 'gray.50',
		color: 'gray.400',
	},
	title: {
		fontSize: { base: 'md', sm: 'lg' },
		fontWeight: 600,
		color: 'gray.500',
		lineHeight: '1.2',
	},
	row: {
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 3,
		py: 2.5,
		borderBottom: '1px solid',
		borderColor: 'gray.100',
		_last: { borderBottom: 'none' },
	},
	rowLabel: {
		fontSize: 'sm',
		color: 'gray.600',
		fontWeight: 500,
	},
	rowValue: {
		fontSize: 'sm',
		color: 'gray.400',
		fontWeight: 700,
		flexShrink: 0,
	},
} satisfies StylesObject

const CARD_ICONS: Record<InventoryCardId, ComponentType<IconProps>> = {
	inventoryWarnings: WarningIcon,
	bestProfitProducts: PriceTagIcon,
	bestSellerProducts: StarIcon,
}

const WARNING_KEYS = [
	'lowStock',
	'outOfStock',
	'expiringSoon',
	'wrongSellingPrice',
	'wrongCostPrice',
] as const
const WARNING_COUNTS = ['12', '3', '5', '10', '15'] as const

const LIVE_PRODUCT_CARDS = ['bestProfitProducts', 'bestSellerProducts'] as const

type LiveProductCardId = (typeof LIVE_PRODUCT_CARDS)[number]

const LIVE_ICON_TONES: Record<
	LiveProductCardId,
	{ bg: string; color: string }
> = {
	bestSellerProducts: { bg: '#FEF3C7', color: '#B45309' },
	bestProfitProducts: { bg: '#EDE9FE', color: '#6D28D9' },
}

const STATUS_KEYS = {
	loading: 'dashboard.kpi.loading',
	offline: 'common.onlineOnly',
	unavailable: 'dashboard.kpi.unavailable',
	error: 'dashboard.kpi.error',
} as const

interface InventoryListCardProps {
	cardId: InventoryCardId
	dateFrom: Date
	dateTo: Date
}

const LiveProductCard = ({
	cardId,
	dateFrom,
	dateTo,
}: {
	cardId: LiveProductCardId
	dateFrom: Date
	dateTo: Date
}) => {
	const { t } = useTranslation()
	const { status, kpis, formatMoney } = useInvoiceSummaryKpis(dateFrom, dateTo)
	const Icon = CARD_ICONS[cardId]
	const tone = LIVE_ICON_TONES[cardId]
	const ranked =
		cardId === 'bestSellerProducts'
			? (kpis?.bestSellers ?? []).map(product => ({
					name: product.productName,
					value: t('dashboard.inventory.soldCount', {
						count: product.quantity,
					}),
				}))
			: (kpis?.topProfitProducts ?? []).map(product => ({
					name: product.productName,
					value: formatMoney(product.profit),
				}))
	const rows =
		status === 'ready'
			? ranked.length
				? ranked
				: [{ name: '—', value: '—' }]
			: [{ name: '—', value: t(STATUS_KEYS[status]) }]

	return (
		<Box sx={cardStyles.card}>
			<KpiHint label={t(`dashboard.kpi.hints.${cardId}`)} side="start" />
			<Flex sx={{ ...cardStyles.header, pr: 0, pe: 6 }}>
				<Flex
					sx={{
						...cardStyles.iconWrap,
						bg: tone.bg,
						color: tone.color,
					}}
				>
					<Icon boxSize="1.25rem" aria-hidden />
				</Flex>
				<Text sx={{ ...cardStyles.title, color: 'gray.800' }} noOfLines={2}>
					{t(`dashboard.inventory.cards.${cardId}`)}
				</Text>
			</Flex>
			<Box flex="1">
				{rows.map((row, index) => (
					<Flex key={`${cardId}-${index}`} sx={cardStyles.row}>
						<Text
							sx={{ ...cardStyles.rowLabel, color: 'gray.800' }}
							noOfLines={1}
						>
							{row.name}
						</Text>
						<Text sx={{ ...cardStyles.rowValue, color: 'gray.900' }}>
							{row.value}
						</Text>
					</Flex>
				))}
			</Box>
		</Box>
	)
}

export const InventoryListCard = ({
	cardId,
	dateFrom,
	dateTo,
}: InventoryListCardProps) => {
	if (cardId === 'bestSellerProducts' || cardId === 'bestProfitProducts') {
		return (
			<LiveProductCard cardId={cardId} dateFrom={dateFrom} dateTo={dateTo} />
		)
	}

	return <ComingSoonInventoryCard cardId={cardId} />
}

const ComingSoonInventoryCard = ({ cardId }: { cardId: InventoryCardId }) => {
	const { t } = useTranslation()
	const Icon = CARD_ICONS[cardId]
	const rows = WARNING_KEYS.map((key, index) => ({
		label: t(`dashboard.inventory.warnings.${key}`),
		value: WARNING_COUNTS[index],
	}))

	return (
		<Box sx={cardStyles.card}>
			<KpiHint label={t('dashboard.kpi.comingSoonDescription')} side="start" />
			<Box sx={cardStyles.ribbon}>
				<Flex sx={cardStyles.ribbonLabel}>
					<TimeIcon boxSize={{ base: '0.8rem', lg: '0.65rem' }} />
					{t('dashboard.kpi.comingSoon')}
				</Flex>
			</Box>

			<Flex sx={cardStyles.header}>
				<Flex sx={cardStyles.iconWrap}>
					<Icon boxSize="1.25rem" aria-hidden />
				</Flex>
				<Text sx={cardStyles.title} noOfLines={2}>
					{t(`dashboard.inventory.cards.${cardId}`)}
				</Text>
			</Flex>

			<Box flex="1">
				{rows.map((row, index) => (
					<Flex key={`${cardId}-${index}`} sx={cardStyles.row}>
						<Text sx={cardStyles.rowLabel} noOfLines={1}>
							{row.label}
						</Text>
						<Text sx={cardStyles.rowValue}>{row.value}</Text>
					</Flex>
				))}
			</Box>
		</Box>
	)
}
