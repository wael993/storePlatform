import {
	Accordion,
	AccordionButton,
	AccordionIcon,
	AccordionItem,
	Box,
	Flex,
	Skeleton,
	Checkbox,
	Text,
	AccordionPanel,
	Grid,
	GridItem,
} from '@chakra-ui/react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { buildRoutePath } from '../../../shared/routes'
import { useTranslation } from 'react-i18next'
import {
	compareLanguage,
	mapFee,
	withNoValueFallback,
} from '../../../shared/utils'
import { ENTRY_TYPE_LABELS_MAP } from '../../../shared/globalConstant'
import { formatDate } from '../../../shared/dateUtils'

const styles = {
	listItemGridItem: {
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'start',
		alignItems: 'start',
	},
	// wordBreak and overflowWrap are needed, because the text can contain
	// special characters instead of space and then potentially overflows container.
	valueText: {
		fontSize: 'sm',
		fontWeight: 'bold',
		textAlign: 'start',
		whiteSpace: 'normal',
		wordBreak: 'break-word',
		overflowWrap: 'break-word',
	},
	actionsContainer: {
		mt: '2rem',
		justifyContent: 'flex-end',
		alignItems: 'center',
		gap: '1.25rem',
		flexWrap: 'wrap',
	},
	statusContainer: {
		gap: 0,
		width: '100%',
		alignItems: 'center',
		justifyContent: 'flex-start',
	},
	titleText: {
		fontSize: 'xs',
		color: '#929494',
	},
	accordionButton: {
		flexGrow: 1,
		width: '100%',
		justifyContent: 'space-between',
		alignItems: 'center',
		px: { base: 2, md: 4 },
		py: { base: 3, md: 4 },
	},
	accordionItem: {
		borderColor: '#EAEAEA',
		borderTop: 'none',
		bg: 'white',
		_notLast: {
			borderBottom: '1px solid',
			borderBottomColor: '#EAEAEA',
		},
	},
	summaryColumns: {
		alignItems: 'center',
		gap: { base: 2, md: 6 },
		flexGrow: 1,
		minW: 0,
	},
	summaryField: {
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'start',
		alignItems: 'start',
		flex: 1,
		minW: 0,
	},
} satisfies StylesObject
interface ListItemMobilProps {
	dailyAction: DailyAction
	isLoading: boolean
	onSelect: (id: string) => void
	selectedDailyActionIds: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
	isOpen: boolean
	onToggle: () => void
}

