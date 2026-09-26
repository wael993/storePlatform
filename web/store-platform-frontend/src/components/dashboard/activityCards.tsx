import { Box, Button, Flex, Text } from '@chakra-ui/react'
import type { ComponentType } from 'react'
import type { IconProps } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import type { ActivityCardId } from '../../shared/dashboardShell'
import { ClockIcon } from '../../shared/icons/Clock'
import { PersonIcon } from '../../shared/icons/Person'
import { TimeIcon } from '../../shared/icons/Time'

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
		alignItems: 'flex-start',
		gap: 3,
		py: 2.5,
		borderBottom: '1px solid',
		borderColor: 'gray.100',
		_last: { borderBottom: 'none' },
	},
	avatar: {
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		w: 9,
		h: 9,
		borderRadius: 'full',
		bg: 'gray.100',
		color: 'gray.500',
		fontSize: 'xs',
		fontWeight: 700,
	},
	nameRow: {
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 2,
		mb: 0.5,
	},
	name: {
		fontSize: 'sm',
		fontWeight: 600,
		color: 'gray.600',
		noOfLines: 1,
	},
	time: {
		fontSize: 'xs',
		color: 'gray.400',
		flexShrink: 0,
	},
	action: {
		fontSize: 'sm',
		color: 'gray.500',
		noOfLines: 2,
	},
	teamRow: {
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 3,
		py: 2.5,
		borderBottom: '1px solid',
		borderColor: 'gray.100',
		_last: { borderBottom: 'none' },
	},
	teamLabel: {
		fontSize: 'sm',
		color: 'gray.600',
		fontWeight: 500,
	},
	teamValue: {
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

const CARD_ICONS: Record<ActivityCardId, ComponentType<IconProps>> = {
	recentActivity: ClockIcon,
	teamActivity: PersonIcon,
}

/** Mock recent feed — Coming Soon only (DASH-008 board). */
const RECENT_ACTIVITY_MOCK = [
	{
		actorKey: 'mike',
		actionKey: 'createInvoice',
		actionParams: { id: 'INV-1005' },
		timeKey: 'minutesAgo',
		timeCount: 12,
	},
	{
		actorKey: 'sara',
		actionKey: 'addCustomer',
		actionParams: {},
		timeKey: 'hoursAgo',
		timeCount: 1,
	},
	{
		actorKey: 'ali',
		actionKey: 'updateStock',
		productKey: 'usbCable',
		timeKey: 'hoursAgo',
		timeCount: 3,
	},
	{
		actorKey: 'mike',
		actionKey: 'recordPayment',
		actionParams: { id: 'INV-1002' },
		timeKey: 'hoursAgo',
		timeCount: 5,
	},
	{
		actorKey: 'layla',
		actionKey: 'addProduct',
		productKey: 'notebook',
		timeKey: 'yesterday',
	},
] as const

const TEAM_ACTIVITY_MOCK = [
	{ actorKey: 'mike', count: 8 },
	{ actorKey: 'sara', count: 5 },
	{ actorKey: 'ali', count: 3 },
	{ actorKey: 'layla', count: 2 },
	{ actorKey: 'mike', count: 8 },
] as const

interface ActivityListCardProps {
	cardId: ActivityCardId
}

export const ActivityListCard = ({ cardId }: ActivityListCardProps) => {
	const { t } = useTranslation()
	const Icon = CARD_ICONS[cardId]

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
					{t(`dashboard.activity.cards.${cardId}`)}
				</Text>
			</Flex>

			{cardId === 'recentActivity' ? (
				<Box flex="1">
					{RECENT_ACTIVITY_MOCK.map((item, index) => {
						const name = t(`dashboard.activity.actors.${item.actorKey}.name`)
						const initials = t(
							`dashboard.activity.actors.${item.actorKey}.initials`,
						)
						const actionParams =
							'productKey' in item
								? {
										product: t(
											`dashboard.activity.products.${item.productKey}`,
										),
									}
								: item.actionParams

						return (
							<Flex key={`recent-${index}`} sx={cardStyles.row}>
								<Flex sx={cardStyles.avatar} aria-hidden>
									{initials}
								</Flex>
								<Box flex="1" minW={0}>
									<Flex sx={cardStyles.nameRow}>
										<Text sx={cardStyles.name}>{name}</Text>
										<Text sx={cardStyles.time}>
											{'timeCount' in item
												? t(`dashboard.activity.time.${item.timeKey}`, {
														count: item.timeCount,
													})
												: t(`dashboard.activity.time.${item.timeKey}`)}
										</Text>
									</Flex>
									<Text sx={cardStyles.action}>
										{t(
											`dashboard.activity.actions.${item.actionKey}`,
											actionParams,
										)}
									</Text>
								</Box>
							</Flex>
						)
					})}
				</Box>
			) : (
				<Box flex="1">
					{TEAM_ACTIVITY_MOCK.map((item, index) => {
						const name = t(`dashboard.activity.actors.${item.actorKey}.name`)
						const initials = t(
							`dashboard.activity.actors.${item.actorKey}.initials`,
						)
						return (
							<Flex key={`team-${index}`} sx={cardStyles.teamRow}>
								<Flex align="center" gap={3} minW={0}>
									<Flex sx={cardStyles.avatar} aria-hidden>
										{initials}
									</Flex>
									<Text sx={cardStyles.teamLabel} noOfLines={1}>
										{index + 1}. {name}
									</Text>
								</Flex>
								<Text sx={cardStyles.teamValue}>
									{t('dashboard.activity.actionCount', {
										count: item.count,
									})}
								</Text>
							</Flex>
						)
					})}
				</Box>
			)}

			<Button variant="link" sx={cardStyles.viewAll} isDisabled aria-disabled>
				{t('dashboard.activity.viewAll')}
			</Button>
		</Box>
	)
}
