import { Box, Flex, Skeleton, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TimeIcon } from '../../shared/icons/Time'
import {
	resolveKpiChrome,
	type KpiMessageKind,
	type KpiStatus,
} from '../../shared/kpiStatus'

export const KPI_COLORS = {
	border: '#E5E7EB',
	muted: '#6B7280',
	cardShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
	chartStroke: '#93C5FD',
	chartFill: '#DBEAFE',
} as const

const shellStyles = {
	base: {
		bg: 'white',
		borderRadius: 'xl',
		border: '1px solid',
		borderColor: KPI_COLORS.border,
		p: '2',
		boxShadow: KPI_COLORS.cardShadow,
		minH: '6.5rem',
		display: 'flex',
		flexDir: 'column',
	},
	comingSoon: {
		bg: 'gray.50',
		borderColor: 'gray.200',
		boxShadow: 'none',
	},
	title: {
		fontSize: 'sm',
		fontWeight: '700',
		color: 'gray.700',
		lineHeight: '1.2',
	},
	titleMuted: {
		color: KPI_COLORS.muted,
	},
	message: {
		fontSize: 'sm',
		color: KPI_COLORS.muted,
		mt: '1',
	},
	comingSoonTag: {
		alignItems: 'center',
		gap: '0.35rem',
		mt: 'auto',
		pt: '3',
		px: '2',
		py: '0.35rem',
		borderRadius: 'full',
		bg: 'gray.200',
		color: 'gray.600',
		fontSize: 'xs',
		fontWeight: '600',
		w: 'fit-content',
	},
} satisfies StylesObject

const messageKey = (message: KpiMessageKind) => {
	if (message === 'coming_soon') return 'dashboard.kpi.comingSoon' as const
	if (message === 'unavailable') return 'dashboard.kpi.unavailable' as const
	return 'dashboard.kpi.error' as const
}

export interface KpiShellProps {
	title?: string
	titleIcon?: ReactNode
	status: KpiStatus
	children?: ReactNode
	minH?: string | number
}

const KpiShell = ({
	title,
	titleIcon,
	status,
	children,
	minH,
}: KpiShellProps) => {
	const { t } = useTranslation()
	const chrome = resolveKpiChrome(status)
	const isComingSoon = status === 'coming_soon'
	const isMuted = isComingSoon || status === 'unavailable'

	return (
		<Box
			sx={{
				...shellStyles.base,
				...(isComingSoon ? shellStyles.comingSoon : null),
				...(minH != null ? { minH } : null),
			}}
		>
			{(title || titleIcon) && (
				<Flex align="center" gap={2} mb={1}>
					{titleIcon}
					{title ? (
						<Text
							sx={{
								...shellStyles.title,
								...(isMuted ? shellStyles.titleMuted : null),
							}}
						>
							{title}
						</Text>
					) : null}
				</Flex>
			)}
			{chrome.kind === 'loading' && (
				<>
					<Skeleton height="1.75rem" width="70%" mt={title ? 1 : 0} />
					<Text sx={shellStyles.message} srOnly>
						{t('dashboard.kpi.loading')}
					</Text>
				</>
			)}
			{chrome.kind === 'message' && chrome.message === 'coming_soon' && (
				<Flex sx={shellStyles.comingSoonTag} as="span">
					<TimeIcon boxSize="0.875rem" aria-hidden />
					{t(messageKey('coming_soon'))}
				</Flex>
			)}
			{chrome.kind === 'message' && chrome.message !== 'coming_soon' && (
				<Text sx={shellStyles.message}>{t(messageKey(chrome.message))}</Text>
			)}
			{chrome.kind === 'children' && children}
		</Box>
	)
}

export const KpiValueRow = ({
	value,
	icon,
}: {
	value: ReactNode
	icon?: ReactNode
}) => (
	<Flex justify="space-between" align="flex-start" gap={3}>
		<Box flex="1" minW={0}>
			{value}
		</Box>
		{icon}
	</Flex>
)

export default KpiShell
