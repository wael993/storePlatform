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
import { TargetType } from '../../shared/globalEnums'

const styles: StylesObject = {
	budgetOverviewContainer: {
		flexDirection: 'column',
		alignItems: 'flex-start',
		gap: '0.5rem',
		px: { base: 0, md: '1rem' },
		py: { base: 0, md: '0.5rem' },
		fontSize: '0.9rem',
		width: '100%',
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
		width: { base: '100%', md: '30%' },
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
	targetType?: TargetType
	payments?: string
	purchase?: string
	currency?: string
	balance?: string
	isFetching?: boolean
	sumBuyingWeight?: string
	sumSellingWeight?: string
	labels?: {
		tooltip?: string
		title?: string
		purchase?: string
		payments?: string
		balance?: string
		sumBuyingWeight?: string
		sumSellingWeight?: string
	}
}

export const BudgetOverview = ({
	targetType,
	sumBuyingWeight,
	sumSellingWeight,
	payments,
	purchase,
	currency,
	balance,
	isFetching,
	labels,
}: BudgetOverviewProps) => {
	const { t } = useTranslation()

	const isBalanceNegative = parseFloat(balance ?? '0') < 0

	return isFetching ? (
		<Skeleton height="8rem" width="100%" borderRadius="lg" />
	) : (
		<Tooltip
			closeOnScroll={true}
			label={
				<Text sx={styles.tooltip}>
					{labels?.tooltip ?? t('components.budgetOverview.tooltip')}
				</Text>
			}
			aria-label={t('common.tooltip')}
		>
			<Flex sx={{ ...styles.budgetOverviewContainer, width: '100%' }}>
				<Heading variant="h4" sx={styles.header}>
					{labels?.title ?? t('components.budgetOverview.text')}
				</Heading>

				{targetType === TargetType.PRODUCT && (
					<>
						<Divider sx={styles.divider} />
						<HStack sx={{ width: '100%' }}>
							<Flex sx={{ ...styles.budgetInfo, width: '50%' }}>
								<Text sx={styles.text}>
									{labels?.sumBuyingWeight ??
										t('components.budgetOverview.sumBuyingWeight')}
								</Text>
								<Heading variant="h4" sx={styles.budgetInfoText}>
									{`${mapFee(sumBuyingWeight) ?? '0'} KG`}
								</Heading>
							</Flex>
							<Flex sx={{ ...styles.budgetInfo, width: '50%' }}>
								<Text sx={styles.text}>
									{labels?.sumSellingWeight ??
										t('components.budgetOverview.sumSellingWeight')}
								</Text>
								<Heading variant="h4" sx={styles.budgetInfoText}>
									{`${mapFee(sumSellingWeight) ?? '0'} KG`}
								</Heading>
							</Flex>
						</HStack>
					</>
				)}
				<Divider sx={styles.divider} />
				<HStack sx={{ width: '100%' }}>
					<Flex sx={{ ...styles.budgetInfo, width: '50%' }}>
						<Text sx={styles.text}>
							{labels?.purchase ?? t('components.budgetOverview.purchase')}
						</Text>
						<Heading variant="h4" sx={styles.budgetInfoText}>
							{`${mapFee(purchase) ?? '0'} ${currency ?? 'N.SYP'}`}
						</Heading>
					</Flex>
					<Flex sx={{ ...styles.budgetInfo, width: '50%' }}>
						<Text sx={styles.text}>
							{labels?.payments ?? t('components.budgetOverview.payments')}
						</Text>
						<Heading variant="h4" sx={styles.budgetInfoText}>
							{`${mapFee(payments) ?? '0'} ${currency ?? 'N.SYP'}`}
						</Heading>
					</Flex>
				</HStack>
				<Divider sx={{ ...styles.divider, width: '100%' }} />

				<Flex sx={styles.budgetInfo}>
					<Text sx={styles.text}>
						{labels?.balance ?? t('components.budgetOverview.balance')}
					</Text>
					<Heading
						variant="h4"
						sx={{
							...styles.budgetInfoText,
							color: isBalanceNegative ? 'red' : 'green',
						}}
					>
						{mapFee(balance) ?? '0'} {currency ?? 'N.SYP'}
					</Heading>
				</Flex>
			</Flex>
		</Tooltip>
	)
}
