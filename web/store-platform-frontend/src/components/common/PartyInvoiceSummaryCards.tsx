import { Box, Flex, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

import { DollarSignIcon } from '../../icons/DollarSign'
import { WalletIcon } from '../../icons/Wallet'
import { PAGE_COLORS } from '../SellingInvoice/constants'
import { useInvoiceDisplayCurrency } from '../SellingInvoice/useInvoiceDisplayCurrency'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'

const styles = {
	container: {
		display: 'grid',
		gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
		gap: '1rem',
		width: '100%',
		fontSize: '0.9rem',
		alignItems: 'start',
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
	party: 'customer' | 'supplier' | 'partner'
	totals?: {
		totalInvoiced: number
		totalPaid: number
		outstanding: number
	}
}

const PartyInvoiceSummaryCards = ({
	party,
	totals,
}: PartyInvoiceSummaryCardsProps) => {
	const { t } = useTranslation()
	const { formatAmount } = useInvoiceDisplayCurrency()
	const { canSee } = useSee()
	const canSeeOutstanding =
		party === 'partner' ||
		(party === 'supplier'
			? canSee(SEE.suppliersTotalPayable)
			: canSee(SEE.customersTotalReceivable))

	if (!totals) return null

	const owedToUs =
		(party === 'supplier' ? -totals.outstanding : totals.outstanding) >= 0
	const outstandingLabel = t(
		owedToUs
			? 'components.invoiceSummary.forUs'
			: 'components.invoiceSummary.forThem',
	)
	const invoiceTotalLabel = t(
		party === 'supplier'
			? 'components.invoiceSummary.buyingInvoices'
			: 'components.invoiceSummary.sellingInvoices',
	)

	return (
		<Box width="100%">
			<Box sx={styles.container}>
				<SummaryRow
					label={invoiceTotalLabel}
					value={formatAmount(totals.totalInvoiced)}
					icon={<DollarSignIcon fill="none" />}
					iconBg="#DBEAFE"
					iconColor="#2563EB"
				/>
				{canSeeOutstanding && (
					<SummaryRow
						label={outstandingLabel}
						value={formatAmount(Math.abs(totals.outstanding))}
						icon={<WalletIcon fill="none" />}
						iconBg="#FEE2E2"
						iconColor="#DC2626"
						valueColor={
							totals.outstanding > 0 ? PAGE_COLORS.danger : 'gray.900'
						}
					/>
				)}
			</Box>
		</Box>
	)
}

export default PartyInvoiceSummaryCards
