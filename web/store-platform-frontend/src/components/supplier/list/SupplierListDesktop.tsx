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
import DraggableScrollContainer from '../../common/DraggableScrollContainer'
import {
	compareDatesForSorting,
	compareStringsForSorting,
	getTableWidth,
} from '../../list/shared/utils'
import { PROMOTION_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { useUser } from '../../../shared/hooks/useUser'
import { SortOrder, SupplierSortHeaderKey } from '../../list/shared/globalEnums'
import SupplierListHeaderRow from './SupplierListHeaderRow'
import SupplierListRow from './SupplierListRow'

interface VirtuosoContext {
	listData: Supplier[]
	selectedSuppliers: string[]
	onSelect: (id: string) => void
	isLoading: boolean
	isInternalUser: boolean
}

const skeletonSupplier: Supplier = {
	supplierId: 'skeleton-id',
	name: 'dummy',
	barcode: 'dummy',
	categoryName: 'dummy',
	brandName: 'dummy',
	supplierName: 'dummy',
	stock: {
		quantity: 0,
		minQuantity: 0,
	},
	price: {
		buyCost: 0,
		wholesale: 0,
		retail: 0,
		discount: 0,
		currency: 'USD',
		retailSale: 0,
		wholesaleSale: 0,
		semiWholesaleSales: 0,
	},
	location: {
		warehouse: 'dummy',
		shelf: 'dummy',
	},
	attributes: {
		color: 'dummy',
	},
	updatedAt: '2024-01-01T00:00:00.000Z',
	state: 'draft',
} as Supplier

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
		// TODO: change to SUPPLIER_LIST_WIDTHS_MAP_IN_REM
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
	const { listData, selectedSuppliers, onSelect, isLoading } =
		context as VirtuosoContext

	const supplier = listData[index]

	return (
		<SupplierListRow
			key={supplier.supplierId}
			supplier={supplier}
			isSelected={selectedSuppliers.includes(supplier.supplierId)}
			tableRowProps={props}
			onSelect={onSelect}
			isLoading={isLoading}
		/>
	)
}

interface SupplierListDesktopProps {
	suppliers?: Supplier[]
	isLoading: boolean
	onSelect: (supplierId: string) => void
	selectedSuppliers: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const SupplierListDesktop = memo(
	({
		suppliers,
		isLoading,
		onSelect,
		selectedSuppliers,
		areAllItemsSelected,
		onAllItemsSelectedChange,
	}: SupplierListDesktopProps) => {
		const { isOwnerOrAdmin } = useUser()
		const [sortField, setSortField] = useState<SupplierSortHeaderKey | null>(
			null,
		)
		const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)

		const sortedSuppliers = useMemo(() => {
			if (!suppliers) return []
			const clonedSuppliers = structuredClone(suppliers)
			if (sortField === null) {
				return clonedSuppliers
			}

			return clonedSuppliers.sort((a, b) => {
				switch (sortField) {
					case SupplierSortHeaderKey.NAME: {
						return compareStringsForSorting(a.name, b.name, sortOrder)
					}

					case SupplierSortHeaderKey.INTERNAL_CODE: {
						return compareStringsForSorting(
							a.internalCode,
							b.internalCode,
							sortOrder,
						)
					}
					case SupplierSortHeaderKey.CREATED_AT: {
						return compareDatesForSorting(a.createdAt, b.createdAt, sortOrder)
					}
					default:
						return 0
				}
			})
		}, [suppliers, sortField, sortOrder])

		const onSort = (
			field: SupplierSortHeaderKey | null,
			order: SortOrder | null,
		) => {
			setSortField(field)
			setSortOrder(order)
		}

		const listData = useMemo(() => {
			return sortedSuppliers.length === 0 && isLoading
				? Array(5).fill(skeletonSupplier)
				: sortedSuppliers
		}, [sortedSuppliers, isLoading])

		const context: VirtuosoContext = {
			listData,
			selectedSuppliers,
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
							<SupplierListHeaderRow
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
SupplierListDesktop.displayName = 'SupplierListDesktop'

export default SupplierListDesktop
