import { Box, Table } from '@chakra-ui/react'
import React, {
	CSSProperties,
	ForwardedRef,
	memo,
	PropsWithChildren,
	useCallback,
	useMemo,
	useState,
} from 'react'
import { TableVirtuoso } from 'react-virtuoso'

import { useUser } from '../../shared/hooks/useUser'

import ListHeaderRow, { ListActivity } from './ListHeaderRow'
// import { ListActivity } from './ListWithActionBar'
import { PROMOTION_LIST_WIDTHS_MAP_IN_REM } from './shared/constants'
import { ProductSortHeaderKey, SortOrder } from './shared/globalEnums'
import {
	compareDatesForSorting,
	compareNumbersForSorting,
	compareStringsForSorting,
	getTableWidth,
	parseNumberForSorting,
} from './shared/utils'
import DraggableScrollContainer from '../common/DraggableScrollContainer'
import ListRow from './ListRow'

interface VirtuosoContext {
	listData: ProductApi[]
	selectedActivities: string[]
	onSelect: (activityId: string) => void
	isLoading: boolean
	isInternalUser: boolean
}

// const skeletonActivity: Activity = {
// 	dateFrom: '2024-01-01',
// 	dateTo: '2024-01-01',
// 	locationCustomer: 'dummy',
// 	salesAreaName: 'dummy',
// 	brands: [{ name: 'dummy' }],
// 	isPackage: true,
// 	packageName: 'dummy',
// 	id: 'dummy',
// 	supplier: 'dummy',
// } as Activity

const styles: StylesObject = {
	mainBoxWrapper: {
		width: '100%',
		display: 'flex',
		position: 'relative',
		flexDirection: 'column',
		height: '100%',
		zIndex: '0',
	},
	virtuoso: {
		width: '100%',
		position: 'relative',
		height: 'max(32rem,70vh)',
	},
}

const ScrollerComponent = (
	props: PropsWithChildren,
	forwardedRef: ForwardedRef<HTMLDivElement>,
) => {
	const styles: StylesObject = {
		scroller: {
			display: 'flex',
			flexDir: 'row',
			alignItems: 'start',
			position: 'relative',
			'&::-webkit-scrollbar': {
				height: '0',
			},
			width: '100%',
			scrollbarWidth: 'none',
			msOverflowStyle: 'none',
		},
	}
	return (
		<DraggableScrollContainer
			styles={styles.scroller}
			ref={forwardedRef}
			{...props}
		>
			{props.children}
		</DraggableScrollContainer>
	)
}
const Scroller = React.forwardRef<HTMLDivElement, PropsWithChildren<{}>>(
	ScrollerComponent,
)

const TableComponent = ({
	style,
	context,
	...props
}: {
	style?: CSSProperties
	context?: VirtuosoContext
}) => {
	const { isInternalUser } = context as VirtuosoContext
	const tableWidth = getTableWidth(
		PROMOTION_LIST_WIDTHS_MAP_IN_REM,
		isInternalUser,
		14,
		4,
	)

	return (
		<Table
			{...props}
			style={{
				...style,
			}}
			position={'relative'}
			layout={'fixed'}
			width={tableWidth}
		/>
	)
}
const TableRowComponent = (props: {
	'data-index': number
	context?: VirtuosoContext
}) => {
	const index = props['data-index']

	const context = props.context
	const { listData, selectedActivities, onSelect, isLoading } =
		context as VirtuosoContext

	const activity = listData[index]

	return (
		<ListRow
			key={activity._id}
			activity={activity}
			isSelected={selectedActivities.includes(activity._id)}
			tableRowProps={props}
			onSelect={onSelect}
			isLoading={isLoading}
		/>
	)
}

