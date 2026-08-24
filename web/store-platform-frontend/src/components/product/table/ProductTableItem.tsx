import {
	Td,
	Checkbox,
	Flex,
	Text,
	Skeleton,
	useDisclosure,
} from '@chakra-ui/react'
import { memo, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import useAllowedActions from '../../../shared/hooks/useAllowedActions'
import { listStyles, cellFieldStyles } from '../../../shared/styles'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import EditableCellField from '../../list/EditableCellField'
import {
	PRODUCT_STATE_CONFIG,
	PRODUCT_LIST_WIDTHS_MAP_IN_REM,
} from '../../list/shared/constants'
import OptionsPopover from '../../modals/OptionsPopover'
import NotificationCircle from '../../NotificationCircle'
import StateCircle from '../../StateCircle'
import { formatDate } from '../../../shared/dateUtils'
import { formatNumber, withNoValueFallback } from '../../../shared/utils'
import { useProductInlineEdit } from '../useProductInlineEdit'
import { usePrintProductBarcode } from '../usePrintProductBarcode'
import PrintBarcodeModal from '../PrintBarcodeModal'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useDeleteProductMutation } from '../../../api/apiStore'
import useCustomToast from '../../common/CustomToast'
import { useListColumnConfig } from '../../list/columnConfig/ListColumnConfigProvider'

interface ProductTableItemProps {
	product: Product
	onSelect: (id: string) => void
	onEditProduct: (product: Product) => void
	isSelected: boolean
	isHovered: boolean
	isLoading: boolean
}

