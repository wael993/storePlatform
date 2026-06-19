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
import { SortOrder, CustomerSortHeaderKey } from '../../list/shared/globalEnums'
import CustomerListHeaderRow from './CustomerListHeaderRow'
import CustomerListRow from './CustomerListRow'

interface VirtuosoContext {
	listData: Customer[]
	selectedCustomers: string[]
	onSelect: (id: string) => void
	isLoading: boolean
	isOwnerOrAdmin: boolean
}

const skeletonCustomer: Customer = {
	customerId: 'skeleton-id-5',
	name: 'dummy-5',
	internalCode: 'dummy-5',
	createdAt: '2024-01-01T00:00:00.000Z',
	updatedAt: '2024-01-01T00:00:00.000Z',
}

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
	const { isOwnerOrAdmin } = context as VirtuosoContext
	const tableWidth = getTableWidth(
		// TODO: change to CUSTOMER_LIST_WIDTHS_MAP_IN_REM
		PROMOTION_LIST_WIDTHS_MAP_IN_REM,
		isOwnerOrAdmin,
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
	const { listData, selectedCustomers, onSelect, isLoading } =
		context as VirtuosoContext

	const customer = listData[index]

	return (
		<CustomerListRow
			key={customer.customerId}
			customer={customer}
			isSelected={selectedCustomers.includes(customer.customerId)}
			tableRowProps={props}
			onSelect={onSelect}
			isLoading={isLoading}
		/>
	)
}

interface CustomerListDesktopProps {
	customers?: Customer[]
	isLoading: boolean
	onSelect: (customerId: string) => void
	selectedCustomers: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const CustomerListDesktop = memo(
	({
		customers,
		isLoading,
		onSelect,
		selectedCustomers,
		areAllItemsSelected,
		onAllItemsSelectedChange,
	}: CustomerListDesktopProps) => {
		const { isOwnerOrAdmin } = useUser()
		const [sortField, setSortField] = useState<CustomerSortHeaderKey | null>(
			null,
		)
		const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)

		const sortedCustomers = useMemo(() => {
			if (!customers) return []
			const clonedCustomers = structuredClone(customers)
			if (sortField === null) {
				return clonedCustomers
			}

			return clonedCustomers.sort((a, b) => {
				switch (sortField) {
					case CustomerSortHeaderKey.NAME: {
						return compareStringsForSorting(a.name, b.name, sortOrder)
					}

					case CustomerSortHeaderKey.INTERNAL_CODE: {
						return compareStringsForSorting(
							a.internalCode,
							b.internalCode,
							sortOrder,
						)
					}
					case CustomerSortHeaderKey.CREATED_AT: {
						return compareDatesForSorting(a.createdAt, b.createdAt, sortOrder)
					}
					default:
						return 0
				}
			})
		}, [customers, sortField, sortOrder])

		const onSort = (
			field: CustomerSortHeaderKey | null,
			order: SortOrder | null,
		) => {
			setSortField(field)
			setSortOrder(order)
		}

		const listData = useMemo(() => {
			return sortedCustomers.length === 0 && isLoading
				? Array(5).fill(skeletonCustomer)
				: sortedCustomers
		}, [sortedCustomers, isLoading])

		const context: VirtuosoContext = {
			listData,
			selectedCustomers,
			onSelect,
			isLoading,
			isOwnerOrAdmin,
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
							<CustomerListHeaderRow
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
CustomerListDesktop.displayName = 'CustomerListDesktop'

export default CustomerListDesktop
