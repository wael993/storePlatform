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
import { useUser } from '../../../shared/hooks/useUser'
import { PROMOTION_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { ProductSortHeaderKey, SortOrder } from '../../list/shared/globalEnums'
import {
	compareDatesForSorting,
	compareNumbersForSorting,
	compareStringsForSorting,
	getTableWidth,
	parseNumberForSorting,
} from '../../list/shared/utils'
import DraggableScrollContainer from '../../common/DraggableScrollContainer'
import TableRow from './ProductTableRow'
import TableHeaderRow from './ProductTableHeaderRow'

interface VirtuosoContext {
	listData: Product[]
	selectedProducts: string[]
	onSelect: (id: string) => void
	isLoading: boolean
	isInternalUser: boolean
}

const skeletonProduct: Product = {
	productId: 'skeleton-id-3',
	name: 'dummy',
	latinName: 'dummy',
	categoryId: 'dummy',
	status: 'active',
	supplierId: 'dummy',
	brandId: 'dummy',
	barcode: 'dummy',
	price: {
		purchasePrice: 0,
		retailPrice: 0,
		wholesalePrice: 0,
		semiWholesalePrice: 0,
		discount: 0,
		currency: 'USD',
	},
	attributes: {
		color: 'dummy',
	},
	updatedAt: new Date('2024-01-01T00:00:00.000Z'),
	createdAt: new Date('2024-01-01T00:00:00.000Z'),
} as Product

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
	const { listData, selectedProducts, onSelect, isLoading } =
		context as VirtuosoContext

	const product = listData[index]

	return (
		<TableRow
			key={product.productId}
			product={product}
			isSelected={selectedProducts.includes(product.productId)}
			tableRowProps={props}
			onSelect={onSelect}
			isLoading={isLoading}
		/>
	)
}

interface ProductTableDesktopProps {
	products?: Product[]
	isLoading: boolean
	onSelect: (productId: string) => void
	selectedProducts: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const ProductTableDesktop = memo(
	({
		products,
		isLoading,
		onSelect,
		selectedProducts,
		areAllItemsSelected,
		onAllItemsSelectedChange,
	}: ProductTableDesktopProps) => {
		const { isOwnerOrAdmin } = useUser()
		const [sortField, setSortField] = useState<ProductSortHeaderKey | null>(
			null,
		)
		const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)

		const sortedProducts = useMemo(() => {
			if (!products) return []
			const clonedProducts = structuredClone(products)
			if (sortField === null) {
				return clonedProducts
			}

			return clonedProducts.sort((a, b) => {
				switch (sortField) {
					case ProductSortHeaderKey.NAME: {
						return compareStringsForSorting(a.name, b.name, sortOrder)
					}

					case ProductSortHeaderKey.BARCODE: {
						return compareStringsForSorting(a.barcode, b.barcode, sortOrder)
					}
					case ProductSortHeaderKey.BRAND_NAME: {
						return compareStringsForSorting(a.brandId, b.brandId, sortOrder)
					}
					case ProductSortHeaderKey.CATEGORY_NAME: {
						return compareStringsForSorting(
							a.categoryName,
							b.categoryName,
							sortOrder,
						)
					}
					case ProductSortHeaderKey.SUPPLIER_NAME: {
						return compareStringsForSorting(
							a.supplierName,
							b.supplierName,
							sortOrder,
						)
					}
					case ProductSortHeaderKey.STOCK_QUANTITY: {
						return compareNumbersForSorting(
							a.price?.purchasePrice,
							b.price?.purchasePrice,
							sortOrder,
						)
					}
					case ProductSortHeaderKey.STOCK_MIN_QUANTITY: {
						return compareNumbersForSorting(
							a.price?.semiWholesalePrice,
							b.price?.semiWholesalePrice,
							sortOrder,
						)
					}
					case ProductSortHeaderKey.PRICE_BUY_COST: {
						return compareNumbersForSorting(
							parseNumberForSorting(a.price?.purchasePrice),
							parseNumberForSorting(b.price?.purchasePrice),
							sortOrder,
						)
					}
					case ProductSortHeaderKey.PRICE_SELL: {
						return compareNumbersForSorting(
							parseNumberForSorting(a.price?.retailPrice),
							parseNumberForSorting(b.price?.retailPrice),
							sortOrder,
						)
					}
					case ProductSortHeaderKey.DISCOUNT: {
						return compareNumbersForSorting(
							parseNumberForSorting(a.price?.discount),
							parseNumberForSorting(b.price?.discount),
							sortOrder,
						)
					}
					// case ProductSortHeaderKey.LOCATION_SHELF: {
					// 	return compareStringsForSorting(
					// 		a.attributes?.color,
					// 		b.attributes?.color,
					// 		sortOrder,
					// 	)
					// }
					// case ProductSortHeaderKey.LOCATION_WAREHOUSE: {
					// 	return compareStringsForSorting(
					// 		a.attributes?.color,
					// 		b.attributes?.color,
					// 		sortOrder,
					// 	)
					// }
					case ProductSortHeaderKey.COLOR: {
						return compareStringsForSorting(
							a.attributes?.color,
							b.attributes?.color,
							sortOrder,
						)
					}
					case ProductSortHeaderKey.START_DATE: {
						return compareDatesForSorting(
							a.attributes?.expiryDate?.toString(),
							b.attributes?.expiryDate?.toString(),
							sortOrder,
						)
					}

					default: {
						return 0
					}
				}
			})
		}, [products, sortField, sortOrder])

		const onSort = (
			field: ProductSortHeaderKey | null,
			order: SortOrder | null,
		) => {
			setSortField(field)
			setSortOrder(order)
		}

		const listData = useMemo(() => {
			return sortedProducts.length === 0 && isLoading
				? Array(5).fill(skeletonProduct)
				: sortedProducts
		}, [sortedProducts, isLoading])

		const context: VirtuosoContext = {
			listData,
			selectedProducts,
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
							<TableHeaderRow
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

ProductTableDesktop.displayName = 'Table'

export default ProductTableDesktop