const ProductTableItem = memo(
	({
		product: productData,
		onSelect,
		onEditProduct,
		isSelected,
		isHovered,
		isLoading,
	}: ProductTableItemProps) => {
		const { editField, isFieldInProgress } = useProductInlineEdit(productData)
		const { printBarcode, isEnsuringBarcode, barcode, preview } =
			usePrintProductBarcode(productData)
		const { visibleColumns } = useListColumnConfig()

		const productState = PRODUCT_STATE_CONFIG[productData.status]
		const isReadyForExecution = false

		const { t } = useTranslation()
		const {
			canEditDiscount,
			canEditBuyCost,
			canEditSellingPrice,
			canEditStockQuantity,
			canEditMinStockQuantity,
			canDeleteProduct,
			canEditProduct,
			canEditProductName,
			canEditProductBarcode,
			canPrintBarcode,
		} = useAllowedActions()
		const {
			isOpen: isDeleteOpen,
			onOpen: onDeleteOpen,
			onClose: onDeleteClose,
		} = useDisclosure()
		const [deleteProduct, { isLoading: isDeleting }] =
			useDeleteProductMutation()
		const showToast = useCustomToast()

		const styles = {
			tableRow: {
				padding: 0,
				height: 0,
				borderBottom: '1px solid #EAEAEA',
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
				justifyContent: 'center',
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
				whiteSpace: 'normal',
				overflowWrap: 'anywhere',
				wordBreak: 'break-word',
				textAlign: 'center',
			},
			rightStickyContainer: {
				width: `${PRODUCT_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`,
				position: 'sticky',
				right: '0',
				zIndex: '1',
				background: `linear-gradient(to right, transparent 0rem, transparent 0rem, #FFFFFF 7rem, #FFFFFF 2rem, #FFFFFF ${PRODUCT_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem)`,
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

		const wrappingFieldStyles = {
			...cellFieldStyles,
			mainFlexWrapper: {
				...cellFieldStyles.mainFlexWrapper,
				maxWidth: '100%',
				width: '100%',
				justifyContent: 'center',
				paddingLeft: 0,
				alignSelf: 'center',
			},
			mainRow: {
				...cellFieldStyles.mainRow,
				maxWidth: '100%',
				width: '100%',
				justifyContent: 'center',
			},
			mainTextWrapper: {
				...(cellFieldStyles.mainTextWrapper ?? {}),
				maxWidth: '100%',
				width: '100%',
				justifyContent: 'center',
			},
			valueText: {
				...cellFieldStyles.valueText,
				textAlign: 'center' as const,
				fontWeight: 500,
				maxWidth: '100%',
				width: '100%',
				whiteSpace: 'normal',
				overflow: 'visible',
				textOverflow: 'unset',
				overflowWrap: 'anywhere',
				wordBreak: 'break-word',
				display: 'block',
				WebkitLineClamp: 'unset',
			},
		}

		const centeredFieldStyles = {
			...cellFieldStyles,
			valueText: {
				...cellFieldStyles.valueText,
				textAlign: 'center' as const,
			},
		}

		const editablePadding = {
			...styles.cellContentWrapper,
			padding: isLoading ? '1rem' : 0,
		}

		const textCell = (
			columnId: string,
			value: string | number | null | undefined,
		) => (
			<Td key={columnId} sx={styles.tableRow}>
				<Flex sx={styles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={styles.text}>{withNoValueFallback(value)}</Text>
					</Skeleton>
				</Flex>
			</Td>
		)

		const renderDataCell = (columnId: string): ReactNode => {
			switch (columnId) {
				case 'NAME':
					return (
						<Td key={columnId} sx={styles.tableRow}>
							<Flex sx={editablePadding}>
								<Skeleton isLoaded={!isLoading} width="100%">
									<EditableCellField
										value={productData.name}
										ariaLabel={t('common.productName')}
										onEdit={value => editField('name', value)}
										isEditable={canEditProductName}
										customStyles={wrappingFieldStyles}
										inputHeight="1.85rem"
										numberInputHeight="1.85rem"
										fontColor={'#1E1E1E'}
										isLoading={isFieldInProgress('name')}
									/>
								</Skeleton>
							</Flex>
						</Td>
					)
				case 'BARCODE':
					return (
						<Td key={columnId} sx={styles.tableRow}>
							<Flex sx={editablePadding}>
								<Skeleton isLoaded={!isLoading} width="100%">
									<EditableCellField
										value={productData.barcode ?? ''}
										ariaLabel={t('common.barcode')}
										onEdit={value => editField('barcode', value)}
										isEditable={canEditProductBarcode}
										customStyles={wrappingFieldStyles}
										inputHeight="1.85rem"
										numberInputHeight="1.85rem"
										fontColor={'#1E1E1E'}
										isLoading={isFieldInProgress('barcode')}
									/>
								</Skeleton>
							</Flex>
						</Td>
					)
				case 'CATEGORY_NAME':
					return (
						<Td key={columnId} sx={styles.tableRow}>
							<Flex sx={styles.cellContentWrapper}>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.text}>
										{withNoValueFallback(productData.categoryName)}
									</Text>
								</Skeleton>
							</Flex>
						</Td>
					)
				case 'SUPPLIER_NAME':
					return (
						<Td key={columnId} sx={styles.tableRow}>
							<Flex sx={styles.cellContentWrapper}>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.text}>
										{withNoValueFallback(productData.supplierName)}
									</Text>
								</Skeleton>
							</Flex>
						</Td>
					)
				case 'STOCK_QUANTITY':
					return (
						<Td key={columnId} sx={styles.tableRow}>
							<Flex sx={editablePadding}>
								<Skeleton isLoaded={!isLoading}>
									<EditableCellField
										value={productData.inventory?.quantity ?? 0}
										isNumberField={true}
										minimumDecimals={0}
										ariaLabel={t('common.stockQuantity')}
										onEdit={value => editField('quantity', value)}
										isEditable={canEditStockQuantity}
										customStyles={centeredFieldStyles}
										fontColor={'#1E1E1E'}
										isLoading={isFieldInProgress('quantity')}
									/>
								</Skeleton>
							</Flex>
						</Td>
					)
				case 'STOCK_MIN_QUANTITY':
					return (
						<Td key={columnId} sx={styles.tableRow}>
							<Flex sx={editablePadding}>
								<Skeleton isLoaded={!isLoading}>
									<EditableCellField
										value={productData.inventory?.minQuantity}
										isNumberField={true}
										minimumDecimals={0}
										ariaLabel={t('common.stockMinQuantity')}
										onEdit={value => editField('minQuantity', value)}
										isEditable={canEditMinStockQuantity}
										customStyles={centeredFieldStyles}
										fontColor={'#1E1E1E'}
										isLoading={isFieldInProgress('minQuantity')}
									/>
								</Skeleton>
							</Flex>
						</Td>
					)
				case 'PRICE_BUY':
					return (
						<Td key={columnId} sx={styles.tableRow}>
							<Flex sx={editablePadding}>
								<Skeleton isLoaded={!isLoading}>
									<EditableCellField
										value={productData.price.purchasePrice}
										isNumberField={true}
										ariaLabel={t('common.buyCost')}
										placeholder={t('common.addBuyCost')}
										onEdit={value => editField('purchasePrice', value)}
										isEditable={canEditBuyCost}
										customStyles={centeredFieldStyles}
										fontColor={'#1E1E1E'}
										isLoading={isFieldInProgress('purchasePrice')}
									/>
								</Skeleton>
							</Flex>
						</Td>
					)
				case 'PRICE_SELL':
					return (
						<Td key={columnId} sx={styles.tableRow}>
							<Flex sx={editablePadding}>
								<Skeleton isLoaded={!isLoading}>
									<EditableCellField
										value={productData.price.retailPrice}
										isNumberField={true}
										ariaLabel={t('common.sellPrice')}
										onEdit={value => editField('retailPrice', value)}
										isEditable={canEditSellingPrice}
										customStyles={centeredFieldStyles}
										fontColor={'#1E1E1E'}
										isLoading={isFieldInProgress('retailPrice')}
									/>
								</Skeleton>
							</Flex>
						</Td>
					)
				case 'DISCOUNT':
					return (
						<Td key={columnId} sx={styles.tableRow}>
							<Flex sx={editablePadding}>
								<Skeleton isLoaded={!isLoading}>
									<EditableCellField
										value={productData.price.discount}
										isNumberField={true}
										minimumDecimals={0}
										ariaLabel={t('common.discount')}
										placeholder={t('common.addDiscount')}
										onEdit={value => editField('discount', value)}
										currency={'%'}
										isEditable={canEditDiscount}
										customStyles={centeredFieldStyles}
										fontColor={'#1E1E1E'}
										isLoading={isFieldInProgress('discount')}
									/>
								</Skeleton>
							</Flex>
						</Td>
					)
				case 'LATIN_NAME':
					return textCell(columnId, productData.latinName)
				case 'INTERNAL_CODE':
					return textCell(columnId, productData.internalCode)
				case 'PRODUCT_FACTORY_CODE':
					return textCell(columnId, productData.productFactoryCode)
				case 'BRAND_NAME':
					return textCell(columnId, productData.brandName)
				case 'UNIT_NAME':
					return textCell(columnId, productData.unitName)
				case 'STATUS':
					return textCell(
						columnId,
						productState ? t(productState.translationKey) : undefined,
					)
				case 'LOCATION_WAREHOUSE':
					return textCell(columnId, productData.warehouseName)
				case 'LOCATION_SHELF':
					return textCell(columnId, productData.shelfName)
				case 'WHOLESALE_PRICE':
					return textCell(
						columnId,
						formatNumber(productData.price.wholesalePrice),
					)
				case 'SEMI_WHOLESALE_PRICE':
					return textCell(
						columnId,
						formatNumber(productData.price.semiWholesalePrice),
					)
				case 'CURRENCY':
					return textCell(columnId, productData.price.currency)
				case 'TAX_RATE':
					return textCell(columnId, productData.taxRate)
				case 'DESCRIPTION':
					return textCell(columnId, productData.description)
				case 'COLOR':
					return textCell(columnId, productData.attributes?.color)
				case 'SIZE':
					return textCell(columnId, productData.attributes?.size)
				case 'WEIGHT':
					return textCell(columnId, productData.attributes?.weight)
				case 'LENGTH':
					return textCell(columnId, productData.attributes?.length)
				case 'WIDTH':
					return textCell(columnId, productData.attributes?.width)
				case 'HEIGHT':
					return textCell(columnId, productData.attributes?.height)
				case 'FLAVOR':
					return textCell(columnId, productData.attributes?.flavor)
				case 'EXPIRY_DATE':
					return textCell(
						columnId,
						productData.attributes?.expiryDate
							? formatDate(productData.attributes.expiryDate)
							: undefined,
					)
				default:
					return <Td key={columnId} sx={styles.tableRow} />
			}
		}

		return (
			<>
				{canDeleteProduct && (
					<Td
						sx={{ ...styles.tableRow, ...styles.checkboxRow }}
						width={`${PRODUCT_LIST_WIDTHS_MAP_IN_REM.CHECKBOX}rem`}
					>
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
				{visibleColumns.map(column => renderDataCell(column.id))}
				<Td
					sx={{ ...styles.tableRow, ...styles.rightStickyContainer, right: 1 }}
					onClick={event => event.stopPropagation()}
				>
					<Flex sx={styles.rightStickyContainerContent}>
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
								{(canEditProduct || canPrintBarcode || canDeleteProduct) && (
									<OptionsPopover
										onEdit={
											canEditProduct
												? () => onEditProduct(productData)
												: undefined
										}
										onPrintBarcode={
											canPrintBarcode
												? () => {
														void printBarcode()
													}
												: undefined
										}
										isPrintLoading={isEnsuringBarcode}
										onDelete={
											canDeleteProduct
												? () => {
														onDeleteOpen()
													}
												: undefined
										}
									/>
								)}
							</Skeleton>
						</Flex>
					</Flex>
				</Td>
				{canPrintBarcode && (
					<PrintBarcodeModal
						product={productData}
						barcode={barcode}
						isOpen={preview.isOpen}
						onClose={preview.onClose}
					/>
				)}
				<ConfirmationDialog
					header={t('components.product.deleteProduct')}
					body={t('components.product.deleteProductConfirm')}
					isOpen={isDeleteOpen}
					onClose={onDeleteClose}
					onConfirm={async () => {
						try {
							await deleteProduct(productData.productId).unwrap()
							onDeleteClose()
							showToast({
								status: 'success',
								description: t('components.product.deleteProductSuccess'),
							})
						} catch (error) {
							const err = error as { data?: { message?: string } }

							showToast({
								status: 'error',
								description:
									err.data?.message ||
									t('components.product.deleteProductError'),
							})
						}
					}}
					cancelButtonText={t('common.cancel')}
					confirmationButtonText={t('common.delete')}
					isConfirmationButtonLoading={isDeleting}
				/>
			</>
		)
	},
)

ProductTableItem.displayName = 'ProductTableItem'

export default ProductTableItem
