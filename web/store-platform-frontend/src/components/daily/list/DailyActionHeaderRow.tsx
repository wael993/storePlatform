import { Tr, Th, Text, Flex, Checkbox, Box } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import TableSort from '../../common/CustomTableSort'
import {
	DailyActionSortHeaderKey,
	SortOrder,
} from '../../list/shared/globalEnums'
import { DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { isTruthy } from '../../list/shared/utils'

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

	const getSortingButton = (sortKey: DailyActionSortHeaderKey) => {
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
			label: t('common.productOrExpense'),
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.PRODUCT_NAME,
			sortKey: DailyActionSortHeaderKey.PRODUCT_NAME,
		},
		{
			label: t('common.supplierCustomerOrExpense'),
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
			label: t('common.invoiceNumber'),
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.INVOICE_NUMBER,
			sortKey: DailyActionSortHeaderKey.INVOICE_NUMBER,
		},
		{
			label: t('common.invoiceDate'),
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.INVOICE_DATE,
			sortKey: DailyActionSortHeaderKey.INVOICE_DATE,
			align: 'center' as const,
		},

		{
			label: null,
			width: DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT,
			sortKey: null,
			isStickyRight: true,
		},
	].filter(isTruthy)

	const getStickyRightWidth = () => {
		//change this later

		return `${DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT - 7}rem`
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
							justifyContent={header.align === 'center' ? 'flex' : undefined}
							sx={{
								...styles.tableHeaderText,
								...(header.align === 'center' ? { paddingRight: '0rem' } : {}),
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

export default DailyActionHeaderRow