const ListItemMobil = ({
	dailyAction,
	isLoading,
	onSelect,
	selectedDailyActionIds,
	// areAllItemsSelected,
	// onAllItemsSelectedChange,
	isOpen,
	onToggle,
}: ListItemMobilProps) => {
	const navigate = useNavigate()
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)

	const targetPath = dailyAction.supplierId
		? buildRoutePath.supplierById(dailyAction.supplierId)
		: dailyAction.customerId
			? buildRoutePath.customerById(dailyAction.customerId)
			: undefined
	const canNavigateToRelatedParty = !isLoading && Boolean(targetPath)

	const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation()
		if (!targetPath || !canNavigateToRelatedParty) return
		navigate(targetPath)
	}

	const getEntryTypeValue = (entryType: DailyAction['entryType']) => {
		if (!entryType) return undefined
		if (typeof entryType === 'string') return entryType
		return entryType.value
	}

	const getEntryTypeLabel = (
		entryType: DailyAction['entryType'],
	): string | null | undefined => {
		const entryTypeValue = getEntryTypeValue(entryType)

		if (!entryTypeValue) return '-'
		const translationKey = ENTRY_TYPE_LABELS_MAP[entryTypeValue]
		if (translationKey) return t(translationKey)

		return typeof entryType === 'string'
			? entryTypeValue
			: (entryType.label ?? entryType.value ?? '-')
	}
	const entryTypeValue = getEntryTypeValue(dailyAction.entryType)

	const isAmountOnlyAction =
		entryTypeValue === 'PAYMENT_ENTRY' ||
		entryTypeValue === 'RECEIPT_ENTRY' ||
		entryTypeValue === 'EXPENSE_ENTRY'
	const productOrExpense = dailyAction.productName ?? dailyAction.expenseName
	const relatedEntityLabel = dailyAction.supplierId
		? t('common.supplier')
		: dailyAction.customerId
			? t('common.customer')
			: t('common.expense')
	const relatedEntityName =
		dailyAction.supplierName ??
		dailyAction.customerName ??
		dailyAction.expenseName
	const totalPrice = isAmountOnlyAction
		? dailyAction.singleUnitPrice
		: dailyAction.totalPrice

	return (
		<>
			<Accordion allowToggle index={isOpen ? [0] : []} onChange={onToggle}>
				<AccordionItem sx={styles.accordionItem}>
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'row',
						}}
					>
						<AccordionButton sx={styles.accordionButton}>
							<Flex sx={styles.summaryColumns}>
								<Box
									sx={{
										...styles.listItemGridItem,
										width: '1.5rem',
										flex: '0 0 auto',
									}}
								>
									<Skeleton isLoaded={!isLoading}>
										<Checkbox
											onChange={e => {
												onSelect(dailyAction.actionId)
												e.stopPropagation()
											}}
											isChecked={selectedDailyActionIds.includes(
												dailyAction.actionId,
											)}
											zIndex={2}
										/>
									</Skeleton>
								</Box>

								<Box sx={styles.summaryField} onClick={onClick}>
									<Text sx={styles.titleText}>{t('common.entryType')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText} noOfLines={2}>
											{withNoValueFallback(
												getEntryTypeLabel(dailyAction.entryType),
											)}
										</Text>
									</Skeleton>
								</Box>

								<Box sx={styles.summaryField} onClick={onClick}>
									<Text sx={styles.titleText}>{relatedEntityLabel}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText} noOfLines={2}>
											{withNoValueFallback(relatedEntityName)}
										</Text>
									</Skeleton>
								</Box>
							</Flex>
							<AccordionIcon
								minWidth={{ base: '1.5rem', md: '3rem' }}
								flexShrink={0}
							/>
						</AccordionButton>
					</Box>

					<AccordionPanel
						overflow="hidden"
						px={{ base: 3, md: 4 }}
						py={3}
						pl={isArabic ? { base: 3, md: 4 } : { base: 10, md: 12 }}
						pr={isArabic ? { base: 10, md: 12 } : { base: 3, md: 4 }}
					>
						<Grid
							templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }}
							gap={{ base: 4, md: 6 }}
						>
							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>
									{/* TO_DO :use isExpenseEntry from compareEntryType */}
									{entryTypeValue === 'EXPENSE_ENTRY'
										? t('common.expenseName')
										: t('common.productName')}
								</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(productOrExpense)}
									</Text>
								</Skeleton>
							</GridItem>

							{entryTypeValue !== 'EXPENSE_ENTRY' && (
								<GridItem sx={styles.listItemGridItem}>
									<Text sx={styles.titleText}>{t('common.weight')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{dailyAction.weight
												? `${dailyAction.weight} ${dailyAction.unitName ?? ''}`
												: '-'}
										</Text>
									</Skeleton>
								</GridItem>
							)}

							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.totalPrice')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(mapFee(totalPrice))}
									</Text>
								</Skeleton>
							</GridItem>

							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.invoiceNumber')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(dailyAction.invoiceNumber ?? '')}
									</Text>
								</Skeleton>
							</GridItem>

							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.invoiceDate')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{dailyAction.invoiceDate
											? formatDate(dailyAction.invoiceDate)
											: '-'}
									</Text>
								</Skeleton>
							</GridItem>

							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.note')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(dailyAction.note?.trim())}
									</Text>
								</Skeleton>
							</GridItem>

							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.singleUnitPrice')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{mapFee(dailyAction.singleUnitPrice) ?? ''}
									</Text>
								</Skeleton>
							</GridItem>
						</Grid>
					</AccordionPanel>
				</AccordionItem>
			</Accordion>
		</>
	)
}

export default ListItemMobil
