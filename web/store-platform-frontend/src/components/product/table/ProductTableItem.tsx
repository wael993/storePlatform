import { Td, Checkbox, Flex, Text, Skeleton } from '@chakra-ui/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useListItem } from '../../list/hooks/useListItem'
import { formatDate } from '../../../shared/dateUtils'
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
		const {
			handleEditBuyCost,
			handleEditSellPrice,
			handleEditDiscount,
			handleEditStockQuantity,
			handleEditStockMinQuantity,
			handleEditLocationShelf,
			handleEditLocationWarehouse,
			patchProductProgressState,
		} = useListItem(productData)

		const productState = PRODUCT_STATE_CONFIG[productData.state]

		const showCheckbox = true
		const isReadyForExecution = false

		const { t } = useTranslation()
		const { isOwnerOrAdmin } = useUser()
		const {
			seeSupplier,
			canEditStockQuantity,
			canEditMinStockQuantity,
			canEditWholesalePrice,
			canEditDiscount,
			canEditLocationShelf,
			canEditLocationWarehouse,
			canEditBuyCost,
			seeStockQuantity,
			seeMinStockQuantity,
			seeWholesalePrice,
			seeDiscount,
			seeBuyCost,
			seeLocationShelf,
			seeLocationWarehouse,
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
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={{ ...styles.text, fontWeight: 500 }}>
								{productData.name}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Barcode */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={{ ...styles.text, fontWeight: 500 }}>
								{productData.barcode}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

				{/* Brand */}
				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>
								{productData.brandName ?? productData.brandId ?? '-'}
							</Text>
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
								{productData.categoryName ?? productData.categoryId ?? '-'}
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
									{productData.supplierName ?? productData.supplierId ?? ''}
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
									value={productData.stock?.quantity?.toLocaleString() ?? ''}
									minimumDecimals={0}
									maximumDecimals={0}
									isNumberField={true}
									ariaLabel={t('common.stockQuantity')}
									onEdit={handleEditStockQuantity}
									isEditable={canEditStockQuantity}
									customStyles={{
										...cellFieldStyles,
										valueText: {
											...cellFieldStyles.valueText,
											textAlign: 'left',
										},
									}}
									fontColor={'#1E1E1E'}
									isLoading={
										patchProductProgressState.isStockQuantityInProgress
									}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}

				{/* Stock Min Quantity */}
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
									value={productData.stock?.minQuantity?.toLocaleString() ?? ''}
									minimumDecimals={0}
									maximumDecimals={0}
									isNumberField={true}
									ariaLabel={t('common.stockMinQuantity')}
									onEdit={handleEditStockMinQuantity}
									isEditable={canEditMinStockQuantity}
									customStyles={{
										...cellFieldStyles,
										valueText: {
											...cellFieldStyles.valueText,
											textAlign: 'left',
										},
									}}
									fontColor={'#1E1E1E'}
									isLoading={
										patchProductProgressState.isStockMinQuantityInProgress
									}
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
									value={productData.price.buyCost?.toLocaleString() ?? ''}
									isNumberField={false}
									ariaLabel={t('common.buyCost')}
									placeholder={t('common.addBuyCost')}
									onEdit={handleEditBuyCost}
									isEditable={canEditBuyCost}
									customStyles={{
										...cellFieldStyles,
										valueText: {
											...cellFieldStyles.valueText,
											textAlign: 'left',
										},
									}}
									fontColor={'#1E1E1E'}
									isLoading={patchProductProgressState.isBuyCostInProgress}
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
									value={productData.price.wholesale?.toLocaleString() ?? ''}
									isNumberField={true}
									ariaLabel={t('common.sellPrice')}
									onEdit={handleEditSellPrice}
									isEditable={canEditWholesalePrice}
									customStyles={{
										...cellFieldStyles,
										valueText: {
											...cellFieldStyles.valueText,
											textAlign: 'left',
										},
									}}
									fontColor={'#1E1E1E'}
									isLoading={
										patchProductProgressState.isWholesalePriceInProgress
									}
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
									value={productData.price.discount?.toLocaleString() ?? ''}
									isNumberField={true}
									minimumDecimals={0}
									ariaLabel={t('common.discount')}
									placeholder={t('common.addDiscount')}
									onEdit={handleEditDiscount}
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
									isLoading={patchProductProgressState.isDiscountInProgress}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}

				{/* Location Shelf (editable) */}
				{seeLocationShelf && (
					<Td sx={styles.tableRow}>
						<Flex
							sx={{
								...styles.cellContentWrapper,
								padding: isLoading ? '1rem' : 0,
								justifyContent: 'flex-start',
								paddingRight: '1.5rem',
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<EditableCellField
									value={productData.location?.shelf ?? ''}
									minimumDecimals={0}
									isNumberField={false}
									ariaLabel={t('common.locationShelf')}
									onEdit={handleEditLocationShelf}
									isEditable={canEditLocationShelf}
									customStyles={cellFieldStyles}
									fontColor={'#1E1E1E'}
									isLoading={
										patchProductProgressState.isLocationShelfInProgress
									}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}
				{/* Location Warehouse (editable) */}
				{seeLocationWarehouse && (
					<Td sx={styles.tableRow}>
						<Flex
							sx={{
								...styles.cellContentWrapper,
								padding: isLoading ? '1rem' : 0,
								justifyContent: 'flex-start',
								paddingRight: '1.5rem',
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<EditableCellField
									value={productData.location?.warehouse ?? ''}
									minimumDecimals={0}
									isNumberField={false}
									ariaLabel={t('common.locationWarehouse')}
									onEdit={handleEditLocationWarehouse}
									isEditable={canEditLocationWarehouse}
									customStyles={cellFieldStyles}
									fontColor={'#1E1E1E'}
									isLoading={
										patchProductProgressState.isLocationWarehouseInProgress
									}
								/>
							</Skeleton>
						</Flex>
					</Td>
				)}

				<Td sx={styles.tableRow}>
					<Flex sx={styles.cellContentWrapper}>
						<Skeleton isLoaded={!isLoading}>
							<Text sx={styles.text}>{productData.attributes?.color}</Text>
						</Skeleton>
					</Flex>
				</Td>
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
								{productData.name ? formatDate(new Date()) : ''}
							</Text>
							<Text sx={styles.text}>
								{productData.name ? formatDate(new Date()) : ''}
							</Text>
						</Skeleton>
					</Flex>
				</Td>

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
