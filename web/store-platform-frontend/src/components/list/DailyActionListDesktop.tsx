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

import DraggableScrollContainer from '../common/DraggableScrollContainer'
import DailyActionHeaderRow from './DailyActionHeaderRow'
import DailyActionRow from './DailyActionRow'
import { DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM } from './shared/constants'
import { DailyActionSortHeaderKey, SortOrder } from './shared/globalEnums'
import {
	compareDatesForSorting,
	compareStringsForSorting,
	getTableWidth,
} from './shared/utils'

interface VirtuosoContext {
	listData: DailyAction[]
	selectedIds: string[]
	onSelect: (id: string) => void
	isLoading: boolean
}

const skeletonDailyAction: DailyAction = {
	_id: 'skeleton-id',
	actionId: 'skeleton-action-id',
	entryType: { value: 'BUYING_ENTRY', label: 'Buying Entry' },
	productId: 'dummy',
	productName: 'dummy',
	supplierId: 'dummy',
	supplierName: 'dummy',
	currencyId: 'dummy',
	currencyName: 'dummy',
	unitId: 'dummy',
	unitName: 'dummy',
	weight: '0',
	singleUnitPrice: '0',
	totalPrice: '0',
	invoiceNumber: '0000503',
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
	const scrollerStyles: StylesObject = {
		scroller: {
			display: 'flex',
			flexDir: 'row',
			alignItems: 'start',
			position: 'relative',
			'&::-webkit-scrollbar': { height: '0' },
			width: '100%',
			scrollbarWidth: 'none',
			msOverflowStyle: 'none',
		},
	}
	return (
		<DraggableScrollContainer
			styles={scrollerStyles.scroller}
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
	const tableWidth = getTableWidth(DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM, true)

	return (
		<Table
			{...props}
			style={{ ...style }}
			position="relative"
			layout="fixed"
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
	const { listData, selectedIds, onSelect, isLoading } =
		context as VirtuosoContext

	const dailyAction = listData[index]
	const rowId = dailyAction._id ?? dailyAction.actionId ?? String(index)

	return (
		<DailyActionRow
			key={rowId}
			dailyAction={dailyAction}
			isSelected={selectedIds.includes(rowId)}
			tableRowProps={props}
			onSelect={onSelect}
			isLoading={isLoading}
		/>
	)
}

interface DailyActionListDesktopProps {
	dailyActions?: DailyAction[]
	isLoading: boolean
	onSelect: (id: string) => void
	selectedIds: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const DailyActionListDesktop = memo(
	({
		dailyActions,
		isLoading,
		onSelect,
		selectedIds,
		areAllItemsSelected,
		onAllItemsSelectedChange,
	}: DailyActionListDesktopProps) => {
		const [sortField, setSortField] = useState<DailyActionSortHeaderKey | null>(
			null,
		)
		const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)

		const sortedActions = useMemo(() => {
			if (!dailyActions) return []
			const cloned = structuredClone(dailyActions)
			if (sortField === null) return cloned

			return cloned.sort((a, b) => {
				switch (sortField) {
					case DailyActionSortHeaderKey.PRODUCT_NAME:
						return compareStringsForSorting(
							a.productName,
							b.productName,
							sortOrder,
						)
					case DailyActionSortHeaderKey.SUPPLIER_CUSTOMER:
						return compareStringsForSorting(
							a.supplierName ?? a.customerName,
							b.supplierName ?? b.customerName,
							sortOrder,
						)
					case DailyActionSortHeaderKey.WEIGHT:
						return compareStringsForSorting(a.weight, b.weight, sortOrder)
					case DailyActionSortHeaderKey.UNIT_PRICE:
						return compareStringsForSorting(
							a.singleUnitPrice,
							b.singleUnitPrice,
							sortOrder,
						)
					case DailyActionSortHeaderKey.TOTAL_PRICE:
						return compareStringsForSorting(
							a.totalPrice,
							b.totalPrice,
							sortOrder,
						)
					case DailyActionSortHeaderKey.CREATED_AT:
						return compareDatesForSorting(a.createdAt, b.createdAt, sortOrder)
					default:
						return 0
				}
			})
		}, [dailyActions, sortField, sortOrder])

		const onSort = (
			field: DailyActionSortHeaderKey | null,
			order: SortOrder | null,
		) => {
			setSortField(field)
			setSortOrder(order)
		}

		const listData = useMemo(() => {
			return sortedActions.length === 0 && isLoading
				? Array(5).fill(skeletonDailyAction)
				: sortedActions
		}, [sortedActions, isLoading])

		const context: VirtuosoContext = {
			listData,
			selectedIds,
			onSelect,
			isLoading,
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
							<DailyActionHeaderRow
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

DailyActionListDesktop.displayName = 'DailyActionListDesktop'

export default DailyActionListDesktop
