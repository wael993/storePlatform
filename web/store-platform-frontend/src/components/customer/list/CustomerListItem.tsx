import {
	Td,
	Checkbox,
	Flex,
	Text,
	Skeleton,
	useDisclosure,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useDeleteCustomerMutation } from '../../../api/apiStore'
import useCustomToast from '../../common/CustomToast'
import { CUSTOMER_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import { listStyles } from '../../../shared/styles'
import OptionsPopover from '../../modals/OptionsPopover'
import NotificationCircle from '../../NotificationCircle'
import StateCircle from '../../StateCircle'
import { PAGE_COLORS } from '../../SellingInvoice/constants'
import { useInvoiceDisplayCurrency } from '../../SellingInvoice/useInvoiceDisplayCurrency'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'

const styles = {
	tableRow: {
		padding: 0,
		height: 0,
		'@-moz-document url-prefix()': {
			height: '100%',
		},
	},
	checkboxRow: {
		left: '0',
		position: 'sticky',
		zIndex: 1,
		backgroundColor: '#FFFFFF',
	},
	cellContentWrapper: {
		...listStyles.tableCell,
		height: '100%',
		width: '100%',
		alignItems: 'center',
		justifyContent: 'start',
	},
	rightStickyContainerContent: {
		gap: '1rem',
		alignItems: 'center',
		justifyContent: 'flex-end',
		width: '14rem',
	},
	cellContentWrapperSticky: {
		height: '100%',
		alignItems: 'center',
		justifyContent: 'start',
	},
	checkboxWrapper: {
		padding: 0,
	},
	text: {
		...listStyles.tableCellText,
	},
	rightStickyContainer: {
		width: `${CUSTOMER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`,
		position: 'sticky',
		right: '0',
		zIndex: '1',
		background: `linear-gradient(to right, transparent 0rem, transparent 0rem, #FFFFFF 7rem, #FFFFFF 2rem, #FFFFFF ${CUSTOMER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem)`,
	},
	topSectionMenu: {
		boxSize: 7,
		bg: 'transparent',
		fontSize: 'xl',
		color: '#1E1E1E',
		...hoverFocusActiveButtonStyles,
	},
	actionItem: {
		py: '0.875rem',
		alignItems: 'center',
		cursor: 'pointer',
	},
	skeletonText: {
		width: '13rem',
		height: '1.5rem',
	},
	icon: {
		fontSize: '1.5rem',
		color: '#929494',
	},
} satisfies StylesObject

interface CustomerListItemProps {
	customer: Customer
	onSelect: (id: string) => void
	isSelected: boolean
	isHovered: boolean
	isLoading: boolean
}

const CustomerListItem = ({
	customer,
	onSelect,
	isSelected,
	isHovered,
	isLoading,
}: CustomerListItemProps) => {
	const { formatAmount } = useInvoiceDisplayCurrency()
	const { t } = useTranslation()
	const { canSee } = useSee()
	const canDelete = canSee(SEE.customersDelete)
	const showCheckbox = canDelete
	const isReadyForExecution = false
	const totalReceivable = customer.totalReceivable ?? 0
	const showToast = useCustomToast()
	const {
		isOpen: isDeleteOpen,
		onOpen: onDeleteOpen,
		onClose: onDeleteClose,
	} = useDisclosure()
	const [deleteCustomer, { isLoading: isDeleting }] =
		useDeleteCustomerMutation()

	return (
		<>
			{showCheckbox && (
				<Td
					sx={{
						...styles.tableRow,
						...styles.checkboxRow,

						backgroundColor: isHovered ? '#F4F4F4' : '#FFFFFF',
					}}
				>
					<Flex
						sx={{
							...styles.cellContentWrapper,
							...styles.checkboxWrapper,

							backgroundColor: isHovered ? '#F4F4F4' : '#FFFFFF',
						}}
						onClick={e => {
							onSelect(customer.customerId)

							e.stopPropagation()
						}}
						cursor={'pointer'}
					>
						<Skeleton isLoaded={!isLoading}>
							<Checkbox
								pointerEvents={'none'}
								isChecked={isSelected}
								zIndex={2}
								padding={4}
							/>
						</Skeleton>
					</Flex>
				</Td>
			)}
			<Td sx={styles.tableRow}>
				<Flex sx={styles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text
							sx={{
								...styles.text,
								fontWeight: 500,
								color:
									isReadyForExecution && !isHovered ? '#B2B2B2' : '#1E1E1E',
							}}
						>
							{customer.name}
						</Text>
					</Skeleton>
				</Flex>
			</Td>
			<Td sx={styles.tableRow}>
				<Flex sx={styles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={{ ...styles.text, fontWeight: 500 }}>
							{customer.internalCode}
						</Text>
					</Skeleton>
				</Flex>
			</Td>

			{canSee(SEE.customersTotalReceivable) ? (
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text
								sx={{
									...styles.text,
									fontWeight: totalReceivable > 0 ? 600 : 500,
									color:
										totalReceivable > 0
											? PAGE_COLORS.danger
											: PAGE_COLORS.success,
								}}
							>
								{formatAmount(totalReceivable)}
							</Text>
						</Skeleton>
					</Flex>
				</Td>
			) : null}

			<Td sx={{ ...styles.tableRow, ...styles.rightStickyContainer, right: 1 }}>
				<Flex sx={styles.rightStickyContainerContent}>
					{/* Notification Circle & State Circle */}
					<Flex sx={styles.cellContentWrapperSticky}>
						<Skeleton isLoaded={!isLoading}>
							<NotificationCircle
								productId={customer.customerId}
								showIfNoChanges={true}
								customStyles={{
									animationCircle: { width: '1.5rem', height: '1.5rem' },
								}}
							>
								<StateCircle
									stateColor={
										totalReceivable > 0
											? PAGE_COLORS.danger
											: PAGE_COLORS.success
									}
									stateTitle={
										totalReceivable > 0
											? 'common.inactive'
											: 'common.active'
									}
									customStyles={{
										colorCircle: { width: '0.875rem', height: '0.875rem' },
									}}
								/>
							</NotificationCircle>
						</Skeleton>
					</Flex>
					<Flex sx={styles.cellContentWrapperSticky}>
						<Skeleton isLoaded={!isLoading}>
							{canDelete ? (
								<OptionsPopover
									onDelete={onDeleteOpen}
									deleteLabel={t('components.customer.deleteCustomer')}
								/>
							) : null}
						</Skeleton>
					</Flex>
				</Flex>
			</Td>
			<ConfirmationDialog
				header={t('components.customer.deleteCustomer')}
				body={t('components.customer.deleteCustomerConfirm')}
				isOpen={isDeleteOpen}
				onClose={onDeleteClose}
				onConfirm={async () => {
					try {
						await deleteCustomer(customer.customerId).unwrap()
						onDeleteClose()
						showToast({
							status: 'success',
							description: t('components.customer.deleteCustomerSuccess'),
						})
					} catch (error) {
						const err = error as { data?: { message?: string } }

						showToast({
							status: 'error',
							description:
								err.data?.message ||
								t('components.customer.deleteCustomerError'),
						})
					}
				}}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeleting}
			/>
		</>
	)
}

export default CustomerListItem
