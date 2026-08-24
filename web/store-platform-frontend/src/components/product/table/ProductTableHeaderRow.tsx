import { Tr, Th, Text, Flex, Checkbox, Box } from '@chakra-ui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AllowedActions } from '../../../shared/globalEnums'
import useAllowedActions from '../../../shared/hooks/useAllowedActions'
import { useResources } from '../../../shared/hooks/useResources'
import { useListColumnConfig } from '../../list/columnConfig/ListColumnConfigProvider'
import TableSort from '../../common/CustomTableSort'
import { PRODUCT_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { ProductSortHeaderKey, SortOrder } from '../../list/shared/globalEnums'

interface ProductTableHeaderRowProps {
	sortField: ProductSortHeaderKey | null
	sortOrder: SortOrder | null
	onSort: (field: ProductSortHeaderKey | null, order: SortOrder | null) => void
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const styles = {
	checkboxHeader: {
		left: '0',
		position: 'sticky',
		zIndex: 1,
		background: '#FFFFFF',
		padding: '4',
	},
	tableHeader: {
		paddingY: '1rem',
		paddingX: '0.375rem',
	},
	tableHeaderText: {
		fontStyle: 'normal',
		textTransform: 'none',
		color: '#939596',
		fontSize: '0.625rem',
		fontWeight: 500,
		lineHeight: '1.2rem',
		letterSpacing: 'normal',
		whiteSpace: 'nowrap',
	},
	tableHeaderStickyRight: {
		position: 'sticky',
		right: 0,
		zIndex: 4,
		height: '3rem',
		margin: 0,
		padding: 0,
	},
} satisfies StylesObject

const ProductTableHeaderRow = ({
	sortField,
	onSort,
	sortOrder,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: ProductTableHeaderRowProps) => {
	const { t } = useTranslation()
	const [hoveredIndex, setHoveredIndex] = useState<string | null>(null)
	const { isActionAllowed } = useResources()
	const { canDeleteProduct } = useAllowedActions()
	const { visibleColumns } = useListColumnConfig()

	const handleSort = (sortingCell: ProductSortHeaderKey, order: SortOrder) => {
		onSort(sortingCell, order)
	}

	const getSortingButton = (sortKey: ProductSortHeaderKey) => {
		return (
			<TableSort
				handleSort={order => {
					handleSort(sortKey, order)
				}}
				sortingOrder={sortField === sortKey ? sortOrder : null}
			/>
		)
	}

	const getStickyRightWidth = () => {
		const isAcceptingAllowed = isActionAllowed(AllowedActions.ADD_PRODUCT)
		const isRejectingAllowed = isActionAllowed(AllowedActions.ADD_PRODUCT)
		if (isAcceptingAllowed && isRejectingAllowed) {
			return `${PRODUCT_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`
		}
		if (isAcceptingAllowed || isRejectingAllowed) {
			return `${PRODUCT_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT - 4}rem`
		}
		return `${PRODUCT_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT - 7}rem`
	}

	return (
		<Tr background={'#fff'}>
			{canDeleteProduct && (
				<Th
					sx={styles.checkboxHeader}
					width={`${PRODUCT_LIST_WIDTHS_MAP_IN_REM.CHECKBOX}rem`}
				>
					<Checkbox
						isChecked={areAllItemsSelected}
						onChange={onAllItemsSelectedChange}
					/>
				</Th>
			)}
			{visibleColumns.map(column => {
				const sortKey = column.sortKey as ProductSortHeaderKey | undefined
				return (
					<Th
						key={column.id}
						sx={{
							...styles.tableHeader,
							textAlign: 'center',
						}}
						width={`${column.width}rem`}
						onMouseEnter={() => setHoveredIndex(column.id)}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						<Flex
							alignItems={'center'}
							width="100%"
							justifyContent="center"
							sx={styles.tableHeaderText}
						>
							<Text sx={styles.tableHeaderText}>{t(column.labelKey)}</Text>
							{(hoveredIndex === column.id || sortField === sortKey) &&
								sortKey && (
									<Box sx={{ marginLeft: '0.5rem' }}>
										{getSortingButton(sortKey)}
									</Box>
								)}
						</Flex>
					</Th>
				)
			})}
			<Th
				sx={{
					...styles.tableHeaderStickyRight,
					background: `linear-gradient(to right, transparent 0rem, transparent 0rem, #FFFFFF 7rem, #FFFFFF 2rem, #FFFFFF ${getStickyRightWidth()})`,
					width: `${PRODUCT_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`,
				}}
			/>
		</Tr>
	)
}
export default ProductTableHeaderRow
