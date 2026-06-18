import { Tr, Th, Text, Flex, Checkbox, Box } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { SortOrder, SupplierSortHeaderKey } from '../../list/shared/globalEnums'
import { useResources } from '../../../shared/hooks/useResources'
import TableSort from '../../common/CustomTableSort'
import { SUPPLIER_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { isTruthy } from '../../list/shared/utils'
import { AllowedActions } from '../../../shared/globalEnums'

interface SupplierListHeaderRowProps {
	sortField: SupplierSortHeaderKey | null
	sortOrder: SortOrder | null
	onSort: (field: SupplierSortHeaderKey | null, order: SortOrder | null) => void
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
	tableCell: {
		paddingY: '1rem',
		paddingX: '0.375rem',
	},
	tableCellText: {
		fontWeight: 500,
		color: '#1E1E1E',
		fontSize: '0.875rem',
		lineHeight: '1.2rem',
		overflowWrap: 'anywhere',
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

const SupplierListHeaderRow = ({
	sortField,
	sortOrder,
	onSort,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: SupplierListHeaderRowProps) => {
	const { t } = useTranslation()
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

	const { isActionAllowed } = useResources()
	const showCheckbox = true

	const handleSort = (sortingCell: SupplierSortHeaderKey, order: SortOrder) => {
		onSort(sortingCell, order)
	}

	const getSortingButton = (sortKey: SupplierSortHeaderKey) => {
		return (
			<TableSort
				handleSort={order => {
					handleSort(sortKey, order)
				}}
				sortingOrder={sortField === sortKey ? sortOrder : null}
			/>
		)
	}

	const headers = [
		...(showCheckbox
			? [
					{
						label: null,
						width: SUPPLIER_LIST_WIDTHS_MAP_IN_REM.CHECKBOX,
						sortKey: null,
						isCheckbox: true,
					},
				]
			: []),
		{
			label: t('supplier.list.name'),
			width: SUPPLIER_LIST_WIDTHS_MAP_IN_REM.NAME,
			sortKey: SupplierSortHeaderKey.NAME,
		},
		{
			label: t('supplier.list.internalCode'),
			width: SUPPLIER_LIST_WIDTHS_MAP_IN_REM.INTERNAL_CODE,
			sortKey: SupplierSortHeaderKey.INTERNAL_CODE,
		},
		{
			label: t('supplier.list.createdAt'),
			width: SUPPLIER_LIST_WIDTHS_MAP_IN_REM.CREATED_AT,
			sortKey: SupplierSortHeaderKey.CREATED_AT,
			align: 'right' as const,
		},

		{
			label: null,
			width: SUPPLIER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT,
			sortKey: null,
			isStickyRight: true,
		},
	].filter(isTruthy)

	const getStickyRightWidth = () => {
		//change this later
		const isAcceptingAllowed = isActionAllowed(AllowedActions.ADD_PRODUCT)
		const isRejectingAllowed = isActionAllowed(AllowedActions.ADD_PRODUCT)
		if (isAcceptingAllowed && isRejectingAllowed) {
			return `${SUPPLIER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`
		}
		if (isAcceptingAllowed || isRejectingAllowed) {
			return `${SUPPLIER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT - 4}rem`
		}
		return `${SUPPLIER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT - 7}rem`
	}

	return (
		<Tr background={'#fff'}>
			{headers.map((header, index) => {
				if (header.isCheckbox) {
					return (
						<Th
							key={index}
							sx={styles.checkboxHeader}
							width={`${header.width}rem`}
						>
							<Checkbox
								isChecked={areAllItemsSelected}
								onChange={onAllItemsSelectedChange}
							/>
						</Th>
					)
				}

				if (header.isStickyRight) {
					return (
						<Th
							key={index}
							sx={{
								...styles.tableHeaderStickyRight,
								background: `linear-gradient(to right, transparent 0rem, transparent 0rem, #FFFFFF 7rem, #FFFFFF 2rem, #FFFFFF ${getStickyRightWidth()})`,
								width: `${header.width}rem`,
							}}
						/>
					)
				}

				return (
					<Th
						key={index}
						sx={styles.tableHeader}
						width={`${header.width}rem`}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						<Flex
							alignItems={'center'}
							justifyContent={header.align === 'right' ? 'flex-end' : undefined}
							sx={{
								...styles.tableHeaderText,
								...(header.align === 'right' ? { paddingRight: '1.5rem' } : {}),
							}}
						>
							<Text sx={styles.tableHeaderText}>{header.label}</Text>
							{(hoveredIndex === index || sortField === header.sortKey) &&
								header.sortKey && (
									<Box sx={{ marginLeft: '0.5rem' }}>
										{getSortingButton(header.sortKey)}
									</Box>
								)}
						</Flex>
					</Th>
				)
			})}
		</Tr>
	)
}

export default SupplierListHeaderRow
