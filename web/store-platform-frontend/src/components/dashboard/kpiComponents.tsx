import { Box, Flex, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FiTrendingDown, FiTrendingUp } from 'react-icons/fi'
import type { KpiStatus } from '../../shared/kpiStatus'
import { ArrowDownIcon } from '../../shared/icons/ArrowDown'
import { TimeIcon } from '../../shared/icons/Time'
import KpiShell, { KPI_COLORS, KpiValueRow } from './KpiShell'

const valueStyles = {
	value: {
		fontSize: { base: 'xl', md: '2xl' },
		fontWeight: '700',
		color: 'gray.900',
		lineHeight: '1.2',
	},
	comparison: {
		fontSize: 'xs',
		fontWeight: '600',
		color: KPI_COLORS.muted,
		mt: '1',
	},
	listItem: {
		fontSize: 'sm',
		color: 'gray.800',
		py: '1.5',
		borderBottom: '1px solid',
		borderColor: KPI_COLORS.border,
		_last: { borderBottom: 'none' },
	},
	listMeta: {
		fontSize: 'xs',
		color: KPI_COLORS.muted,
	},
} satisfies StylesObject

export interface KpiCardProps {
	title?: string
	status?: KpiStatus
	value?: ReactNode
	icon?: ReactNode
}

export const KpiCard = ({
	title,
	status = 'available',
	value,
	icon,
}: KpiCardProps) => (
	<KpiShell title={title} status={status}>
		<KpiValueRow
			value={<Text sx={valueStyles.value}>{value}</Text>}
			icon={icon}
		/>
	</KpiShell>
)

export interface KpiCardComingSoonProps {
	title?: string
	titleIcon?: ReactNode
	/** Mock value shown while the KPI is not wired. */
	value?: ReactNode
	trend?: { direction: 'up' | 'down'; delta: string }
}

const comingSoonStyles = {
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
	iconWrap: {
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		w: { base: 12, sm: 14, lg: 10 },
		h: { base: 12, sm: 14, lg: 10 },
		borderRadius: 'full',
		bg: 'gray.50',
		color: 'gray.400',
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
		color: 'gray.500',
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
		color: 'gray.400',
		lineHeight: '1',
	},
	trend: {
		alignItems: 'center',
		gap: 1,
		mt: { base: 3, lg: 2 },
		fontSize: { base: 'sm', lg: 'xs' },
		fontWeight: 700,
	},
} satisfies StylesObject

export const KpiCardComingSoon = ({
	title,
	titleIcon,
	value = '842',
	trend,
}: KpiCardComingSoonProps) => {
	const { t } = useTranslation()

	return (
		<Box sx={comingSoonStyles.card}>
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

			<Box sx={comingSoonStyles.ribbon}>
				<Flex sx={comingSoonStyles.ribbonLabel}>
					<TimeIcon boxSize={{ base: '0.8rem', lg: '0.65rem' }} />
					{t('dashboard.kpi.comingSoon')}
				</Flex>
			</Box>

			<Flex
				position="relative"
				align="center"
				h="100%"
				minH={{ base: '6.5rem', lg: '5.5rem' }}
				zIndex={1}
			>
				{titleIcon ? (
					<Flex sx={comingSoonStyles.iconWrap}>{titleIcon}</Flex>
				) : null}
				{titleIcon ? <Box sx={comingSoonStyles.divider} /> : null}

				<Box flex="1" minW={0} pr={{ base: 8, lg: 6 }}>
					{title ? (
						<Text sx={comingSoonStyles.title} noOfLines={2}>
							{title}
						</Text>
					) : null}
					<Text sx={comingSoonStyles.description} noOfLines={2}>
						{t('dashboard.kpi.comingSoonDescription')}
					</Text>
					<Text sx={comingSoonStyles.value}>{value}</Text>
					{trend ? (
						<Flex
							sx={comingSoonStyles.trend}
							color={
								'gray.500'
								//this is temporary until we have the correct colors for the trends
								//trend.direction === 'down' ? '#EF4444' : '#22C55E'
							}
							position="relative"
							zIndex={3}
						>
							{trend.delta.includes('%') ? (
								trend.direction === 'up' ? (
									<Box
										as={FiTrendingUp}
										boxSize={{ base: '0.9rem', lg: '0.75rem' }}
									/>
								) : (
									<Box
										as={FiTrendingDown}
										boxSize={{ base: '0.9rem', lg: '0.75rem' }}
									/>
								)
							) : (
								<ArrowDownIcon
									boxSize={{ base: '0.9rem', lg: '0.75rem' }}
									color="currentColor"
									transform={
										trend.direction === 'up' ? 'rotate(180deg)' : undefined
									}
									aria-hidden
								/>
							)}
							<Text as="span" color="currentColor" fontWeight={700}>
								{trend.delta}
							</Text>
						</Flex>
					) : null}
				</Box>
			</Flex>
		</Box>
	)
}

