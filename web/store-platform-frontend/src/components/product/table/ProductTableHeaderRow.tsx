import { Tr, Th, Text, Flex, Checkbox, Box } from '@chakra-ui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AllowedActions } from '../../../shared/globalEnums'
import useAllowedActions from '../../../shared/hooks/useAllowedActions'
import { useResources } from '../../../shared/hooks/useResources'
import { useUser } from '../../../shared/hooks/useUser'
import TableSort from '../../common/CustomTableSort'
import { PROMOTION_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { ProductSortHeaderKey, SortOrder } from '../../list/shared/globalEnums'
import { isTruthy } from '../../list/shared/utils'

interface ProductTableHeaderRowProps {
	sortField: ProductSortHeaderKey | null
	sortOrder: SortOrder | null
	onSort: (field: ProductSortHeaderKey | null, order: SortOrder | null) => void
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const styles = {
	checkboxHeader: {
		left: '0',
		position: 'sticky',
		zIndex: 1,
		background: '#FFFFFF',
		padding: '4',
	},
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

const ProductTableHeaderRow = ({
	sortField,
	onSort,
	sortOrder,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: ProductTableHeaderRowProps) => {
	const { t } = useTranslation()
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
	const { isOwnerOrAdmin } = useUser()

	const { isActionAllowed } = useResources()
	const showCheckbox = true

	// areAnyActionsAllowed([
	// 	AllowedActions.ACCEPT_PROMO_ACTIVITY,
	// 	AllowedActions.REJECT_PROMO_ACTIVITY,
	// 	AllowedActions.SELECT_USER_ON_ACTIVITY,
	// 	AllowedActions.SELECT_ACTIVITY_WATCHER,
	// ])

	const handleSort = (sortingCell: ProductSortHeaderKey, order: SortOrder) => {
		onSort(sortingCell, order)
	}
	const {
		seeSupplier,
		seeStockQuantity,
		seeMinStockQuantity,
		seeDiscount,
		seeBuyCost,
		seeLocationShelf,
		seeLocationWarehouse,
	} = useAllowedActions()

	const getSortingButton = (sortKey: ProductSortHeaderKey) => {
		return (
			<TableSort
				handleSort={order => {
					handleSort(sortKey, order)
				}}
				sortingOrder={sortField === sortKey ? sortOrder : null}
			/>
		)
	}

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
			label: t('common.productName'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.NAME,
			sortKey: ProductSortHeaderKey.NAME,
		},
		// Sales Area
		{
			label: t('common.barcode'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.BARCODE,
			sortKey: ProductSortHeaderKey.BARCODE,
		},
		// Location
		{
			label: t('common.brand'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.BRAND,
			sortKey: ProductSortHeaderKey.BRAND_NAME,
		},
		// Timeframe
		{
			label: t('common.category'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.CATEGORY_NAME,
			sortKey: ProductSortHeaderKey.CATEGORY_NAME,
		},
		...(isOwnerOrAdmin && seeSupplier
			? [
					{
						label: t('common.supplierName'),
						width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.SUPPLIER_NAME,
						sortKey: ProductSortHeaderKey.SUPPLIER_NAME,
					},
				]
			: []),

		...(seeStockQuantity
			? [
					{
						label: t('common.stockQuantity'),
						width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.STOCK_QUANTITY,
						sortKey: ProductSortHeaderKey.STOCK_QUANTITY,
					},
				]
			: []),
		...(seeMinStockQuantity
			? [
					{
						label: t('common.stockMinQuantity'),
						width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.STOCK_MIN_QUANTITY,
						sortKey: ProductSortHeaderKey.STOCK_MIN_QUANTITY,
					},
				]
			: []),
		// buyCost (only if internal)
		...(isOwnerOrAdmin && seeBuyCost
			? [
					{
						label: t('common.buyCost'),
						width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.PRICE_BUY,
						sortKey: ProductSortHeaderKey.PRICE_BUY_COST,
					},
				]
			: []),

		{
			label: t('common.priceSell'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.PRICE_SELL,
			sortKey: ProductSortHeaderKey.PRICE_SELL,
		},
		...(seeDiscount
			? [
					{
						label: t('common.discount'),
						width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.DISCOUNT,
						sortKey: ProductSortHeaderKey.DISCOUNT,
					},
				]
			: []),
		// ...(seeLocationShelf
		// 	? [
		// 			{
		// 				label: t('common.locationShelf'),
		// 				width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.LOCATION_SHELF,
		// 				sortKey: ProductSortHeaderKey.LOCATION_SHELF,
		// 			},
		// 		]
		// 	: []),
		// ...(seeLocationWarehouse
		// 	? [
		// 			{
		// 				label: t('common.locationWarehouse'),
		// 				width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.LOCATION_WAREHOUSE,
		// 				sortKey: ProductSortHeaderKey.LOCATION_WAREHOUSE,
		// 			},
		// 		]
		// 	: []),
		// {
		// 	label: t('common.color'),
		// 	width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.COLOR,
		// 	sortKey: ProductSortHeaderKey.COLOR,
		// 	isShop: false,
		// 	align: 'right' as const,
		// },

		{
			label: t('common.createdAt'),
			width: PROMOTION_LIST_WIDTHS_MAP_IN_REM.STOCK_QUANTITY,
			sortKey: ProductSortHeaderKey.STOCK_QUANTITY,
			align: 'right' as const,
			isShop: false,
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
		<Tr background={'#fff'}>
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
								...styles.tableHeaderStickyRight,
								background: `linear-gradient(to right, transparent 0rem, transparent 0rem, #FFFFFF 7rem, #FFFFFF 2rem, #FFFFFF ${getStickyRightWidth()})`,
								width: `${header.width}rem`,
							}}
						/>
					)
				}

				return (
					<Th
						key={index}
						sx={styles.tableHeader}
						width={`${header.width}rem`}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						{header.isShop ? (
							<Flex alignItems="center" gap="0.25rem">
								<Flex alignItems={'start'} flexDir={'column'} gap={'0.25rem'}>
									<Text sx={{ ...styles.tableHeaderText, lineHeight: '1.2' }}>
										{t('common.shop')}
									</Text>
									<Text sx={styles.tableHeaderText}>
										{t('common.promotionSpace')}
									</Text>
								</Flex>
								{(hoveredIndex === index || sortField === header.sortKey) &&
									header.sortKey && (
										<Box sx={{ marginLeft: '0.5rem', marginTop: '0.25rem' }}>
											{getSortingButton(header.sortKey)}
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
									...styles.tableHeaderText,
									...(header.align === 'right'
										? { paddingRight: '1.5rem' }
										: {}),
								}}
							>
								<Text sx={styles.tableHeaderText}>{header.label}</Text>
								{(hoveredIndex === index || sortField === header.sortKey) &&
									header.sortKey && (
										<Box sx={{ marginLeft: '0.5rem' }}>
											{getSortingButton(header.sortKey)}
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
export default ProductTableHeaderRow
