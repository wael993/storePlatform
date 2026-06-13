import {
	Divider,
	Flex,
	Heading,
	HStack,
	Skeleton,
	Text,
	Tooltip,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { mapFee } from '../../shared/utils'

const styles: StylesObject = {
	budgetOverviewContainer: {
		// backgroundColor: '#F3F3F3',
		flexDirection: 'column',
		alignItems: 'flex-start',
		gap: '0.5rem',
		px: '1rem',
		py: '0.5rem',
		fontSize: '0.9rem',
	},

	budgetInfo: {
		flexDirection: 'column',
	},
	budgetInfoText: {
		fontSize: '1em',
		fontWeight: 700,
		paddingBottom: 0,
	},
	divider: {
		width: '30%',
		height: '0.2rem',
		border: 'none',
		backgroundColor: '#376288',
	},
	header: {
		fontSize: '1em',
		fontWeight: 800,
		paddingBottom: 0,
	},
	text: {
		color: '#8B8B8B',
		fontSize: '0.75em',
		fontWeight: 800,
		lineHeight: 'normal',
	},
	tooltip: {
		width: '7rem',
		fontSize: '0.9rem',
		textAlign: 'center',
		lineHeight: '1rem',
	},
}

interface BudgetOverviewProps {
	payments?: string
	purchase?: string
	currency?: string
	balance?: string
	isFetching?: boolean
}

export const BudgetOverview = ({
	payments,
	purchase,
	currency,
	balance,
	isFetching,
}: BudgetOverviewProps) => {
	const { t } = useTranslation()

	const isBalanceNegative = parseFloat(balance ?? '0') < 0

	return isFetching ? (
		<Skeleton height="8rem" width="11rem" />
	) : (
		<Tooltip
			closeOnScroll={true}
			label={
				<Text sx={styles.tooltip}>
					{t('components.budgetOverview.tooltip')}
				</Text>
			}
			aria-label={t('common.tooltip')}
		>
			<Flex sx={{ ...styles.budgetOverviewContainer, width: '100%' }}>
				<Heading variant="h4" sx={styles.header}>
					{t('components.budgetOverview.text')}
				</Heading>
				<Divider sx={styles.divider} />
				<HStack sx={{ width: '100%' }}>
					<Flex sx={{ ...styles.budgetInfo, width: '50%' }}>
						<Text sx={styles.text}>
							{t('components.budgetOverview.purchase')}
						</Text>
						<Heading variant="h4" sx={styles.budgetInfoText}>
							{`${mapFee(purchase) ?? '0'} ${currency ?? 'N.SYP'}`}
						</Heading>
					</Flex>
					<Flex sx={{ ...styles.budgetInfo, width: '50%' }}>
						<Text sx={styles.text}>
							{t('components.budgetOverview.payments')}
						</Text>
						<Heading variant="h4" sx={styles.budgetInfoText}>
							{`${mapFee(payments) ?? '0'} ${currency ?? 'N.SYP'}`}
						</Heading>
					</Flex>
				</HStack>
				<Divider sx={{ ...styles.divider, width: '100%' }} />

				<Flex sx={styles.budgetInfo}>
					<Text sx={styles.text}>{t('components.budgetOverview.balance')}</Text>
					<Heading
						variant="h4"
						sx={{
							...styles.budgetInfoText,
							color: isBalanceNegative ? 'red' : 'green',
						}}
					>
						{`${isBalanceNegative ? '-' : ''}${mapFee(balance) ?? '0'} ${currency ?? 'N.SYP'}`}
					</Heading>
				</Flex>
			</Flex>
		</Tooltip>
	)
}