export interface KpiCardWithComparisonProps {
	title?: string
	status?: KpiStatus
	value?: ReactNode
	comparison?: ReactNode
	icon?: ReactNode
}

export const KpiCardWithComparison = ({
	title,
	status = 'available',
	value,
	comparison,
	icon,
}: KpiCardWithComparisonProps) => (
	<KpiShell title={title} status={status}>
		<KpiValueRow
			value={
				<>
					<Text sx={valueStyles.value}>{value}</Text>
					{comparison != null && (
						<Text sx={valueStyles.comparison}>{comparison}</Text>
					)}
				</>
			}
			icon={icon}
		/>
	</KpiShell>
)

export interface ChartPoint {
	label?: string
	value: number
}

const TrendSvg = ({ points }: { points: ChartPoint[] }) => {
	const width = 200
	const height = 72
	const max = Math.max(...points.map(p => p.value), 1)
	const min = Math.min(...points.map(p => p.value), 0)
	const range = max - min || 1
	const polyline = points
		.map((point, index) => {
			const x =
				points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
			const y = height - ((point.value - min) / range) * (height - 8) - 4
			return `${x},${y}`
		})
		.join(' ')

	return (
		<svg
			width="100%"
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			aria-hidden="true"
		>
			<polyline
				fill="none"
				stroke={KPI_COLORS.chartStroke}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				points={polyline}
			/>
		</svg>
	)
}

const ColumnSvg = ({ points }: { points: ChartPoint[] }) => {
	const width = 200
	const height = 72
	const max = Math.max(...points.map(p => p.value), 1)
	const gap = 4
	const barWidth =
		(width - gap * (points.length + 1)) / Math.max(points.length, 1)

	return (
		<svg
			width="100%"
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			aria-hidden="true"
		>
			{points.map((point, index) => {
				const barHeight = (point.value / max) * (height - 4)
				const x = gap + index * (barWidth + gap)
				const y = height - barHeight
				return (
					<rect
						key={`${point.label ?? index}-${point.value}`}
						x={x}
						y={y}
						width={barWidth}
						height={barHeight}
						rx={2}
						fill={KPI_COLORS.chartFill}
						stroke={KPI_COLORS.chartStroke}
					/>
				)
			})}
		</svg>
	)
}

const DonutSvg = ({ points }: { points: ChartPoint[] }) => {
	const size = 72
	const stroke = 10
	const radius = (size - stroke) / 2
	const circumference = 2 * Math.PI * radius
	const total = points.reduce((sum, point) => sum + point.value, 0) || 1
	let offset = 0

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			aria-hidden="true"
		>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke={KPI_COLORS.border}
				strokeWidth={stroke}
			/>
			{points.map((point, index) => {
				const length = (point.value / total) * circumference
				const el = (
					<circle
						key={`${point.label ?? index}-${point.value}`}
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke={
							index % 2 === 0 ? KPI_COLORS.chartStroke : KPI_COLORS.chartFill
						}
						strokeWidth={stroke}
						strokeDasharray={`${length} ${circumference - length}`}
						strokeDashoffset={-offset}
						transform={`rotate(-90 ${size / 2} ${size / 2})`}
					/>
				)
				offset += length
				return el
			})}
		</svg>
	)
}

