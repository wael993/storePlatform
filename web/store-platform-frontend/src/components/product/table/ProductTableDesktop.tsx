import { Box, Flex, Table } from '@chakra-ui/react'
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
import { PROMOTION_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { ProductSortHeaderKey, SortOrder } from '../../list/shared/globalEnums'
import {
	compareDatesForSorting,
	compareNumbersForSorting,
	compareStringsForSorting,
	parseNumberForSorting,
} from '../../list/shared/utils'
import DraggableScrollContainer from '../../common/DraggableScrollContainer'
import ColumnPicker from '../../list/columnConfig/ColumnPicker'
import { useListColumnConfig } from '../../list/columnConfig/ListColumnConfigProvider'
import useAllowedActions from '../../../shared/hooks/useAllowedActions'
import TableRow from './ProductTableRow'
import TableHeaderRow from './ProductTableHeaderRow'

interface VirtuosoContext {
	listData: Product[]
	selectedProducts: string[]
	onSelect: (id: string) => void
	onEditProduct: (product: Product) => void
	isLoading: boolean
	tableWidth: string
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
	toolbar: {
		width: '100%',
		justifyContent: 'flex-end',
		flexShrink: 0,
		paddingX: '0.5rem',
		paddingBottom: '0.25rem',
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
	const { tableWidth } = context as VirtuosoContext

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
	const { listData, selectedProducts, onSelect, onEditProduct, isLoading } =
		context as VirtuosoContext

	const product = listData[index]

	return (
		<TableRow
			key={product.productId}
			product={product}
			isSelected={selectedProducts.includes(product.productId)}
			tableRowProps={props}
			onSelect={onSelect}
			onEditProduct={onEditProduct}
			isLoading={isLoading}
		/>
	)
}

interface ProductTableDesktopProps {
	products?: Product[]
	isLoading: boolean
	onSelect: (productId: string) => void
	onEditProduct: (product: Product) => void
	selectedProducts: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const ProductTableDesktop = memo(
	({
		products,
		isLoading,
		onSelect,
		onEditProduct,
		selectedProducts,
		areAllItemsSelected,
		onAllItemsSelectedChange,
	}: ProductTableDesktopProps) => {
		const { visibleColumns } = useListColumnConfig()
		const { canDeleteProduct } = useAllowedActions()
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
					case ProductSortHeaderKey.NAME:
						return compareStringsForSorting(a.name, b.name, sortOrder)
					case ProductSortHeaderKey.LATIN_NAME:
						return compareStringsForSorting(a.latinName, b.latinName, sortOrder)
					case ProductSortHeaderKey.BARCODE:
						return compareStringsForSorting(a.barcode, b.barcode, sortOrder)
					case ProductSortHeaderKey.INTERNAL_CODE:
						return compareStringsForSorting(
							a.internalCode,
							b.internalCode,
							sortOrder,
						)
					case ProductSortHeaderKey.PRODUCT_FACTORY_CODE:
						return compareStringsForSorting(
							a.productFactoryCode,
							b.productFactoryCode,
							sortOrder,
						)
					case ProductSortHeaderKey.BRAND_NAME:
						return compareStringsForSorting(a.brandName, b.brandName, sortOrder)
					case ProductSortHeaderKey.CATEGORY_NAME:
						return compareStringsForSorting(
							a.categoryName,
							b.categoryName,
							sortOrder,
						)
					case ProductSortHeaderKey.SUPPLIER_NAME:
						return compareStringsForSorting(
							a.supplierName,
							b.supplierName,
							sortOrder,
						)
					case ProductSortHeaderKey.UNIT_NAME:
						return compareStringsForSorting(a.unitName, b.unitName, sortOrder)
					case ProductSortHeaderKey.STATUS:
						return compareStringsForSorting(a.status, b.status, sortOrder)
					case ProductSortHeaderKey.STOCK_QUANTITY:
						return compareNumbersForSorting(
							a.inventory?.quantity,
							b.inventory?.quantity,
							sortOrder,
						)
					case ProductSortHeaderKey.STOCK_MIN_QUANTITY:
						return compareNumbersForSorting(
							a.inventory?.minQuantity,
							b.inventory?.minQuantity,
							sortOrder,
						)
					case ProductSortHeaderKey.LOCATION_WAREHOUSE:
						return compareStringsForSorting(
							a.warehouseName,
							b.warehouseName,
							sortOrder,
						)
					case ProductSortHeaderKey.LOCATION_SHELF:
						return compareStringsForSorting(a.shelfName, b.shelfName, sortOrder)
					case ProductSortHeaderKey.PRICE_BUY_COST:
						return compareNumbersForSorting(
							parseNumberForSorting(a.price?.purchasePrice),
							parseNumberForSorting(b.price?.purchasePrice),
							sortOrder,
						)
					case ProductSortHeaderKey.PRICE_SELL:
						return compareNumbersForSorting(
							parseNumberForSorting(a.price?.retailPrice),
							parseNumberForSorting(b.price?.retailPrice),
							sortOrder,
						)
					case ProductSortHeaderKey.PRICE_WHOLESALE:
						return compareNumbersForSorting(
							parseNumberForSorting(a.price?.wholesalePrice),
							parseNumberForSorting(b.price?.wholesalePrice),
							sortOrder,
						)
					case ProductSortHeaderKey.PRICE_SEMI_WHOLESALE:
						return compareNumbersForSorting(
							parseNumberForSorting(a.price?.semiWholesalePrice),
							parseNumberForSorting(b.price?.semiWholesalePrice),
							sortOrder,
						)
					case ProductSortHeaderKey.DISCOUNT:
						return compareNumbersForSorting(
							parseNumberForSorting(a.price?.discount),
							parseNumberForSorting(b.price?.discount),
							sortOrder,
						)
					case ProductSortHeaderKey.CURRENCY:
						return compareStringsForSorting(
							a.price?.currency,
							b.price?.currency,
							sortOrder,
						)
					case ProductSortHeaderKey.TAX_RATE:
						return compareStringsForSorting(a.taxRate, b.taxRate, sortOrder)
					case ProductSortHeaderKey.DESCRIPTION:
						return compareStringsForSorting(
							a.description,
							b.description,
							sortOrder,
						)
					case ProductSortHeaderKey.COLOR:
						return compareStringsForSorting(
							a.attributes?.color,
							b.attributes?.color,
							sortOrder,
						)
					case ProductSortHeaderKey.SIZE:
						return compareStringsForSorting(
							a.attributes?.size,
							b.attributes?.size,
							sortOrder,
						)
					case ProductSortHeaderKey.WEIGHT:
						return compareStringsForSorting(
							a.attributes?.weight,
							b.attributes?.weight,
							sortOrder,
						)
					case ProductSortHeaderKey.LENGTH:
						return compareStringsForSorting(
							a.attributes?.length,
							b.attributes?.length,
							sortOrder,
						)
					case ProductSortHeaderKey.WIDTH:
						return compareStringsForSorting(
							a.attributes?.width,
							b.attributes?.width,
							sortOrder,
						)
					case ProductSortHeaderKey.HEIGHT:
						return compareStringsForSorting(
							a.attributes?.height,
							b.attributes?.height,
							sortOrder,
						)
					case ProductSortHeaderKey.FLAVOR:
						return compareStringsForSorting(
							a.attributes?.flavor,
							b.attributes?.flavor,
							sortOrder,
						)
					case ProductSortHeaderKey.START_DATE:
					case ProductSortHeaderKey.EXPIRY_DATE:
						return compareDatesForSorting(
							a.attributes?.expiryDate?.toString(),
							b.attributes?.expiryDate?.toString(),
							sortOrder,
						)
					default:
						return 0
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

		const tableWidth = useMemo(() => {
			const dataWidth = visibleColumns.reduce(
				(total, column) => total + column.width,
				0,
			)
			const checkboxWidth = canDeleteProduct
				? PROMOTION_LIST_WIDTHS_MAP_IN_REM.CHECKBOX
				: 0
			return `${checkboxWidth + dataWidth + PROMOTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT + 4}rem`
		}, [canDeleteProduct, visibleColumns])

		const context: VirtuosoContext = {
			listData,
			selectedProducts,
			onSelect,
			onEditProduct,
			isLoading,
			tableWidth,
		}

		return (
			<Box sx={styles.mainBoxWrapper}>
				<Flex sx={styles.toolbar}>
					<ColumnPicker />
				</Flex>
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
							visibleColumns,
						],
					)}
				/>
			</Box>
		)
	},
)

ProductTableDesktop.displayName = 'Table'

export default ProductTableDesktop
