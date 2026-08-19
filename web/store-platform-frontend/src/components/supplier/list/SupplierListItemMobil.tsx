import {
	Accordion,
	AccordionButton,
	AccordionIcon,
	AccordionItem,
	AccordionPanel,
	Box,
	Checkbox,
	Flex,
	Grid,
	GridItem,
	Skeleton,
	Text,
} from '@chakra-ui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { buildRoutePath } from '../../../shared/routes'
import { compareLanguage, withNoValueFallback } from '../../../shared/utils'
import NotificationCircle from '../../NotificationCircle'
import StateCircle from '../../StateCircle'
import OptionsPopover from '../../modals/OptionsPopover'
import { PAGE_COLORS } from '../../SellingInvoice/constants'
import { useInvoiceDisplayCurrency } from '../../SellingInvoice/useInvoiceDisplayCurrency'

const styles = {
	listItemGridItem: {
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'start',
		alignItems: 'start',
	},
	valueText: {
		fontSize: 'sm',
		fontWeight: 'bold',
		textAlign: 'left',
		whiteSpace: 'normal',
		wordBreak: 'break-word',
		overflowWrap: 'break-word',
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
	actionsContainer: {
		mt: '2rem',
		alignItems: 'center',
		gap: '1.25rem',
		flexWrap: 'wrap',
	},
} satisfies StylesObject

interface SupplierListItemMobilProps {
	supplier: Supplier
	isLoading: boolean
	onSelect: (id: string) => void
	selectedSuppliers: string[]
	isOpen: boolean
	onToggle: () => void
}

const SupplierListItemMobil = ({
	supplier,
	isLoading,
	onSelect,
	selectedSuppliers,
	isOpen,
	onToggle,
}: SupplierListItemMobilProps) => {
	const navigate = useNavigate()
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const { formatAmount } = useInvoiceDisplayCurrency()
	const totalPayable = supplier.totalPayable ?? 0

	const onNavigate = (event: React.MouseEvent<HTMLDivElement>) => {
		event.stopPropagation()
		if (isLoading) return
		navigate(buildRoutePath.supplierById(supplier.supplierId))
	}

	return (
		<Accordion allowToggle index={isOpen ? [0] : []} onChange={onToggle}>
			<AccordionItem sx={styles.accordionItem}>
				<Box display="flex" flexDirection="row">
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
										onChange={event => {
											onSelect(supplier.supplierId)
											event.stopPropagation()
										}}
										isChecked={selectedSuppliers.includes(supplier.supplierId)}
										zIndex={2}
									/>
								</Skeleton>
							</Box>

							<Box
								sx={{ ...styles.listItemGridItem, flex: 1 }}
								onClick={onNavigate}
							>
								<Text sx={styles.titleText}>{t('supplier.list.name')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(supplier.name)}
									</Text>
								</Skeleton>
							</Box>

							<Box
								sx={{ ...styles.listItemGridItem, flex: 1 }}
								onClick={onNavigate}
							>
								<Text sx={styles.titleText}>
									{t('supplier.list.internalCode')}
								</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(supplier.internalCode)}
									</Text>
								</Skeleton>
							</Box>
						</Flex>
						<AccordionIcon minWidth="3rem" />
					</AccordionButton>
				</Box>

				<AccordionPanel
					overflow="hidden"
					paddingLeft={isArabic ? 0 : 16}
					paddingRight={isArabic ? 16 : 0}
				>
					<Grid templateColumns="repeat(2, 1fr)" gap="6">
						<GridItem sx={styles.listItemGridItem}>
							<Text sx={styles.titleText}>
								{t('components.invoiceSummary.totalPayable')}
							</Text>
							<Skeleton isLoaded={!isLoading}>
								<Text
									sx={{
										...styles.valueText,
										color: totalPayable > 0 ? PAGE_COLORS.danger : undefined,
									}}
								>
									{formatAmount(totalPayable)}
								</Text>
							</Skeleton>
						</GridItem>
					</Grid>
					<Flex
						sx={{
							...styles.actionsContainer,
							justifyContent: isArabic ? 'flex-start' : 'flex-end',
						}}
					>
						<Skeleton isLoaded={!isLoading}>
							<NotificationCircle
								productId={supplier.supplierId}
								showIfNoChanges={false}
								customStyles={{
									animationCircle: { width: '1.5rem', height: '1.5rem' },
								}}
							>
								<StateCircle
									stateColor="#929494"
									stateTitle="inactive"
									customStyles={{
										colorCircle: { width: '0.875rem', height: '0.875rem' },
									}}
								/>
							</NotificationCircle>
						</Skeleton>

						<Skeleton isLoaded={!isLoading}>
							<OptionsPopover />
						</Skeleton>
					</Flex>
				</AccordionPanel>
			</AccordionItem>
		</Accordion>
	)
}

export default SupplierListItemMobil
