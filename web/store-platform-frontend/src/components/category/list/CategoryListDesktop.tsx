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
import { CATEGORY_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { useUser } from '../../../shared/hooks/useUser'
import { SortOrder, CategorySortHeaderKey } from '../../list/shared/globalEnums'
import CategoryListRow from './CategoryListRow'
import CategoryListHeaderRow from './CategoryListHeaderRow'

interface VirtuosoContext {
	listData: Category[]
	selectedCategorys: string[]
	onSelect: (id: string) => void
	isLoading: boolean
	isOwnerOrAdmin: boolean
}

const skeletonCategory: Category = {
	categoryId: 'skeleton-id-2',
	name: 'dummy-2',
	description: 'dummy description',
	createdAt: '2024-01-01T00:00:00.000Z',
} as Category

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
		CATEGORY_LIST_WIDTHS_MAP_IN_REM,
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
	const { listData, selectedCategorys, onSelect, isLoading } =
		context as VirtuosoContext

	const category = listData[index]

	return (
		<CategoryListRow
			key={category.categoryId}
			category={category}
			isSelected={selectedCategorys.includes(category.categoryId)}
			tableRowProps={props}
			onSelect={onSelect}
			isLoading={isLoading}
		/>
	)
}

interface CategoryListDesktopProps {
	categories?: Category[]
	isLoading: boolean
	onSelect: (categoryId: string) => void
	selectedCategories: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const CategoryListDesktop = memo(
	({
		categories,
		isLoading,
		onSelect,
		selectedCategories,
		areAllItemsSelected,
		onAllItemsSelectedChange,
	}: CategoryListDesktopProps) => {
		const { isOwnerOrAdmin } = useUser()
		const [sortField, setSortField] = useState<CategorySortHeaderKey | null>(
			null,
		)
		const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)

		const sortedCategories = useMemo(() => {
			if (!categories) return []
			const clonedCategories = structuredClone(categories)
			if (sortField === null) {
				return clonedCategories
			}

			return clonedCategories.sort((a, b) => {
				switch (sortField) {
					case CategorySortHeaderKey.NAME: {
						return compareStringsForSorting(a.name, b.name, sortOrder)
					}

					case CategorySortHeaderKey.DESCRIPTION: {
						return compareStringsForSorting(
							a.description,
							b.description,
							sortOrder,
						)
					}
					case CategorySortHeaderKey.CREATED_AT: {
						return compareDatesForSorting(a.createdAt, b.createdAt, sortOrder)
					}
					default:
						return 0
				}
			})
		}, [categories, sortField, sortOrder])

		const onSort = (
			field: CategorySortHeaderKey | null,
			order: SortOrder | null,
		) => {
			setSortField(field)
			setSortOrder(order)
		}

		const listData = useMemo(() => {
			return sortedCategories.length === 0 && isLoading
				? Array(5).fill(skeletonCategory)
				: sortedCategories
		}, [sortedCategories, isLoading])

		const context: VirtuosoContext = {
			listData,
			selectedCategorys: selectedCategories,
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
							<CategoryListHeaderRow
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
CategoryListDesktop.displayName = 'CategoryListDesktop'

export default CategoryListDesktop