interface ListDesktopProps {
	activities?: ProductApi[]
	isLoading: boolean
	onSelect: (activityId: string) => void
	selectedActivities: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const ListDesktop = memo(
	({
		activities,
		isLoading,
		onSelect,
		selectedActivities,
		areAllItemsSelected,
		onAllItemsSelectedChange,
	}: ListDesktopProps) => {
		const { isOwnerOrAdmin } = useUser()
		const [sortField, setSortField] = useState<ProductSortHeaderKey | null>(
			null,
		)
		const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)

		const sortedActivities = useMemo(() => {
			if (!activities) return []
			const clonedActivities = structuredClone(activities)
			if (sortField === null) {
				// const sortedActivityData = getSortedPromoActivities(clonedActivities)
				// return Object.values(sortedActivityData).flat()
				return clonedActivities
			}

			return clonedActivities.sort((a, b) => {
				switch (sortField) {
					case ProductSortHeaderKey.NAME: {
						return compareStringsForSorting(a.name, b.name, sortOrder)
					}

					case ProductSortHeaderKey.BARCODE: {
						return compareStringsForSorting(a.barcode, b.barcode, sortOrder)
					}
					case ProductSortHeaderKey.BRAND_ID: {
						return compareStringsForSorting(a.brandId, b.brandId, sortOrder)
					}
					case ProductSortHeaderKey.CATEGORY_ID: {
						return compareStringsForSorting(
							a.categoryId,
							b.categoryId,
							sortOrder,
						)
					}
					case ProductSortHeaderKey.PRICE_BUY_COST: {
						return compareNumbersForSorting(
							parseNumberForSorting(a.price?.buyCost),
							parseNumberForSorting(b.price?.buyCost),
							sortOrder,
						)
					}
					case ProductSortHeaderKey.SUPPLIER_ID: {
						return compareStringsForSorting(
							a.supplierId,
							b.supplierId,
							sortOrder,
						)
					}
					// 	case ProductSortHeaderKey.PRICE_SELL: {
					// 	return compareNumbersForSorting(
					// 		parseNumberForSorting(a.price.sell),
					// 		parseNumberForSorting(b.price.sell),
					// 		sortOrder,
					// 	)
					// }
					case ProductSortHeaderKey.STOCK_QUANTITY: {
						return compareNumbersForSorting(
							a.stock.quantity,
							b.stock.quantity,
							sortOrder,
						)
					}
					case ProductSortHeaderKey.LOCATION_WAREHOUSE: {
						return compareStringsForSorting(
							a.location?.warehouse,
							b.location?.warehouse,
							sortOrder,
						)
					}
					case ProductSortHeaderKey.LOCATION_SHELF: {
						return compareStringsForSorting(
							a.location?.shelf,
							b.location?.shelf,
							sortOrder,
						)
					}

					// case ProductSortHeaderKey.SHOP: {
					// 	const aShop = getPromoShop(a)
					// 	const bShop = getPromoShop(b)

					// 	const formatShopName = (shop: typeof aShop) =>
					// 		`${shop?.locationName ?? ''} ${shop?.name ?? ''}`.trim()

					// 	const getPackageName = (activity: typeof a) => {
					// 		const trimmedPackageName = activity.packageName?.trim()
					// 		return activity.isPackage && trimmedPackageName
					// 			? trimmedPackageName
					// 			: undefined
					// 	}

					// 	const aName = getPackageName(a) || formatShopName(aShop)
					// 	const bName = getPackageName(b) || formatShopName(bShop)
					// 	return compareStringsForSorting(aName, bName, sortOrder)
					// }

					// case ProductSortHeaderKey.BRAND: {
					// 	const aBrand = getPromoActivityBrandsText(a)
					// 	const bBrand = getPromoActivityBrandsText(b)
					// 	return compareStringsForSorting(aBrand, bBrand, sortOrder)
					// }
					// case ProductSortHeaderKey.START_DATE: {
					// 	return compareStringsForSorting(
					// 		a.brand?.trim() ?? '',
					// 		b.brand?.trim() ?? '',
					// 		sortOrder,
					// 	)
					// }

					// case ProductSortHeaderKey.START_DATE: {
					// 	return compareDatesForSorting(a.dateFrom, b.dateFrom, sortOrder)
					// }

					default: {
						return 0
					}
				}
			})
		}, [activities, sortField, sortOrder])

		const onSort = (
			field: ProductSortHeaderKey | null,
			order: SortOrder | null,
		) => {
			setSortField(field)
			setSortOrder(order)
		}

		const listData = useMemo(() => {
			return sortedActivities.length === 0 && isLoading
				? sortedActivities // Array(5).fill(skeletonActivity)
				: sortedActivities
		}, [sortedActivities, isLoading])

		const context: VirtuosoContext = {
			listData,
			selectedActivities,
			onSelect,
			isLoading,
			isInternalUser: isOwnerOrAdmin,
		}

		return (
			<Box sx={styles.mainBoxWrapper}>
				<TableVirtuoso
					style={styles.virtuoso as CSSProperties}
					data={listData}
					context={context}
					overscan={{ main: 500, reverse: 500 }}
					components={{
						Scroller: Scroller,
						Table: TableComponent,
						TableRow: TableRowComponent,
					}}
					fixedHeaderContent={useCallback(
						() => (
							<ListHeaderRow
								sortField={sortField}
								sortOrder={sortOrder}
								onSort={onSort}
								onAllItemsSelectedChange={onAllItemsSelectedChange}
								areAllItemsSelected={areAllItemsSelected}
							/>
						),
						[
							sortOrder,
							sortField,
							onAllItemsSelectedChange,
							areAllItemsSelected,
						],
					)}
				/>
			</Box>
		)
	},
)

ListDesktop.displayName = 'List'

export default ListDesktop