const ChartFrame = ({ children }: { children: ReactNode }) => (
	<Box
		mt={2}
		minH="4.5rem"
		display="flex"
		alignItems="center"
		justifyContent="center"
	>
		{children}
	</Box>
)

export interface ChartKpiProps {
	title?: string
	status?: KpiStatus
	points?: ChartPoint[]
}

export const TrendChart = ({
	title,
	status = 'available',
	points = [],
}: ChartKpiProps) => (
	<KpiShell title={title} status={status} minH="10rem">
		<ChartFrame>
			{points.length > 0 ? (
				<TrendSvg points={points} />
			) : (
				<Box w="100%" h="4.5rem" borderRadius="md" bg="gray.50" />
			)}
		</ChartFrame>
	</KpiShell>
)

export const ColumnChart = ({
	title,
	status = 'available',
	points = [],
}: ChartKpiProps) => (
	<KpiShell title={title} status={status} minH="10rem">
		<ChartFrame>
			{points.length > 0 ? (
				<ColumnSvg points={points} />
			) : (
				<Box w="100%" h="4.5rem" borderRadius="md" bg="gray.50" />
			)}
		</ChartFrame>
	</KpiShell>
)

export const DonutChart = ({
	title,
	status = 'available',
	points = [],
}: ChartKpiProps) => (
	<KpiShell title={title} status={status} minH="10rem">
		<ChartFrame>
			{points.length > 0 ? (
				<DonutSvg points={points} />
			) : (
				<Box w="4.5rem" h="4.5rem" borderRadius="full" bg="gray.50" />
			)}
		</ChartFrame>
	</KpiShell>
)

export interface RankingListItem {
	label: string
	value?: ReactNode
}

export interface RankingListProps {
	title?: string
	status?: KpiStatus
	items?: RankingListItem[]
}

export const RankingList = ({
	title,
	status = 'available',
	items = [],
}: RankingListProps) => (
	<KpiShell title={title} status={status} minH="10rem">
		<Box>
			{items.map((item, index) => (
				<Flex
					key={`${item.label}-${index}`}
					sx={valueStyles.listItem}
					justify="space-between"
					gap={3}
				>
					<Text noOfLines={1}>
						{index + 1}. {item.label}
					</Text>
					{item.value != null && (
						<Text sx={valueStyles.listMeta}>{item.value}</Text>
					)}
				</Flex>
			))}
		</Box>
	</KpiShell>
)

export interface WarningListItem {
	label: string
	detail?: ReactNode
}

export interface WarningListProps {
	title?: string
	status?: KpiStatus
	items?: WarningListItem[]
}

export const WarningList = ({
	title,
	status = 'available',
	items = [],
}: WarningListProps) => (
	<KpiShell title={title} status={status} minH="10rem">
		<Box>
			{items.map((item, index) => (
				<Box key={`${item.label}-${index}`} sx={valueStyles.listItem}>
					<Text noOfLines={1}>{item.label}</Text>
					{item.detail != null && (
						<Text sx={valueStyles.listMeta}>{item.detail}</Text>
					)}
				</Box>
			))}
		</Box>
	</KpiShell>
)

export interface ActivityListItem {
	actor: string
	action: string
	entity?: string
	relativeTime?: string
}

export interface ActivityListProps {
	title?: string
	status?: KpiStatus
	items?: ActivityListItem[]
}

export const ActivityList = ({
	title,
	status = 'available',
	items = [],
}: ActivityListProps) => (
	<KpiShell title={title} status={status} minH="10rem">
		<Box>
			{items.map((item, index) => (
				<Flex
					key={`${item.actor}-${item.action}-${index}`}
					sx={valueStyles.listItem}
					justify="space-between"
					gap={3}
				>
					<Box minW={0}>
						<Text noOfLines={1}>
							{item.actor} · {item.action}
							{item.entity ? ` · ${item.entity}` : ''}
						</Text>
					</Box>
					{item.relativeTime != null && (
						<Text sx={valueStyles.listMeta} flexShrink={0}>
							{item.relativeTime}
						</Text>
					)}
				</Flex>
			))}
		</Box>
	</KpiShell>
)
