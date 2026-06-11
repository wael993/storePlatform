import { Tr, Th, Text, Flex, Checkbox, Box } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import TableSort from '../common/CustomTableSort'
import { listStyles } from '../../shared/styles'
import { DailyActionSortHeaderKey, SortOrder } from '../list/shared/globalEnums'
import { DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM } from '../list/shared/constants'
import { isTruthy } from '../list/shared/utils'

interface DailyActionHeaderRowProps {
	sortField: DailyActionSortHeaderKey | null
	sortOrder: SortOrder | null
	onSort: (
		field: DailyActionSortHeaderKey | null,
		order: SortOrder | null,
	) => void
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
} satisfies StylesObject

const DailyActionHeaderRow = ({
	sortField,
	sortOrder,
	onSort,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: DailyActionHeaderRowProps) => {
	const { t } = useTranslation()
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

	const handleSort = (sortKey: DailyActionSortHeaderKey, order: SortOrder) => {
		onSort(sortKey, order)
	}

	const getSortingButton = (sortKey: DailyActionSortHeaderKey) => (
		<TableSort
			handleSort={order => handleSort(sortKey, order)}
			sortingOrder={sortField === sortKey ? sortOrder : null}
		/>
	)

	const headers = [
		{
			label: null,
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.CHECKBOX,
			sortKey: null,
			isCheckbox: true,
		},
		{
			label: t('common.entryType'),
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.ENTRY_TYPE,
			sortKey: DailyActionSortHeaderKey.ENTRY_TYPE,
		},
		{
			label: t('common.productName'),
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.PRODUCT_NAME,
			sortKey: DailyActionSortHeaderKey.PRODUCT_NAME,
		},
		{
			label: t('common.supplierOrCustomer'),
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.SUPPLIER_CUSTOMER,
			sortKey: DailyActionSortHeaderKey.SUPPLIER_CUSTOMER,
		},
		{
			label: t('common.weight'),
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.WEIGHT,
			sortKey: DailyActionSortHeaderKey.WEIGHT,
		},
		{
			label: t('common.unitPrice'),
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.UNIT_PRICE,
			sortKey: DailyActionSortHeaderKey.UNIT_PRICE,
		},
		{
			label: t('common.totalPrice'),
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.TOTAL_PRICE,
			sortKey: DailyActionSortHeaderKey.TOTAL_PRICE,
		},
		{
			label: t('common.createdAt'),
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.CREATED_AT,
			sortKey: DailyActionSortHeaderKey.CREATED_AT,
		},
		{
			label: null,
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT,
			sortKey: null,
			isStickyRight: true,
		},
	].filter(isTruthy)

	return (
		<Tr background="#fff">
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
								...listStyles.tableHeaderStickyRight,
								width: `${header.width}rem`,
							}}
						/>
					)
				}

				return (
					<Th
						key={index}
						sx={listStyles.tableHeader}
						width={`${header.width}rem`}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
					>
						<Flex alignItems="center" gap="0.25rem">
							<Text sx={listStyles.tableHeaderText}>{header.label}</Text>
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

export default DailyActionHeaderRow
