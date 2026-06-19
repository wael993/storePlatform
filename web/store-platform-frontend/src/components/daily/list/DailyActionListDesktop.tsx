/* eslint-disable react-hooks/exhaustive-deps */
import { Box, Table, Thead, Tbody } from '@chakra-ui/react'
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
import DailyActionRow from './DailyActionRow'
import { DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import {
	DailyActionSortHeaderKey,
	SortOrder,
} from '../../list/shared/globalEnums'
import {
	compareDatesForSorting,
	compareNumbersForSorting,
	compareStringsForSorting,
	getTableWidth,
	parseNumberForSorting,
} from '../../list/shared/utils'
import DailyActionHeaderRow from './DailyActionHeaderRow'
import { useUser } from '../../../shared/hooks/useUser'

interface VirtuosoContext {
	listData: DailyAction[]
	selectedDailyActionIds: string[]
	onSelect: (id: string) => void
	isLoading: boolean
	isOwnerOrAdmin: boolean
}

const skeletonDailyAction: DailyAction = {
	_id: 'skeleton-id',
	actionId: 'skeleton-action-id',
	entryType: 'BUYING_ENTRY',
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
	invoiceDate: '2024-01-01T00:00:00.000Z',
	note: 'dummy',
}

const getEntryTypeValue = (entryType: DailyAction['entryType']) => {
	if (!entryType) return undefined
	if (typeof entryType === 'string') return entryType
	return entryType.value
}

const getDailyActionTotalPrice = (dailyAction: DailyAction) => {
	const entryTypeValue = getEntryTypeValue(dailyAction.entryType)

	if (
		entryTypeValue === 'PAYMENT_ENTRY' ||
		entryTypeValue === 'RECEIPT_ENTRY' ||
		entryTypeValue === 'EXPENSE_ENTRY'
	) {
		return dailyAction.singleUnitPrice
	}

	return dailyAction.totalPrice
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
	embeddedListWrapper: {
		width: '100%',
		overflowX: 'auto',
	},
	embeddedTable: {
		width: 'max-content',
		minWidth: '100%',
	},
	virtuoso: {
		width: '100%',
		position: 'relative',
		height: 'max(32rem,70vh)',
	},
} satisfies StylesObject

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
	const { isOwnerOrAdmin } = context as VirtuosoContext

	const tableWidth = getTableWidth(
		DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM,
		isOwnerOrAdmin,
		14,
		4,
	)

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
	const { listData, selectedDailyActionIds, onSelect, isLoading } =
		context as VirtuosoContext

	const dailyAction = listData[index]
	const rowId = dailyAction._id ?? dailyAction.actionId ?? String(index)

	return (
		<DailyActionRow
			key={rowId}
			dailyAction={dailyAction}
			isSelected={selectedDailyActionIds.includes(rowId)}
			tableRowProps={props}
			onSelect={onSelect}
			isLoading={isLoading}
		/>
	)
}

interface DailyActionListDesktopProps {
	dailyActions: DailyAction[]
	isLoading: boolean
	onSelect: (id: string) => void
	selectedDailyActionIds: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
	embedded?: boolean
}

const DailyActionListDesktop = memo(
	({
		dailyActions,
		isLoading,
		onSelect,
		selectedDailyActionIds,
		areAllItemsSelected,
		onAllItemsSelectedChange,
		embedded = false,
	}: DailyActionListDesktopProps) => {
		const { isOwnerOrAdmin } = useUser()

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
					case DailyActionSortHeaderKey.ENTRY_TYPE:
						return compareStringsForSorting(
							getEntryTypeValue(a.entryType),
							getEntryTypeValue(b.entryType),
							sortOrder,
						)
					case DailyActionSortHeaderKey.PRODUCT_NAME:
						return compareStringsForSorting(
							a.productName ?? a.expenseName,
							b.productName ?? b.expenseName,
							sortOrder,
						)
					case DailyActionSortHeaderKey.SUPPLIER_CUSTOMER:
						return compareStringsForSorting(
							a.supplierName ?? a.customerName ?? a.expenseName,
							b.supplierName ?? b.customerName ?? b.expenseName,
							sortOrder,
						)
					case DailyActionSortHeaderKey.WEIGHT:
						return compareNumbersForSorting(
							parseNumberForSorting(a.weight),
							parseNumberForSorting(b.weight),
							sortOrder,
						)
					case DailyActionSortHeaderKey.UNIT_PRICE:
						return compareNumbersForSorting(
							parseNumberForSorting(a.singleUnitPrice),
							parseNumberForSorting(b.singleUnitPrice),
							sortOrder,
						)
					case DailyActionSortHeaderKey.TOTAL_PRICE:
						return compareNumbersForSorting(
							parseNumberForSorting(getDailyActionTotalPrice(a)),
							parseNumberForSorting(getDailyActionTotalPrice(b)),
							sortOrder,
						)
					case DailyActionSortHeaderKey.INVOICE_DATE:
						return compareDatesForSorting(
							a.invoiceDate,
							b.invoiceDate,
							sortOrder,
						)
					case DailyActionSortHeaderKey.INVOICE_NUMBER:
						return compareStringsForSorting(
							a.invoiceNumber,
							b.invoiceNumber,
							sortOrder,
						)
					case DailyActionSortHeaderKey.NOTE:
						return compareStringsForSorting(a.note, b.note, sortOrder)
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
			selectedDailyActionIds,
			onSelect,
			isLoading,
			isOwnerOrAdmin,
		}

		const headerRow = (
			<DailyActionHeaderRow
				sortField={sortField}
				sortOrder={sortOrder}
				onSort={onSort}
				onAllItemsSelectedChange={onAllItemsSelectedChange}
				areAllItemsSelected={areAllItemsSelected}
			/>
		)

		const fixedHeaderContent = useCallback(
			() => headerRow,
			[sortOrder, sortField, onAllItemsSelectedChange, areAllItemsSelected],
		)

		if (embedded) {
			const tableWidth = getTableWidth(
				DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM,
				isOwnerOrAdmin,
				14,
				4,
			)

			return (
				<Box sx={styles.mainBoxWrapper}>
					<DraggableScrollContainer styles={styles.embeddedListWrapper}>
						<Table layout="fixed" width={tableWidth} sx={styles.embeddedTable}>
							<Thead>{headerRow}</Thead>
							<Tbody>
								{listData.map((dailyAction, index) => {
									const rowId =
										dailyAction._id ?? dailyAction.actionId ?? String(index)

									return (
										<DailyActionRow
											key={rowId}
											dailyAction={dailyAction}
											isSelected={selectedDailyActionIds.includes(rowId)}
											tableRowProps={{}}
											onSelect={onSelect}
											isLoading={isLoading}
										/>
									)
								})}
							</Tbody>
						</Table>
					</DraggableScrollContainer>
				</Box>
			)
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
					fixedHeaderContent={fixedHeaderContent}
				/>
			</Box>
		)
	},
)

DailyActionListDesktop.displayName = 'DailyActionListDesktop'

export default DailyActionListDesktop
