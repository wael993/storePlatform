import { Box, Button, Flex, Text } from '@chakra-ui/react'
import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { InventoryCardId } from '../../shared/dashboardShell'
import { PriceTagIcon } from '../../shared/icons/PriceTag'
import { StarIcon } from '../../shared/icons/Star'
import { TimeIcon } from '../../shared/icons/Time'
import { WarningIcon } from '../../shared/icons/Warning'

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
	viewAll: {
		mt: 'auto',
		pt: 4,
		alignSelf: 'flex-start',
		color: 'gray.500',
		fontSize: 'sm',
		fontWeight: 600,
		h: 'auto',
		minH: 'auto',
		px: 0,
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

const BEST_PROFIT_MOCK = [
	{ name: 'زيت زيتون فاخر 1 لتر', value: '250' },
	{ name: 'سماعات أذن لاسلكية Pro', value: '180' },
	{ name: 'عبوة قمصان قطنية', value: '95' },
	{ name: 'لعبة للأطفال', value: '120' },
	{ name: 'قلم رصاص', value: '100' },
] as const

const BEST_SELLER_MOCK = [
	{ name: 'مياه معدنية 1.5 لتر', sold: 200 },
	{ name: 'دفتر ملاحظات A5', sold: 150 },
	{ name: 'كابل USB-C', sold: 120 },
	{ name: 'كتاب قصص قصيرة', sold: 100 },
	{ name: 'مسطرة 10 سم', sold: 100 },
] as const

interface InventoryListCardProps {
	cardId: InventoryCardId
}

export const InventoryListCard = ({ cardId }: InventoryListCardProps) => {
	const { t } = useTranslation()
	const Icon = CARD_ICONS[cardId]
	const showViewAll = cardId !== 'inventoryWarnings'

	let rows: { label: ReactNode; value: string }[] = []
	if (cardId === 'inventoryWarnings') {
		rows = WARNING_KEYS.map((key, index) => ({
			label: t(`dashboard.inventory.warnings.${key}`),
			value: WARNING_COUNTS[index],
		}))
	} else if (cardId === 'bestProfitProducts') {
		rows = BEST_PROFIT_MOCK.map((item, index) => ({
			label: `${index + 1}. ${item.name}`,
			value: item.value,
		}))
	} else {
		rows = BEST_SELLER_MOCK.map((item, index) => ({
			label: `${index + 1}. ${item.name}`,
			value: t('dashboard.inventory.soldCount', { count: item.sold }),
		}))
	}

	return (
		<Box sx={cardStyles.card}>
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

			{showViewAll ? (
				<Button variant="link" sx={cardStyles.viewAll} isDisabled aria-disabled>
					{t('dashboard.inventory.viewAll')}
				</Button>
			) : null}
		</Box>
	)
}
