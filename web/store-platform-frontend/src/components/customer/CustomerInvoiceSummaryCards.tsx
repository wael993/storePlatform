import { Box, Flex, Skeleton, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

import { useGetSellingInvoicesQuery } from '../../api/apiStore'
import { DollarSignIcon } from '../../icons/DollarSign'
import { WalletIcon } from '../../icons/Wallet'
import { PAGE_COLORS } from '../SellingInvoice/constants'
import { useInvoiceDisplayCurrency } from '../SellingInvoice/useInvoiceDisplayCurrency'

const styles = {
	container: {
		flexDirection: 'column',
		alignItems: 'flex-start',
		gap: '0.5rem',
		width: '100%',
		fontSize: '0.9rem',
	},
	row: {
		width: '100%',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: '0.75rem',
		py: '0.25rem',
	},
	label: {
		color: PAGE_COLORS.muted,
		fontSize: '0.75em',
		fontWeight: 800,
		lineHeight: 'normal',
	},
	value: {
		fontSize: '1em',
		fontWeight: 700,
		color: 'gray.900',
	},
	iconCircle: {
		w: '1.75rem',
		h: '1.75rem',
		borderRadius: 'full',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: '0',
	},
	divider: {
		width: '100%',
		height: '0.2rem',
		border: 'none',
		backgroundColor: '#376288',
	},
} satisfies StylesObject

interface SummaryRowProps {
	label: string
	value: string
	icon: React.ReactNode
	iconBg: string
	iconColor: string
	valueColor?: string
}

const SummaryRow = ({
	label,
	value,
	icon,
	iconBg,
	iconColor,
	valueColor = 'gray.900',
}: SummaryRowProps) => (
	<Flex sx={styles.row}>
		<Flex align="center" gap={2} minW={0} flex="1">
			<Flex sx={{ ...styles.iconCircle, bg: iconBg, color: iconColor }}>
				{icon}
			</Flex>
			<Text sx={styles.label}>{label}</Text>
		</Flex>
		<Text sx={{ ...styles.value, color: valueColor }}>{value}</Text>
	</Flex>
)

interface CustomerInvoiceSummaryCardsProps {
	customerId: string
}

const CustomerInvoiceSummaryCards = ({
	customerId,
}: CustomerInvoiceSummaryCardsProps) => {
	const { t } = useTranslation()
	const { formatAmount } = useInvoiceDisplayCurrency()
	const { data, isLoading, isFetching } = useGetSellingInvoicesQuery(
		{ customerId },
		{ skip: !customerId },
	)

	const summary = data?.customerSummary
	const showSkeleton = isLoading && !summary

	if (showSkeleton) {
		return (
			<Flex sx={styles.container} mb={3}>
				{Array.from({ length: 3 }).map((_, index) => (
					<Skeleton
						key={index}
						height="1.75rem"
						width="100%"
						borderRadius="md"
					/>
				))}
			</Flex>
		)
	}

	if (!summary) return null

	return (
		<Box width="100%" mb={3} opacity={isFetching ? 0.7 : 1}>
			<Flex sx={styles.container}>
				<Box sx={styles.divider} />
				<SummaryRow
					label={t('components.customer.totalInvoiced')}
					value={formatAmount(summary.totalInvoiced)}
					icon={<DollarSignIcon fill="none" />}
					iconBg="#DBEAFE"
					iconColor="#2563EB"
				/>
				<Box sx={styles.divider} />
				<SummaryRow
					label={t('components.customer.totalPaid')}
					value={formatAmount(summary.totalPaid)}
					icon={<DollarSignIcon fill="none" />}
					iconBg="#DCFCE7"
					iconColor="#15803D"
				/>
				<Box sx={styles.divider} />
				<SummaryRow
					label={t('components.customer.totalReceivable')}
					value={formatAmount(summary.totalReceivable)}
					icon={<WalletIcon fill="none" />}
					iconBg="#FEE2E2"
					iconColor="#DC2626"
					valueColor={
						summary.totalReceivable > 0 ? PAGE_COLORS.danger : 'gray.900'
					}
				/>
				<Box sx={styles.divider} />
			</Flex>
		</Box>
	)
}

export default CustomerInvoiceSummaryCards
