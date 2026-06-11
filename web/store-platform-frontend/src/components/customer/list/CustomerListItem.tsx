import { Td, Checkbox, Flex, Text, Skeleton } from '@chakra-ui/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '../../../shared/hooks/useUser'
import { PROMOTION_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import { listStyles } from '../../../shared/styles'
import useAllowedActions from '../../../shared/hooks/useAllowedActions'
import { formatDate } from '../../../shared/dateUtils'
import OptionsPopover from '../../modals/OptionsPopover'
import NotificationCircle from '../../NotificationCircle'
import StateCircle from '../../StateCircle'
import { mapFee } from '../../../shared/utils'

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
		width: `${PROMOTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`,
		position: 'sticky',
		right: '0',
		zIndex: '1',
		background: `linear-gradient(to right, transparent 0rem, transparent 0rem, #FFFFFF 7rem, #FFFFFF 2rem, #FFFFFF ${PROMOTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem)`,
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
	const showCheckbox = true
	const eventType = 'dummyEventType'
	const isReadyForExecution = false

	const { t } = useTranslation()
	const { isOwnerOrAdmin } = useUser()
	const {
		// seeCustomer,
		canEditStockQuantity,
		canEditMinStockQuantity,
		canEditWholesalePrice,
		canEditDiscount,
		canEditLocationShelf,
		canEditLocationWarehouse,
		canEditBuyCost,
		seeStockQuantity,
		seeMinStockQuantity,
		seeWholesalePrice,
		seeDiscount,
		seeBuyCost,
		seeLocationShelf,
		seeLocationWarehouse,
	} = useAllowedActions()

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
			<Td sx={styles.tableRow}>
				<Flex sx={styles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={{ ...styles.text, fontWeight: 500 }}>
							{mapFee(customer.sold.toString())}
						</Text>
					</Skeleton>
				</Flex>
			</Td>

			<Td sx={styles.tableRow}>
				<Flex
					sx={{
						...styles.cellContentWrapper,
						flexDirection: 'column',
						justifyContent: 'center',
						alignItems: 'start',
					}}
				>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={styles.text}>
							{customer.createdAt
								? formatDate(new Date(customer.createdAt))
								: ''}
						</Text>
						<Text sx={styles.text}>
							{customer.createdAt
								? formatDate(new Date(customer.createdAt))
								: ''}
						</Text>
					</Skeleton>
				</Flex>
			</Td>

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
									stateColor={'#929494'}
									stateTitle={'inactive'}
									customStyles={{
										colorCircle: { width: '0.875rem', height: '0.875rem' },
									}}
								/>
							</NotificationCircle>
						</Skeleton>
					</Flex>
					<Flex sx={styles.cellContentWrapperSticky}>
						<Skeleton isLoaded={!isLoading}>
							<OptionsPopover offer={'offer'} />
						</Skeleton>
					</Flex>
				</Flex>
			</Td>
		</>
	)
}

export default CustomerListItem
