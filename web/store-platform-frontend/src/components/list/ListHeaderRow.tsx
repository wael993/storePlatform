import { Tr, Th, Text, Flex, Checkbox, Box } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useResources } from '../../shared/hooks/useResources'
import { useState } from 'react'
import { PromoSortHeaderKey, SortOrder } from './shared/globalEnums'
import { useUser } from '../../shared/hooks/useUser'
import { AllowedActions } from '../../shared/globalEnums'
import { isTruthy } from './shared/utils'
import { PROMOTION_LIST_WIDTHS_MAP_IN_REM } from './shared/constants'
import TableSort from '../common/CustomTableSort'
import useAllowedActions from '../../shared/hooks/useAllowedActions'

export type ListActivity = Activity & {
	isAcceptable: boolean
	isRejectable: boolean
}

const listStyles = {
	tableHeader: {
		paddingY: '1rem',
		paddingX: '0.375rem',
	},
	tableHeaderText: {
		fontStyle: 'normal',
		textTransform: 'none',
		color: '#939596',
		fontSize: '0.625rem',
		fontWeight: 500,
		lineHeight: '1.2rem',
		letterSpacing: 'normal',
		whiteSpace: 'nowrap',
	},
	tableCell: {
		paddingY: '1rem',
		paddingX: '0.375rem',
	},
	tableCellText: {
		fontWeight: 500,
		color: '#1E1E1E',
		fontSize: '0.875rem',
		lineHeight: '1.2rem',
		overflowWrap: 'anywhere',
	},
	tableHeaderStickyRight: {
		position: 'sticky',
		right: 0,
		zIndex: 4,
		height: '3rem',
		margin: 0,
		padding: 0,
	},
} satisfies StylesObject

const styles = {
	checkboxHeader: {
		left: '0',
		position: 'sticky',
		zIndex: 1,
		background: '#FFFFFF',
		padding: '0',
	},
} satisfies StylesObject

