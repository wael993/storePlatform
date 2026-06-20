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
import { PARTNER_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { useUser } from '../../../shared/hooks/useUser'
import { SortOrder, PartnerSortHeaderKey } from '../../list/shared/globalEnums'
import PartnerListRow from './PartnerListRow'
import PartnerListHeaderRow from './PartnerListHeaderRow'

interface VirtuosoContext {
	listData: Partner[]
	selectedPartners: string[]
	onSelect: (id: string) => void
	isLoading: boolean
	isOwnerOrAdmin: boolean
}

const skeletonPartner: Partner = {
	partnerId: 'skeleton-id-2',
	name: 'dummy-2',
	internalCode: 'dummy-2',
	createdAt: '2024-01-01T00:00:00.000Z',
	updatedAt: '2024-01-01T00:00:00.000Z',
	createdBy: {
		_id: 'dummy-2',
		displayName: 'dummy-2',
		createdAt: '2024-01-01T00:00:00.000Z',
	},
	updatedBy: {
		_id: 'dummy-2',
		displayName: 'dummy-2',
		updatedAt: '2024-01-01T00:00:00.000Z',
	},
} as Partner

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
		PARTNER_LIST_WIDTHS_MAP_IN_REM,
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
	const { listData, selectedPartners, onSelect, isLoading } =
		context as VirtuosoContext

	const partner = listData[index]

	return (
		<PartnerListRow
			key={partner.partnerId}
			partner={partner}
			isSelected={selectedPartners.includes(partner.partnerId)}
			tableRowProps={props}
			onSelect={onSelect}
			isLoading={isLoading}
		/>
	)
}

interface PartnerListDesktopProps {
	partners?: Partner[]
	isLoading: boolean
	onSelect: (partnerId: string) => void
	selectedPartners: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const PartnerListDesktop = memo(
	({
		partners,
		isLoading,
		onSelect,
		selectedPartners,
		areAllItemsSelected,
		onAllItemsSelectedChange,
	}: PartnerListDesktopProps) => {
		const { isOwnerOrAdmin } = useUser()
		const [sortField, setSortField] = useState<PartnerSortHeaderKey | null>(
			null,
		)
		const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)

		const sortedPartners = useMemo(() => {
			if (!partners) return []
			const clonedPartners = structuredClone(partners)
			if (sortField === null) {
				return clonedPartners
			}

			return clonedPartners.sort((a, b) => {
				switch (sortField) {
					case PartnerSortHeaderKey.NAME: {
						return compareStringsForSorting(a.name, b.name, sortOrder)
					}

					case PartnerSortHeaderKey.INTERNAL_CODE: {
						return compareStringsForSorting(
							a.internalCode,
							b.internalCode,
							sortOrder,
						)
					}
					case PartnerSortHeaderKey.CREATED_AT: {
						return compareDatesForSorting(a.createdAt, b.createdAt, sortOrder)
					}
					default:
						return 0
				}
			})
		}, [partners, sortField, sortOrder])

		const onSort = (
			field: PartnerSortHeaderKey | null,
			order: SortOrder | null,
		) => {
			setSortField(field)
			setSortOrder(order)
		}

		const listData = useMemo(() => {
			return sortedPartners.length === 0 && isLoading
				? Array(5).fill(skeletonPartner)
				: sortedPartners
		}, [sortedPartners, isLoading])

		const context: VirtuosoContext = {
			listData,
			selectedPartners,
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
							<PartnerListHeaderRow
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
PartnerListDesktop.displayName = 'PartnerListDesktop'

export default PartnerListDesktop
