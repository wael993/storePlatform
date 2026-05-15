import { Td, Checkbox, Flex, Text, Skeleton } from '@chakra-ui/react'
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
		const activityState = { color: 'green', translationKey: 'active' }
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
				background: `linear-gradient(to right, transparent 0rem, transparent 2rem, #FFFFFF 3.5rem, #FFFFFF 2rem, #FFFFFF ${PROMOTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem)`,
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
								e.stopPropagation()
							}}
							cursor={'pointer'}
						>
							<Skeleton isLoaded={!isLoading}>
								<Checkbox
									pointerEvents={'none'}
									isChecked={isSelected}
									zIndex={2}
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
								{activityType}
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
							{activityData.location ? (
								<Text sx={styles.text}>{activityData._id}</Text>
							) : (
								<>
									<Text sx={styles.text}>{shopObject?.locationName ?? ''}</Text>
									<Text sx={styles.text}>{shopObject?.name ?? ''}</Text>
								</>
							)}
						</Skeleton>
					</Flex>
				</Td>

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
							<Text sx={styles.text}>{activityData.brand}</Text>
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
								value={activityData.supplier?.name}
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
									value={activityData.price.sell.toString()}
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

				{/* Promoter Count (editable) */}
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
								value={activityData.price.discount?.toString()}
								ariaLabel={t('common.promoterPerDay')}
								onEdit={async (_editedValue: string) => {
									return
								}}
								isEditable={true}
								customStyles={cellFieldStyles}
								fontColor={'#1E1E1E'}
								numberInputFontSize="0.875rem"
								isLoading={patchActivityProgressState.isPromoterCountInProgress}
							/>
						</Skeleton>
					</Flex>
				</Td>

				<Td sx={{ ...styles.tableRow, ...styles.rightStickyContainer }}>
					<Flex sx={styles.rightStickyContainerContent}>
						{/* Tags */}
						<Flex sx={styles.cellContentWrapperSticky}>
							<Skeleton isLoaded={!isLoading}>
								<></>
							</Skeleton>
						</Flex>
						{/* Notification Circle & State Circle */}
						<Flex sx={styles.cellContentWrapperSticky}>
							<Skeleton isLoaded={!isLoading}>
								<></>
								{/* <NotificationCircle
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
								</NotificationCircle> */}
							</Skeleton>
						</Flex>
						{/* Chat Icon */}
						{canAddProduct && (
							<Flex
								sx={{ ...styles.cellContentWrapperSticky, marginLeft: '1rem' }}
							>
								<Skeleton isLoaded={!isLoading}>
									{/* <CommentCellField
										activityId={activity.id}
										location={activity.locationCustomer ?? ''}
										referenceId={activity.referenceId ?? ''}
										eventType={eventType}
										iconSize={'1.1rem'}
										vendorsIds={
											activity.supplierId ? [activity.supplierId] : undefined
										}
									/> */}
								</Skeleton>
							</Flex>
						)}
					</Flex>
				</Td>
			</>
		)
	},
)

ListItem.displayName = 'ListItem'

export default ListItem
