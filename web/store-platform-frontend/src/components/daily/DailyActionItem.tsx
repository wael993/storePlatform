import { Td, Checkbox, Flex, Text, Skeleton } from '@chakra-ui/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../shared/dateUtils'
import { listStyles } from '../../shared/styles'
import { ENTRY_TYPE_LABELS_MAP } from '../../shared/globalConstant'
import { DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM } from '../list/shared/constants'

const getEntryTypeValue = (entryType: DailyAction['entryType']) => {
	if (!entryType) return undefined
	if (typeof entryType === 'string') return entryType
	return entryType.value
}

interface DailyActionItemProps {
	dailyAction: DailyAction
	onSelect: (id: string) => void
	isSelected: boolean
	isHovered: boolean
	isLoading: boolean
}

const DailyActionItem = memo(
	({
		dailyAction,
		onSelect,
		isSelected,
		isHovered,
		isLoading,
	}: DailyActionItemProps) => {
		const { t } = useTranslation()

		const getEntryTypeLabel = (entryType: DailyAction['entryType']): string => {
			const entryTypeValue = getEntryTypeValue(entryType)

			if (!entryTypeValue) return '-'
			const translationKey = ENTRY_TYPE_LABELS_MAP[entryTypeValue]
			if (translationKey) return t(translationKey)

			return typeof entryType === 'string'
				? entryTypeValue
				: (entryType.label ?? entryType.value ?? '-')
		}
		const rowId = dailyAction._id ?? dailyAction.actionId ?? ''
		const entryTypeValue = getEntryTypeValue(dailyAction.entryType)
		const isPaymentOrReceiptAction =
			entryTypeValue === 'PAYMENT_ENTRY' || entryTypeValue === 'RECEIPT_ENTRY'
		const totalPrice = isPaymentOrReceiptAction
			? dailyAction.singleUnitPrice
			: dailyAction.totalPrice

		const supplierOrCustomer =
			dailyAction.supplierName ??
			dailyAction.customerName ??
			dailyAction.supplierId ??
			dailyAction.customerId ??
			'-'

		const styles = {
			tableRow: {
				padding: 0,
				height: 0,
				'@-moz-document url-prefix()': {
					height: '100%',
				},
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
			stickyRight: {
				width: `${DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`,
				position: 'sticky',
				right: '0',
				zIndex: '1',
				background: '#FFFFFF',
			},
		} satisfies StylesObject

		return (
			<>
				{/* Checkbox */}
				<Td sx={{ ...styles.tableRow, ...styles.checkboxRow }}>
					<Flex
						sx={{ ...styles.cellContentWrapper, ...styles.checkboxWrapper }}
						onClick={e => {
							onSelect(rowId)
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

				{/* Entry Type */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={{ ...styles.text, fontWeight: 600 }}>
								{getEntryTypeLabel(dailyAction.entryType)}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Product Name */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>
								{dailyAction.productName !== '' &&
								dailyAction.productName !== undefined
									? dailyAction.productName
									: '-'}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Supplier / Customer */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>{supplierOrCustomer}</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Weight */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>
								{dailyAction.weight
									? `${dailyAction.weight} ${dailyAction.unitName ?? ''}`
									: '-'}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Unit Price */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>
								{dailyAction.singleUnitPrice && !isPaymentOrReceiptAction
									? `${dailyAction.singleUnitPrice} ${dailyAction.currencyName ?? ''}`
									: '-'}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Total Price */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>
								{totalPrice
									? `${totalPrice} ${dailyAction.currencyName ?? ''}`
									: '-'}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Invoice Date */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>
								{dailyAction.invoiceDate
									? formatDate(dailyAction.invoiceDate)
									: '-'}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Created At */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>
								{dailyAction.createdAt
									? formatDate(dailyAction.createdAt)
									: '-'}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Sticky Right placeholder */}
				<Td sx={{ ...styles.tableRow, ...styles.stickyRight }}>
					<Flex sx={styles.cellContentWrapper} />
				</Td>
			</>
		)
	},
)

export default DailyActionItem
