import {
	Td,
	Checkbox,
	Flex,
	Text,
	Skeleton,
	Popover,
	useDisclosure,
	PopoverTrigger,
	IconButton,
	PopoverBody,
	PopoverContent,
	Icon,
} from '@chakra-ui/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import StateCircle from '../StateCircle'

// import CommentCellField from './CommentCellField'
import { formatDate } from '../../shared/dateUtils'
// import TaggingButtons from '../common/TaggingButtons'
// import { ListActivity } from './ListWithActionBar'
import NotificationCircle from '../NotificationCircle'
// import {
// 	getMapActivityType,
// 	getPromoActivityBrandsText,
// 	isActivityNegotiationEditable,
// } from '../../shared/activityHelper'

import { useUser } from '../../shared/hooks/useUser'
// import { useListItem } from './hooks/useListItem'

// import { useOptimisticDataContext } from '../../shared/hooks/useOptimisticDataContext'

import useAllowedActions from '../../shared/hooks/useAllowedActions'
import EditableCellField from './EditableCellField'
import { cellFieldStyles, listStyles } from '../../shared/styles'
import { PROMOTION_LIST_WIDTHS_MAP_IN_REM } from './shared/constants'
import { ACTIVITY_TYPE } from '../../shared/globalEnums'
import { ThreeDotsIcon } from '../../icons/ThreeDots'
import hoverFocusActiveButtonStyles from '../../theme'
import { AsEmptyCheckmarkCircleIcon } from '../icons/EmptyCheckmarkCircle'
interface ListItemProps {
	activity: ProductApi
	onSelect: (activityId: string) => void
	isSelected: boolean
	isHovered: boolean
	isLoading: boolean
}
const ListItem = memo(
	({
		activity: activityData,
		onSelect,
		isSelected,
		isHovered,
		isLoading,
	}: ListItemProps) => {
		// const { setOneOptimisticItemFromId } = useOptimisticDataContext()
		// const {
		// 	activity,
		// 	handleEditSupplierFocus,
		// 	handleEditRentalFee,
		// 	handleEditPromoterFee,
		// 	handleEditPromoterCount,
		// 	showCheckbox,
		// 	eventType,
		// 	activityState,
		// 	isReadyForExecution,
		// 	shopObject,
		// 	patchActivityProgressState,
		// } = useListItem(activityData)
		const showCheckbox = true
		const eventType = 'dummyEventType'
		const activityState = { color: 'red', translationKey: 'active' }
		const isReadyForExecution = false
		const shopObject = { locationName: 'dummyLocation', name: 'dummyShop' }
		const patchActivityProgressState = {
			isSupplierFocusInProgress: false,
			isRentalFeeInProgress: false,
			isPromoterFeeInProgress: false,
			isPromoterCountInProgress: false,
		}

		const { t } = useTranslation()
		const { isOwnerOrAdmin } = useUser()
		const {
			canAddProduct,
			canAddReport,
			canDeleteProduct,
			canEditProduct,
			canDeleteReport,
			canEditReport,
		} = useAllowedActions()
		const {
			isOpen: isPopoverOpen,
			onOpen: onPopoverOpen,
			onClose: onPopoverClose,
		} = useDisclosure()
		const getMapActivityType = (activityType: any) => {
			switch (activityType) {
				case ACTIVITY_TYPE.PRICE:
					return t('common.price')
				case ACTIVITY_TYPE.PROMOTIONS:
					return t('common.promo')
				default:
					return t('appTitle')
			}
		}

		const activityType = getMapActivityType(eventType)

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
				backgroundColor: isHovered ? '#F4F4F4' : '#FFFFFF',
				padding: 0,
			},
			text: {
				...listStyles.tableCellText,
				color: isReadyForExecution && !isHovered ? '#B2B2B2' : '#1E1E1E',
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

		return (
			<>
				{/* Checkbox */}
				{showCheckbox && (
					<Td sx={{ ...styles.tableRow, ...styles.checkboxRow }}>
						<Flex
							sx={{ ...styles.cellContentWrapper, ...styles.checkboxWrapper }}
							onClick={e => {
								onSelect(activityData._id)
								console.log(activityData._id)

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

				{/* Ticket Type */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={{ ...styles.text, fontWeight: 500 }}>
								{activityData.name}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Sales Area */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={{ ...styles.text, fontWeight: 500 }}>
								{activityData.barcode}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Location Customer */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>{activityData.brand}</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Time Frame */}

				{/* Package Name / Location Name */}
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
							<Text sx={styles.text}>{activityData.category?.name ?? '-'}</Text>
						</Skeleton>
					</Flex>
				</Td>

				{canAddProduct && (
					<Td sx={styles.tableRow}>
						<Flex
							sx={{
								...styles.cellContentWrapper,
								padding: isLoading ? '1rem' : 0,
								justifyContent: 'flex-end',
								paddingRight: '1.5rem',
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<EditableCellField
									value={activityData.price.buy.toString()}
									isNumberField={true}
									minimumDecimals={0}
									ariaLabel={t('common.rentalFee')}
									onEdit={async (_editedValue: string) => {
										return
									}}
									currency={'€'}
									isEditable={true}
									customStyles={cellFieldStyles}
									fontColor={'#1E1E1E'}
									isLoading={patchActivityProgressState.isRentalFeeInProgress}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}

				{/* Supplier (A&P only) */}
				{isOwnerOrAdmin && (
					<Td sx={{ ...styles.tableRow }}>
						<Flex sx={{ ...styles.cellContentWrapper }}>
							<Skeleton isLoaded={!isLoading}>
								<Text sx={styles.text}>
									{activityData.supplier?.name ?? ''}
								</Text>
							</Skeleton>
						</Flex>
					</Td>
				)}

				{/* Brands / Preferred Brands */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>{activityData.stock.quantity}</Text>
						</Skeleton>
					</Flex>
				</Td>

				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>{activityData.stock.quantity}</Text>
						</Skeleton>
					</Flex>
				</Td>
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>{activityData.stock.quantity}</Text>
						</Skeleton>
					</Flex>
				</Td>
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>{activityData.stock.quantity}</Text>
						</Skeleton>
					</Flex>
				</Td>
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>{activityData.stock.quantity}</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Supplier Focus (editable) */}
				<Td sx={styles.tableRow}>
					<Flex
						sx={{
							...styles.cellContentWrapper,
							padding: isLoading ? '1rem' : 0,
						}}
					>
						<Skeleton isLoaded={!isLoading}>
							<EditableCellField
								value={activityData.location?.warehouse ?? ''}
								isNumberField={false}
								ariaLabel={t('common.focus')}
								placeholder={t('common.addFocus')}
								onEdit={async (_editedValue: string) => {
									return
								}}
								isEditable={true}
								customStyles={{
									...cellFieldStyles,
									valueText: {
										...cellFieldStyles.valueText,
										textAlign: 'left',
									},
								}}
								fontColor={'#1E1E1E'}
								isLoading={patchActivityProgressState.isSupplierFocusInProgress}
							/>
						</Skeleton>
					</Flex>
				</Td>

				{/* Rental Fee (editable) */}

				{/* Promoter Fee (editable) */}
				{canAddProduct && (
					<Td sx={styles.tableRow}>
						<Flex
							sx={{
								...styles.cellContentWrapper,
								padding: isLoading ? '1rem' : 0,
								justifyContent: 'flex-end',
								paddingRight: '1.5rem',
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<EditableCellField
									value={activityData.location?.shelf ?? ''}
									minimumDecimals={0}
									isNumberField={true}
									ariaLabel={t('common.promoterFee')}
									onEdit={async (_editedValue: string) => {
										return
									}}
									currency={'€'}
									isEditable={true}
									customStyles={cellFieldStyles}
									fontColor={'#1E1E1E'}
									isLoading={patchActivityProgressState.isPromoterFeeInProgress}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}

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
								{activityData.name ? formatDate(new Date()) : ''}
							</Text>
							<Text sx={styles.text}>
								{activityData.name ? formatDate(new Date()) : ''}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				<Td
					sx={{ ...styles.tableRow, ...styles.rightStickyContainer, right: 1 }}
				>
					<Flex sx={styles.rightStickyContainerContent}>
						{/* Notification Circle & State Circle */}
						<Flex sx={styles.cellContentWrapperSticky}>
							<Skeleton isLoaded={!isLoading}>
								<NotificationCircle
									activityId={activityData._id}
									showIfNoChanges={true}
									customStyles={{
										animationCircle: { width: '1.5rem', height: '1.5rem' },
									}}
								>
									<StateCircle
										stateColor={activityState?.color}
										stateTitle={activityState?.translationKey}
										customStyles={{
											colorCircle: { width: '0.875rem', height: '0.875rem' },
										}}
									/>
								</NotificationCircle>
							</Skeleton>
						</Flex>
						<Flex onClick={e => e.stopPropagation()}>
							<Popover
								placement={'bottom'}
								returnFocusOnClose={false}
								isOpen={isPopoverOpen}
								onOpen={onPopoverOpen}
								onClose={onPopoverClose}
							>
								<PopoverTrigger>
									<IconButton
										sx={styles.topSectionMenu}
										aria-label="topSectionMenu"
										icon={<ThreeDotsIcon />}
										boxSize={7}
									/>
								</PopoverTrigger>
								<PopoverContent>
									<PopoverBody>
										<Flex
											onClick={() => {
												console.log('TO_DO')
											}}
											sx={styles.actionItem}
										>
											{false && <Skeleton sx={styles.skeletonText} />}
											<Icon sx={styles.icon} as={AsEmptyCheckmarkCircleIcon} />
											<Text>TO_DO</Text>
										</Flex>
									</PopoverBody>
								</PopoverContent>
							</Popover>
						</Flex>
					</Flex>
				</Td>
			</>
		)
	},
)

ListItem.displayName = 'ListItem'

export default ListItem
