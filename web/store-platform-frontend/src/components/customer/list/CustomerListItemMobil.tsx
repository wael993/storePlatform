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
	statusContainer: {
		alignItems: 'center',
		gap: '1rem',
		justifyContent: 'flex-end',
	},
	actionsContainer: {
		mt: '2rem',
		alignItems: 'center',
		gap: '1.25rem',
		flexWrap: 'wrap',
	},
} satisfies StylesObject

interface CustomerListItemMobilProps {
	customer: Customer
	isLoading: boolean
	onSelect: (id: string) => void
	selectedCustomers: string[]
	isOpen: boolean
	onToggle: () => void
}

const CustomerListItemMobil = ({
	customer,
	isLoading,
	onSelect,
	selectedCustomers,
	isOpen,
	onToggle,
}: CustomerListItemMobilProps) => {
	const navigate = useNavigate()
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const { formatAmount } = useInvoiceDisplayCurrency()
	const totalReceivable = customer.totalReceivable ?? 0

	const onNavigate = (event: React.MouseEvent<HTMLDivElement>) => {
		event.stopPropagation()
		if (isLoading) return
		navigate(buildRoutePath.customerById(customer.customerId))
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
											onSelect(customer.customerId)
											event.stopPropagation()
										}}
										isChecked={selectedCustomers.includes(customer.customerId)}
										zIndex={2}
									/>
								</Skeleton>
							</Box>

							<Box
								sx={{ ...styles.listItemGridItem, flex: 1 }}
								onClick={onNavigate}
							>
								<Text sx={styles.titleText}>
									{t('components.customer.name')}
								</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(customer.name)}
									</Text>
								</Skeleton>
							</Box>

							<Box
								sx={{ ...styles.listItemGridItem, flex: 1 }}
								onClick={onNavigate}
							>
								<Text sx={styles.titleText}>
									{t('components.customer.code')}
								</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(customer.internalCode)}
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
								{t('components.invoiceSummary.totalReceivable')}
							</Text>
							<Skeleton isLoaded={!isLoading}>
								<Text
									sx={{
										...styles.valueText,
										color: totalReceivable > 0 ? PAGE_COLORS.danger : undefined,
									}}
								>
									{formatAmount(totalReceivable)}
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
								productId={customer.customerId}
								showIfNoChanges={true}
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

export default CustomerListItemMobil
