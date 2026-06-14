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
import { compareLanguage, withNoValueFallback } from '../../../shared/utils'
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
		textAlign: 'left',
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
	},
	accordionItem: {
		borderColor: '#EAEAEA',
		borderTop: 'none',
		_notLast: {
			borderBottom: '1px solid',
			borderBottomColor: '#EAEAEA',
		},
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
	areAllItemsSelected,
	onAllItemsSelectedChange,
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
							<Flex alignItems="center" gap="6" flexGrow={1}>
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

								<Box
									sx={{ ...styles.listItemGridItem, flex: 1 }}
									onClick={onClick}
								>
									<Text sx={styles.titleText}>{t('common.entryType')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(
												getEntryTypeLabel(dailyAction.entryType),
											)}
										</Text>
									</Skeleton>
								</Box>

								<Box
									sx={{ ...styles.listItemGridItem, flex: 1 }}
									onClick={onClick}
								>
									<Text sx={styles.titleText}>
										{dailyAction.supplierId
											? t('common.supplier')
											: t('common.customer')}
									</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{dailyAction.supplierId
												? withNoValueFallback(dailyAction.supplierName)
												: withNoValueFallback(dailyAction.customerName)}
										</Text>
									</Skeleton>
								</Box>
							</Flex>
							<AccordionIcon minWidth={'3rem'} />
						</AccordionButton>
					</Box>

					<AccordionPanel
						overflow="hidden"
						paddingLeft={isArabic ? 0 : 16}
						paddingRight={isArabic ? 16 : 0}
					>
						<Grid templateColumns="repeat(2, 1fr)" gap="6">
							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.productName')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>{dailyAction.productName}</Text>
								</Skeleton>
							</GridItem>

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

							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.totalPrice')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{dailyAction.totalPrice ?? ''}
									</Text>
								</Skeleton>
							</GridItem>

							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.invoiceNumber')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{dailyAction.invoiceNumber ?? ''}
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
								<Text sx={styles.titleText}>{t('common.singleUnitPrice')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{dailyAction.singleUnitPrice ?? ''}
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