interface ListHeaderRowProps {
	sortField: keyof ListActivity | null
	sortOrder: SortOrder | null
	onSort: (field: keyof ListActivity | null, order: SortOrder | null) => void
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const ListHeaderRow = ({
	sortField,
	onSort,
	sortOrder,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: ListHeaderRowProps) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
	const { t } = useTranslation()
	const { isOwnerOrAdmin } = useUser()

	const { isActionAllowed } = useResources()
	const showCheckbox = true

	// areAnyActionsAllowed([
	// 	AllowedActions.ACCEPT_PROMO_ACTIVITY,
	// 	AllowedActions.REJECT_PROMO_ACTIVITY,
	// 	AllowedActions.SELECT_USER_ON_ACTIVITY,
	// 	AllowedActions.SELECT_ACTIVITY_WATCHER,
	// ])

	const handleSort = (sortingCell: keyof ListActivity, order: SortOrder) => {
		onSort(sortingCell, order)
	}
	const { canAddProduct } = useAllowedActions()

	const getSortingButton = (sortKey: keyof ListActivity) => (
		<TableSort
			handleSort={order => {
				handleSort(sortKey, order)
			}}
			sortingOrder={sortField === sortKey ? sortOrder : null}
		/>
	)

	const headers = [
		// Checkbox (no hover)
		...(showCheckbox
			? [
					{
						label: null,
						width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.CHECKBOX,
						sortKey: null,
						isCheckbox: true,
					},
				]
			: []),
		// Ticket Type (not sortable)
		{
			label: t('common.ticketType'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.TICKET_TYPE,
			sortKey: null,
		},
		// Sales Area
		{
			label: t('common.salesArea'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.SALES_AREA,
			sortKey: PromoSortHeaderKey.SALES_AREA,
		},
		// Location
		{
			label: t('common.location'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.LOCATION,
			sortKey: PromoSortHeaderKey.LOCATION,
		},
		// Timeframe
		{
			label: t('common.timeframe'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.TIME_FRAME,
			sortKey: PromoSortHeaderKey.START_DATE,
		},
		// Shop
		{
			label: null,
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.SHOP,
			sortKey: PromoSortHeaderKey.SHOP,
			isShop: true,
		},
		// Supplier (only if internal)
		...(isOwnerOrAdmin
			? [
					{
						label: t('common.supplier'),
						width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.SUPPLIER,
						sortKey: PromoSortHeaderKey.SUPPLIER,
					},
				]
			: []),
		// Brand
		{
			label: t('components.list.preferredBrand'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.PREFERRED_BRAND,
			sortKey: PromoSortHeaderKey.BRAND,
		},
		// Focus
		{
			label: t('common.focus'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.FOCUS,
			sortKey: PromoSortHeaderKey.FOCUS,
		},
		// Placement Fee
		canAddProduct && {
			label: t('common.placementFee'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.PLACEMENT_FEE,
			sortKey: PromoSortHeaderKey.PLACEMENT_FEE,
			align: 'right' as const,
		},
		// Promoter Fee
		canAddProduct && {
			label: t('common.promoterFee'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.PROMOTER_FEE,
			sortKey: PromoSortHeaderKey.PROMOTER_FEE,
			align: 'right' as const,
		},
		// Promoter per Day
		{
			label: t('common.promoterPerDay'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.PROMOTER_PER_DAY,
			sortKey: PromoSortHeaderKey.PROMOTER_PER_DAY,
			align: 'right' as const,
		},
		// Sticky Right
		{
			label: null,
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT,
			sortKey: null,
			isStickyRight: true,
		},
	].filter(isTruthy)

	const getStickyRightWidth = () => {
		//change this later
		const isAcceptingAllowed = isActionAllowed(AllowedActions.ADD_PRODUCT)
		const isRejectingAllowed = isActionAllowed(AllowedActions.ADD_PRODUCT)
		if (isAcceptingAllowed && isRejectingAllowed) {
			return `${PROMOTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`
		}
		if (isAcceptingAllowed || isRejectingAllowed) {
			return `${PROMOTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT - 4}rem`
		}
		return `${PROMOTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT - 7}rem`
	}

	return (
		<Tr background={'#FFFFFF'}>
			{headers.map((header, index) => {
				if (header.isCheckbox) {
					return (
						<Th
							key={index}
							sx={styles.checkboxHeader}
							width={`${header.width}rem`}
						>
							<Checkbox
								isChecked={areAllItemsSelected}
								onChange={onAllItemsSelectedChange}
							/>
						</Th>
					)
				}

				if (header.isStickyRight) {
					return (
						<Th
							key={index}
							sx={{
								...listStyles.tableHeaderStickyRight,
								background: `linear-gradient(to right, transparent 0rem, transparent 2rem, #FFFFFF 3.5rem, #FFFFFF 2rem, #FFFFFF ${getStickyRightWidth()})`,
								width: `${header.width}rem`,
							}}
						/>
					)
				}

				return (
					<Th
						key={index}
						sx={listStyles.tableHeader}
						width={`${header.width}rem`}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						{header.isShop ? (
							<Flex alignItems="center" gap="0.25rem">
								<Flex alignItems={'start'} flexDir={'column'} gap={'0.25rem'}>
									<Text
										sx={{ ...listStyles.tableHeaderText, lineHeight: '1.2' }}
									>
										{t('common.shop')}
									</Text>
									<Text sx={listStyles.tableHeaderText}>
										{t('common.promotionSpace')}
									</Text>
								</Flex>
								{(hoveredIndex === index || sortField === header.sortKey) &&
									header.sortKey && (
										<Box sx={{ marginLeft: '0.5rem', marginTop: '0.25rem' }}>
											{/* {getSortingButton(header.sortKey)} */}
										</Box>
									)}
							</Flex>
						) : (
							<Flex
								alignItems={'center'}
								justifyContent={
									header.align === 'right' ? 'flex-end' : undefined
								}
								sx={{
									...listStyles.tableHeaderText,
									...(header.align === 'right'
										? { paddingRight: '1.5rem' }
										: {}),
								}}
							>
								<Text sx={listStyles.tableHeaderText}>{header.label}</Text>
								{(hoveredIndex === index || sortField === header.sortKey) &&
									header.sortKey && (
										<Box sx={{ marginLeft: '0.5rem' }}>
											{/* {getSortingButton(header.sortKey)} */}
										</Box>
									)}
							</Flex>
						)}
					</Th>
				)
			})}
		</Tr>
	)
}
export default ListHeaderRow
