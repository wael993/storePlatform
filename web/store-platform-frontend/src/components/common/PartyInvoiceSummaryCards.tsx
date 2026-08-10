import { Box, Flex, Skeleton, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

import {
	useGetBuyingInvoicesQuery,
	useGetSellingInvoicesQuery,
} from '../../api/apiStore'
import { DollarSignIcon } from '../../icons/DollarSign'
import { WalletIcon } from '../../icons/Wallet'
import { PAGE_COLORS } from '../SellingInvoice/constants'
import { useInvoiceDisplayCurrency } from '../SellingInvoice/useInvoiceDisplayCurrency'

const styles = {
	container: {
		flexDirection: 'column',
		alignItems: 'flex-start',
		gap: '0rem',
		width: '100%',
		fontSize: '0.9rem',
	},
	row: {
		width: '100%',
		display: 'grid',
		gridTemplateColumns: {
			base: 'auto 1fr auto',
			md: 'auto 1fr',
		},
		gridTemplateAreas: {
			base: '"icon label value"',
			md: '"icon label" "icon value"',
		},
		columnGap: '0.5rem',
		rowGap: { base: 0, md: '0.125rem' },
		alignItems: 'center',
		py: '0.25rem',
	},
	label: {
		gridArea: 'label',
		color: PAGE_COLORS.muted,
		fontSize: '0.75em',
		fontWeight: 800,
		lineHeight: 'normal',
		minW: 0,
	},
	value: {
		gridArea: 'value',
		fontSize: '1em',
		fontWeight: 700,
		color: 'gray.900',
		justifySelf: { base: 'end', md: 'start' },
	},
	iconCircle: {
		gridArea: 'icon',
		w: '1.75rem',
		h: '1.75rem',
		borderRadius: 'full',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: '0',
		alignSelf: 'center',
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
	<Box sx={styles.row}>
		<Flex sx={{ ...styles.iconCircle, bg: iconBg, color: iconColor }}>
			{icon}
		</Flex>
		<Text sx={styles.label}>{label}</Text>
		<Text sx={{ ...styles.value, color: valueColor }}>{value}</Text>
	</Box>
)

interface PartyInvoiceSummaryCardsProps {
	customerId?: string
	supplierId?: string
}

const PartyInvoiceSummaryCards = ({
	customerId,
	supplierId,
}: PartyInvoiceSummaryCardsProps) => {
	const { t } = useTranslation()
	const { formatAmount } = useInvoiceDisplayCurrency()
	const isSupplier = Boolean(supplierId) && !customerId

	const sellingQuery = useGetSellingInvoicesQuery(
		{ customerId: customerId ?? '' },
		{ skip: !customerId },
	)
	const buyingQuery = useGetBuyingInvoicesQuery(
		{ supplierId: supplierId ?? '' },
		{ skip: !isSupplier },
	)

	const customerSummary = sellingQuery.data?.customerSummary
	const supplierSummary = buyingQuery.data?.supplierSummary
	const totals = isSupplier
		? supplierSummary && {
				totalInvoiced: supplierSummary.totalInvoiced,
				totalPaid: supplierSummary.totalPaid,
				outstanding: supplierSummary.totalPayable,
			}
		: customerSummary && {
				totalInvoiced: customerSummary.totalInvoiced,
				totalPaid: customerSummary.totalPaid,
				outstanding: customerSummary.totalReceivable,
			}
	const isLoading = isSupplier ? buyingQuery.isLoading : sellingQuery.isLoading
	const isFetching = isSupplier
		? buyingQuery.isFetching
		: sellingQuery.isFetching
	const showSkeleton = isLoading && !totals

	if (!customerId && !supplierId) return null

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

	if (!totals) return null

	const outstandingLabel = isSupplier
		? t('components.invoiceSummary.totalPayable')
		: t('components.invoiceSummary.totalReceivable')

	return (
		<Box width="100%" mb={1} opacity={isFetching ? 0.7 : 1}>
			<Flex sx={styles.container}>
				<SummaryRow
					label={t('components.invoiceSummary.totalInvoiced')}
					value={formatAmount(totals.totalInvoiced)}
					icon={<DollarSignIcon fill="none" />}
					iconBg="#DBEAFE"
					iconColor="#2563EB"
				/>
				<Box sx={styles.divider} />
				<SummaryRow
					label={t('components.invoiceSummary.totalPaid')}
					value={formatAmount(totals.totalPaid)}
					icon={<DollarSignIcon fill="none" />}
					iconBg="#DCFCE7"
					iconColor="#15803D"
				/>
				<Box sx={styles.divider} />
				<SummaryRow
					label={outstandingLabel}
					value={formatAmount(totals.outstanding)}
					icon={<WalletIcon fill="none" />}
					iconBg="#FEE2E2"
					iconColor="#DC2626"
					valueColor={totals.outstanding > 0 ? PAGE_COLORS.danger : 'gray.900'}
				/>
				<Box sx={styles.divider} />
			</Flex>
		</Box>
	)
}

export default PartyInvoiceSummaryCards
