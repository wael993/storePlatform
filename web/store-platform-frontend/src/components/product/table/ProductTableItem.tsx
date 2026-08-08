import { Td, Checkbox, Flex, Text, Skeleton } from '@chakra-ui/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
// import { formatDate } from '../../../shared/dateUtils'
import useAllowedActions from '../../../shared/hooks/useAllowedActions'
import { useUser } from '../../../shared/hooks/useUser'
import { listStyles, cellFieldStyles } from '../../../shared/styles'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import EditableCellField from '../../list/EditableCellField'
import {
	PRODUCT_STATE_CONFIG,
	PROMOTION_LIST_WIDTHS_MAP_IN_REM,
} from '../../list/shared/constants'
import OptionsPopover from '../../modals/OptionsPopover'
import NotificationCircle from '../../NotificationCircle'
import StateCircle from '../../StateCircle'
import { withNoValueFallback } from '../../../shared/utils'
import { useProductInlineEdit } from '../useProductInlineEdit'

interface ProductTableItemProps {
	product: Product
	onSelect: (id: string) => void
	isSelected: boolean
	isHovered: boolean
	isLoading: boolean
}
const ProductTableItem = memo(
	({
		product: productData,
		onSelect,
		isSelected,
		isHovered,
		isLoading,
	}: ProductTableItemProps) => {
		const { editField, isFieldInProgress } = useProductInlineEdit(productData)

		const productState = PRODUCT_STATE_CONFIG[productData.status]

		const showCheckbox = true
		const isReadyForExecution = false

		const { t } = useTranslation()
		const { isOwnerOrAdmin } = useUser()
		const {
			seeSupplier,
			canEditWholesalePrice,
			canEditDiscount,
			canEditBuyCost,
			seeStockQuantity,
			canEditStockQuantity,
			seeMinStockQuantity,
			canEditMinStockQuantity,
			seeWholesalePrice,
			seeDiscount,
			seeBuyCost,
		} = useAllowedActions()

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
			rightStickyContainerContent: {
				gap: '1rem',
				alignItems: 'center',
				justifyContent: 'flex-end',
				width: '14rem',
			},
			cellContentWrapperSticky: {
				height: '100%',
				alignItems: 'center',
				justifyContent: 'start',
			},
			checkboxWrapper: {
				backgroundColor: isHovered ? '#F4F4F4' : '#FFFFFF',
				padding: 0,
			},
			text: {
				...listStyles.tableCellText,
				color: isReadyForExecution && !isHovered ? '#B2B2B2' : '#1E1E1E',
			},
			rightStickyContainer: {
				width: `${PROMOTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`,
				position: 'sticky',
				right: '0',
				zIndex: '1',
				background: `linear-gradient(to right, transparent 0rem, transparent 0rem, #FFFFFF 7rem, #FFFFFF 2rem, #FFFFFF ${PROMOTION_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem)`,
			},
			topSectionMenu: {
				boxSize: 7,
				bg: 'transparent',
				fontSize: 'xl',
				color: '#1E1E1E',
				...hoverFocusActiveButtonStyles,
			},
			actionItem: {
				py: '0.875rem',
				alignItems: 'center',
				cursor: 'pointer',
			},
			skeletonText: {
				width: '13rem',
				height: '1.5rem',
			},
			icon: {
				fontSize: '1.5rem',
				color: '#929494',
			},
		} satisfies StylesObject

		return (
			<>
				{/* Checkbox */}
				{showCheckbox && (
					<Td sx={{ ...styles.tableRow, ...styles.checkboxRow }}>
						<Flex
							sx={{ ...styles.cellContentWrapper, ...styles.checkboxWrapper }}
							onClick={e => {
								onSelect(productData.productId)

								e.stopPropagation()
							}}
							cursor={'pointer'}
						>
							<Skeleton isLoaded={!isLoading}>
								<Checkbox
									pointerEvents={'none'}
									isChecked={isSelected}
									zIndex={2}
									padding={4}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}

				{/* Name*/}
				<Td sx={styles.tableRow}>
					<Flex
						sx={{
							...styles.cellContentWrapper,
							padding: isLoading ? '1rem' : 0,
						}}
					>
						<Skeleton isLoaded={!isLoading}>
							<EditableCellField
								value={productData.name}
								ariaLabel={t('common.productName')}
								onEdit={value => editField('name', value)}
								isEditable={isOwnerOrAdmin}
								customStyles={{
									...cellFieldStyles,
									valueText: {
										...cellFieldStyles.valueText,
										textAlign: 'left',
										fontWeight: 500,
									},
								}}
								fontColor={'#1E1E1E'}
								isLoading={isFieldInProgress('name')}
							/>
						</Skeleton>
					</Flex>
				</Td>

				{/* Barcode */}
				<Td sx={styles.tableRow}>
					<Flex
						sx={{
							...styles.cellContentWrapper,
							padding: isLoading ? '1rem' : 0,
						}}
					>
						<Skeleton isLoaded={!isLoading}>
							<EditableCellField
								value={productData.barcode ?? ''}
								ariaLabel={t('common.barcode')}
								onEdit={value => editField('barcode', value)}
								isEditable={isOwnerOrAdmin}
								customStyles={{
									...cellFieldStyles,
									valueText: {
										...cellFieldStyles.valueText,
										textAlign: 'left',
										fontWeight: 500,
									},
								}}
								fontColor={'#1E1E1E'}
								isLoading={isFieldInProgress('barcode')}
							/>
						</Skeleton>
					</Flex>
				</Td>

				{/* Category Name */}
				<Td sx={styles.tableRow}>
					<Flex
						sx={{
							...styles.cellContentWrapper,
							flexDirection: 'column',
							justifyContent: 'center',
							alignItems: 'start',
						}}
					>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>
								{withNoValueFallback(productData.categoryName)}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Supplier (A&P only) */}
				{isOwnerOrAdmin && seeSupplier && (
					<Td sx={{ ...styles.tableRow }}>
						<Flex sx={{ ...styles.cellContentWrapper }}>
							<Skeleton isLoaded={!isLoading}>
								<Text sx={styles.text}>
									{withNoValueFallback(productData.supplierName)}
								</Text>
							</Skeleton>
						</Flex>
					</Td>
				)}

				{/* Stock Quantity */}

				{seeStockQuantity && (
					<Td sx={styles.tableRow}>
						<Flex
							sx={{
								...styles.cellContentWrapper,
								padding: isLoading ? '1rem' : 0,
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<EditableCellField
									value={withNoValueFallback(
										productData.inventory?.quantity?.toLocaleString(),
									)}
									isNumberField={true}
									minimumDecimals={0}
									ariaLabel={t('common.stockQuantity')}
									onEdit={value => editField('quantity', value)}
									isEditable={canEditStockQuantity}
									customStyles={{
										...cellFieldStyles,
										valueText: {
											...cellFieldStyles.valueText,
											textAlign: 'left',
										},
									}}
									fontColor={'#1E1E1E'}
									isLoading={isFieldInProgress('quantity')}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}

				{seeMinStockQuantity && (
					<Td sx={styles.tableRow}>
						<Flex
							sx={{
								...styles.cellContentWrapper,
								padding: isLoading ? '1rem' : 0,
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<EditableCellField
									value={withNoValueFallback(
										productData.inventory?.minQuantity?.toLocaleString(),
									)}
									isNumberField={true}
									minimumDecimals={0}
									ariaLabel={t('common.stockMinQuantity')}
									onEdit={value => editField('minQuantity', value)}
									isEditable={canEditMinStockQuantity}
									customStyles={{
										...cellFieldStyles,
										valueText: {
											...cellFieldStyles.valueText,
											textAlign: 'left',
										},
									}}
									fontColor={'#1E1E1E'}
									isLoading={isFieldInProgress('minQuantity')}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}
				{/* price buy Cost */}
				{isOwnerOrAdmin && seeBuyCost && (
					<Td sx={styles.tableRow}>
						<Flex
							sx={{
								...styles.cellContentWrapper,
								padding: isLoading ? '1rem' : 0,
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<EditableCellField
									value={
										productData.price.purchasePrice?.toLocaleString() ?? ''
									}
									isNumberField={false}
									ariaLabel={t('common.buyCost')}
									placeholder={t('common.addBuyCost')}
									onEdit={value => editField('purchasePrice', value)}
									isEditable={canEditBuyCost}
									customStyles={{
										...cellFieldStyles,
										valueText: {
											...cellFieldStyles.valueText,
											textAlign: 'left',
										},
									}}
									fontColor={'#1E1E1E'}
									isLoading={isFieldInProgress('purchasePrice')}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}
				{/* Wholesale Price */}
				{isOwnerOrAdmin && seeWholesalePrice && (
					<Td sx={styles.tableRow}>
						<Flex
							sx={{
								...styles.cellContentWrapper,
								padding: isLoading ? '1rem' : 0,
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<EditableCellField
									value={productData.price.retailPrice?.toLocaleString() ?? ''}
									isNumberField={true}
									ariaLabel={t('common.sellPrice')}
									onEdit={value => editField('retailPrice', value)}
									isEditable={canEditWholesalePrice}
									customStyles={{
										...cellFieldStyles,
										valueText: {
											...cellFieldStyles.valueText,
											textAlign: 'left',
										},
									}}
									fontColor={'#1E1E1E'}
									isLoading={isFieldInProgress('retailPrice')}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}

				{/* Discount (editable) */}
				{seeDiscount && (
					<Td sx={styles.tableRow}>
						<Flex
							sx={{
								...styles.cellContentWrapper,
								padding: isLoading ? '1rem' : 0,
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<EditableCellField
									value={withNoValueFallback(
										productData.price.discount?.toLocaleString(),
									)}
									isNumberField={true}
									minimumDecimals={0}
									ariaLabel={t('common.discount')}
									placeholder={t('common.addDiscount')}
									onEdit={value => editField('discount', value)}
									currency={'%'}
									isEditable={canEditDiscount}
									customStyles={{
										...cellFieldStyles,
										valueText: {
											...cellFieldStyles.valueText,
											textAlign: 'left',
										},
									}}
									fontColor={'#1E1E1E'}
									isLoading={isFieldInProgress('discount')}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}

				{/* <Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>
								{withNoValueFallback(productData.inventory?.shelfId)}
								shelf
							</Text>
						</Skeleton>
					</Flex>
				</Td> */}

				{/* Warehouse */}
				{/* <Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>warehouseId</Text>
						</Skeleton>
					</Flex>
				</Td> */}
				{/* <Td sx={styles.tableRow}>
					<Flex
						sx={{
							...styles.cellContentWrapper,
							flexDirection: 'column',
							justifyContent: 'center',
							alignItems: 'start',
						}}
					>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>
								{productData.name ? formatDate(new Date()) : ''}
							</Text>
							<Text sx={styles.text}>
								{productData.name ? formatDate(new Date()) : ''}
							</Text>
						</Skeleton>
					</Flex>
				</Td> */}

				<Td
					sx={{ ...styles.tableRow, ...styles.rightStickyContainer, right: 1 }}
				>
					<Flex sx={styles.rightStickyContainerContent}>
						{/* Notification Circle & State Circle */}
						<Flex sx={styles.cellContentWrapperSticky}>
							<Skeleton isLoaded={!isLoading}>
								<NotificationCircle
									productId={productData.productId}
									showIfNoChanges={true}
									customStyles={{
										animationCircle: { width: '1.5rem', height: '1.5rem' },
									}}
								>
									<StateCircle
										stateColor={productState?.color}
										stateTitle={productState?.translationKey}
										customStyles={{
											colorCircle: { width: '0.875rem', height: '0.875rem' },
										}}
									/>
								</NotificationCircle>
							</Skeleton>
						</Flex>
						<Flex sx={styles.cellContentWrapperSticky}>
							<Skeleton isLoaded={!isLoading}>
								<OptionsPopover offer={'offer'} />
							</Skeleton>
						</Flex>
					</Flex>
				</Td>
			</>
		)
	},
)

ProductTableItem.displayName = 'ProductTableItem'

export default ProductTableItem
