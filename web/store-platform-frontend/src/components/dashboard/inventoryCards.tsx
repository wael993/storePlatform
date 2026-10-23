import { Box, Flex, Text, useDisclosure } from '@chakra-ui/react'
import { useState, type ComponentType } from 'react'
import type { IconProps } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import {
	LOW_STOCK_DIGEST,
	MISSING_PURCHASE_PRICE_DIGEST,
	MISSING_RETAIL_PRICE_DIGEST,
	NEGATIVE_QUANTITY_DIGEST,
	RETAIL_BELOW_PURCHASE_DIGEST,
	useGetProductNotificationsQuery,
	type ProductDigestType,
} from '../../api/apiStore'
import type { InventoryCardId } from '../../shared/dashboardShell'
import { useSee } from '../../shared/hooks/useSee'
import { PriceTagIcon } from '../../shared/icons/PriceTag'
import { StarIcon } from '../../shared/icons/Star'
import { WarningIcon } from '../../shared/icons/Warning'
import { SEE } from '../../shared/seeFlags'
import { formatNumber } from '../../shared/utils'
import NegativeQuantityDigestModal from '../NegativeQuantityDigestModal'
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

const WARNING_DIGEST_ROWS: Array<{
	type: ProductDigestType
	labelKey: string
}> = [
	{ type: LOW_STOCK_DIGEST, labelKey: 'lowStock' },
	{ type: NEGATIVE_QUANTITY_DIGEST, labelKey: 'negativeQuantity' },
	{ type: MISSING_PURCHASE_PRICE_DIGEST, labelKey: 'missingPurchasePrice' },
	{ type: MISSING_RETAIL_PRICE_DIGEST, labelKey: 'missingRetailPrice' },
	{ type: RETAIL_BELOW_PURCHASE_DIGEST, labelKey: 'retailBelowPurchase' },
]

const LIVE_PRODUCT_CARDS = ['bestProfitProducts', 'bestSellerProducts'] as const

type LiveProductCardId = (typeof LIVE_PRODUCT_CARDS)[number]

const LIVE_ICON_TONES: Record<
	LiveProductCardId | 'inventoryWarnings',
	{ bg: string; color: string }
> = {
	bestSellerProducts: { bg: '#FEF3C7', color: '#B45309' },
	bestProfitProducts: { bg: '#EDE9FE', color: '#6D28D9' },
	inventoryWarnings: { bg: '#FEE2E2', color: '#B91C1C' },
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
	supplierId?: string
}

const LiveProductCard = ({
	cardId,
	dateFrom,
	dateTo,
	supplierId,
}: {
	cardId: LiveProductCardId
	dateFrom: Date
	dateTo: Date
	supplierId?: string
}) => {
	const { t } = useTranslation()
	const { status, kpis, formatMoney } = useInvoiceSummaryKpis(
		dateFrom,
		dateTo,
		supplierId,
	)
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
	supplierId,
}: InventoryListCardProps) => {
	if (cardId === 'bestSellerProducts' || cardId === 'bestProfitProducts') {
		return (
			<LiveProductCard
				cardId={cardId}
				dateFrom={dateFrom}
				dateTo={dateTo}
				supplierId={supplierId}
			/>
		)
	}

	return <LiveInventoryWarningsCard />
}

const LiveInventoryWarningsCard = () => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const digestModal = useDisclosure()
	const [digestType, setDigestType] = useState<ProductDigestType | null>(null)
	const allowed = canSee(SEE.productsNotifications)
	const query = useGetProductNotificationsQuery(
		{ includeRead: true },
		{ skip: !allowed, refetchOnMountOrArgChange: false },
	)
	const Icon = CARD_ICONS.inventoryWarnings
	const tone = LIVE_ICON_TONES.inventoryWarnings
	const isLoading =
		allowed && (query.isLoading || (query.isFetching && !query.data))

	let status: keyof typeof STATUS_KEYS | 'ready' = 'ready'
	if (!allowed) status = 'unavailable'
	else if (isLoading) status = 'loading'
	else if (query.isError) status = 'error'

	const countByType = new Map(
		(query.data?.items ?? []).map(item => [item.type, item.count]),
	)
	const rows =
		status === 'ready'
			? WARNING_DIGEST_ROWS.map(row => ({
					type: row.type,
					label: t(`dashboard.inventory.warnings.${row.labelKey}`),
					value:
						formatNumber(countByType.get(row.type) ?? 0, {
							minimumDecimals: 0,
						}) ?? '0',
				}))
			: []

	const openDigest = (type: ProductDigestType) => {
		setDigestType(type)
		digestModal.onOpen()
	}

	return (
		<>
			<Box sx={cardStyles.card}>
				<KpiHint
					label={t('dashboard.kpi.hints.inventoryWarnings')}
					side="start"
				/>
				<Flex sx={{ ...cardStyles.header, pr: 0, pe: 6 }}>
					<Flex
						sx={{
							...cardStyles.iconWrap,
							bg: tone.bg,
							color: tone.color,
						}}
					>
						<Icon boxSize="1.25rem" fill="#FFFFFF" aria-hidden />
					</Flex>
					<Text sx={{ ...cardStyles.title, color: 'gray.800' }} noOfLines={2}>
						{t('dashboard.inventory.cards.inventoryWarnings')}
					</Text>
				</Flex>
				<Box flex="1">
					{status === 'ready' ? (
						rows.map(row => (
							<Flex
								key={row.type}
								as="button"
								type="button"
								w="100%"
								textAlign="start"
								sx={{
									...cardStyles.row,
									cursor: 'pointer',
									_hover: { bg: 'gray.50' },
								}}
								onClick={() => openDigest(row.type)}
							>
								<Text
									sx={{ ...cardStyles.rowLabel, color: 'gray.800' }}
									noOfLines={1}
								>
									{row.label}
								</Text>
								<Text sx={{ ...cardStyles.rowValue, color: 'gray.900' }}>
									{row.value}
								</Text>
							</Flex>
						))
					) : (
						<Flex sx={cardStyles.row}>
							<Text
								sx={{ ...cardStyles.rowLabel, color: 'gray.800' }}
								noOfLines={1}
							>
								—
							</Text>
							<Text sx={{ ...cardStyles.rowValue, color: 'gray.900' }}>
								{t(STATUS_KEYS[status])}
							</Text>
						</Flex>
					)}
				</Box>
			</Box>
			<NegativeQuantityDigestModal
				digestType={digestType}
				isOpen={digestModal.isOpen}
				onClose={digestModal.onClose}
			/>
		</>
	)
}
