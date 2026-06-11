import {
	Box,
	Table,
	Tr,
	Th,
	Td,
	Checkbox,
	Flex,
	Text,
	Skeleton,
} from '@chakra-ui/react'
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
import { useTranslation } from 'react-i18next'

import DraggableScrollContainer from '../common/DraggableScrollContainer'
import { SIMPLE_ENTITY_LIST_WIDTHS_MAP_IN_REM } from './shared/constants'
import { SimpleEntitySortHeaderKey, SortOrder } from './shared/globalEnums'
import {
	compareDatesForSorting,
	compareStringsForSorting,
	getTableWidth,
} from './shared/utils'
import { listStyles } from '../../shared/styles'
import { formatDate } from '../../shared/dateUtils'
import TableSort from '../common/CustomTableSort'
import { mapFee } from '../../shared/utils'

export interface SimpleEntity {
	id: string
	name: string
	internalCode?: string
	createdAt?: string
}

interface VirtuosoContext {
	listData: SimpleEntity[]
	selectedIds: string[]
	onSelect: (id: string) => void
	isLoading: boolean
}

const skeletonEntity: SimpleEntity = {
	id: 'skeleton-id',
	name: 'dummy',
	internalCode: 'dummy',
	createdAt: '2024-01-01T00:00:00.000Z',
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

const headerStyles = {
	checkboxHeader: {
		left: '0',
		position: 'sticky',
		zIndex: 1,
		background: '#FFFFFF',
		padding: '4',
	},
} satisfies StylesObject

// ---- Scroller ----

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

// ---- Table ----

const TableComponent = ({
	style,
	...props
}: {
	style?: CSSProperties
	context?: VirtuosoContext
}) => {
	const tableWidth = getTableWidth(SIMPLE_ENTITY_LIST_WIDTHS_MAP_IN_REM, true)
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

// ---- Row ----

const EntityRow = ({
	entity,
	onSelect,
	isSelected,
	tableRowProps,
	isLoading,
	isHovered,
	setIsHovered,
}: {
	entity: SimpleEntity
	onSelect: (id: string) => void
	isSelected: boolean
	tableRowProps: Record<string, unknown>
	isLoading: boolean
	isHovered: boolean
	setIsHovered: (v: boolean) => void
}) => {
	const rowStyles = {
		tableRow: {
			padding: 0,
			height: 0,
			'@-moz-document url-prefix()': { height: '100%' },
		},
		checkboxRow: {
			left: '0',
			position: 'sticky',
			zIndex: 1,
			backgroundColor: '#FFFFFF',
		},
		cellContentWrapper: {
			...listStyles.tableCell,
			height: '100%',
			width: '100%',
			alignItems: 'center',
			justifyContent: 'start',
		},
		checkboxWrapper: {
			backgroundColor: isHovered ? '#F4F4F4' : '#FFFFFF',
			padding: 0,
		},
		text: {
			...listStyles.tableCellText,
			color: '#1E1E1E',
		},
	} satisfies StylesObject

	const entityWithBalance = {
		...entity,
		balance: 300000,
	}
	return (
		<Tr
			{...tableRowProps}
			sx={{
				backgroundColor: isHovered ? '#F9F9F9' : '#FFFFFF',
				cursor: 'default',
			}}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{/* Checkbox */}
			<Td sx={{ ...rowStyles.tableRow, ...rowStyles.checkboxRow }}>
				<Flex
					sx={{ ...rowStyles.cellContentWrapper, ...rowStyles.checkboxWrapper }}
					onClick={e => {
						onSelect(entity.id)
						e.stopPropagation()
					}}
					cursor="pointer"
				>
					<Skeleton isLoaded={!isLoading}>
						<Checkbox
							pointerEvents="none"
							isChecked={isSelected}
							zIndex={2}
							padding={4}
						/>
					</Skeleton>
				</Flex>
			</Td>

			{/* Name */}
			<Td sx={rowStyles.tableRow}>
				<Flex sx={rowStyles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={{ ...rowStyles.text, fontWeight: 600 }}>
							{entity.name ?? '-'}
						</Text>
					</Skeleton>
				</Flex>
			</Td>

			{/* Internal Code */}
			<Td sx={rowStyles.tableRow}>
				<Flex sx={rowStyles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={rowStyles.text}>{entity.internalCode ?? '-'}</Text>
					</Skeleton>
				</Flex>
			</Td>

			{/* Created At */}
			{/* <Td sx={rowStyles.tableRow}>
				<Flex sx={rowStyles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={rowStyles.text}>
							{entity.createdAt ? formatDate(entity.createdAt) : '-'}
						</Text>
					</Skeleton>
				</Flex>
			</Td> */}

			{/* Balance  */}
			<Td sx={rowStyles.tableRow}>
				<Flex sx={rowStyles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text
							sx={{
								...rowStyles.text,
								color: entityWithBalance.balance > 0 ? 'green' : 'red',
								fontWeight: 700,
							}}
						>
							{mapFee(entityWithBalance.balance.toString()) ?? '-'}
						</Text>
					</Skeleton>
				</Flex>
			</Td>
		</Tr>
	)
}

const EntityRowWrapper = (props: {
	'data-index': number
	context?: VirtuosoContext
}) => {
	const [isHovered, setIsHovered] = useState(false)
	const index = props['data-index']
	const context = props.context as VirtuosoContext
	const { listData, selectedIds, onSelect, isLoading } = context
	const entity = listData[index]

	return (
		<EntityRow
			entity={entity}
			isSelected={selectedIds.includes(entity.id)}
			tableRowProps={props}
			onSelect={onSelect}
			isLoading={isLoading}
			isHovered={isHovered}
			setIsHovered={setIsHovered}
		/>
	)
}

// ---- Header Row ----

interface HeaderRowProps {
	sortField: SimpleEntitySortHeaderKey | null
	sortOrder: SortOrder | null
	onSort: (
		field: SimpleEntitySortHeaderKey | null,
		order: SortOrder | null,
	) => void
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const EntityHeaderRow = ({
	sortField,
	sortOrder,
	onSort,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: HeaderRowProps) => {
	const { t } = useTranslation()
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

	const handleSort = (sortKey: SimpleEntitySortHeaderKey, order: SortOrder) => {
		onSort(sortKey, order)
	}

	const getSortingButton = (sortKey: SimpleEntitySortHeaderKey) => (
		<TableSort
			handleSort={order => handleSort(sortKey, order)}
			sortingOrder={sortField === sortKey ? sortOrder : null}
		/>
	)

	const headers = [
		{
			label: null,
			width: SIMPLE_ENTITY_LIST_WIDTHS_MAP_IN_REM.CHECKBOX,
			sortKey: null,
			isCheckbox: true,
		},
		{
			label: t('common.name'),
			width: SIMPLE_ENTITY_LIST_WIDTHS_MAP_IN_REM.NAME,
			sortKey: SimpleEntitySortHeaderKey.NAME,
		},
		{
			label: t('common.internalCode'),
			width: SIMPLE_ENTITY_LIST_WIDTHS_MAP_IN_REM.INTERNAL_CODE,
			sortKey: SimpleEntitySortHeaderKey.INTERNAL_CODE,
		},
		// {
		// 	label: t('common.createdAt'),
		// 	width: SIMPLE_ENTITY_LIST_WIDTHS_MAP_IN_REM.CREATED_AT,
		// 	sortKey: SimpleEntitySortHeaderKey.CREATED_AT,
		// },
		{
			label: 'Balance',
			width: SIMPLE_ENTITY_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT,
			sortKey: null,
		},
	]

	const headerCellStyles = {
		paddingY: '1rem',
		paddingX: '0.375rem',
	}
	const headerTextStyles = {
		fontStyle: 'normal',
		textTransform: 'none',
		color: '#939596',
		fontSize: '0.625rem',
		fontWeight: 500,
		lineHeight: '1.2rem',
		letterSpacing: 'normal',
		whiteSpace: 'nowrap',
	}

	return (
		<Tr bg="#FFFFFF">
			{headers.map((header, index) =>
				header.isCheckbox ? (
					<Th
						key="checkbox"
						sx={{
							...headerStyles.checkboxHeader,
							width: `${header.width}rem`,
						}}
					>
						<Checkbox
							isChecked={areAllItemsSelected}
							onChange={onAllItemsSelectedChange}
						/>
					</Th>
				) : (
					<Th
						key={header.label}
						sx={{ ...headerCellStyles, width: `${header.width}rem` }}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						<Flex alignItems="center" gap="0.25rem">
							<Text sx={headerTextStyles as StylesObject['key']}>
								{header.label}
							</Text>
							{header.sortKey &&
							(hoveredIndex === index || sortField === header.sortKey)
								? getSortingButton(header.sortKey)
								: null}
						</Flex>
					</Th>
				),
			)}
		</Tr>
	)
}

// ---- Main Component ----

interface SimpleEntityListDesktopProps {
	entities: SimpleEntity[]
	isLoading: boolean
	onSelect: (id: string) => void
	selectedIds: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const SimpleEntityListDesktop = memo(
	({
		entities,
		isLoading,
		onSelect,
		selectedIds,
		areAllItemsSelected,
		onAllItemsSelectedChange,
	}: SimpleEntityListDesktopProps) => {
		const [sortField, setSortField] =
			useState<SimpleEntitySortHeaderKey | null>(null)
		const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)

		const sortedEntities = useMemo(() => {
			if (!entities) return []
			const cloned = structuredClone(entities)
			if (sortField === null) return cloned

			return cloned.sort((a, b) => {
				switch (sortField) {
					case SimpleEntitySortHeaderKey.NAME:
						return compareStringsForSorting(a.name, b.name, sortOrder)
					case SimpleEntitySortHeaderKey.INTERNAL_CODE:
						return compareStringsForSorting(
							a.internalCode,
							b.internalCode,
							sortOrder,
						)
					case SimpleEntitySortHeaderKey.CREATED_AT:
						return compareDatesForSorting(a.createdAt, b.createdAt, sortOrder)
					default:
						return 0
				}
			})
		}, [entities, sortField, sortOrder])

		const onSort = (
			field: SimpleEntitySortHeaderKey | null,
			order: SortOrder | null,
		) => {
			setSortField(field)
			setSortOrder(order)
		}

		const listData = useMemo(() => {
			return sortedEntities.length === 0 && isLoading
				? Array(5).fill(skeletonEntity)
				: sortedEntities
		}, [sortedEntities, isLoading])

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
						TableRow: EntityRowWrapper,
					}}
					fixedHeaderContent={useCallback(
						() => (
							<EntityHeaderRow
								sortField={sortField}
								sortOrder={sortOrder}
								onSort={onSort}
								areAllItemsSelected={areAllItemsSelected}
								onAllItemsSelectedChange={onAllItemsSelectedChange}
							/>
						),
						[
							sortField,
							sortOrder,
							areAllItemsSelected,
							onAllItemsSelectedChange,
						],
					)}
				/>
			</Box>
		)
	},
)

SimpleEntityListDesktop.displayName = 'SimpleEntityListDesktop'

export default SimpleEntityListDesktop
