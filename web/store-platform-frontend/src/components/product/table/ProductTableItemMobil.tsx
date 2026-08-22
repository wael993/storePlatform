import {
	Accordion,
	AccordionButton,
	AccordionIcon,
	AccordionItem,
	AccordionPanel,
	Box,
	Checkbox,
	Flex,
	Grid,
	GridItem,
	Skeleton,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import StateCircle from '../../StateCircle'
import NotificationCircle from '../../NotificationCircle'
import OptionsPopover from '../../modals/OptionsPopover'
import { PRODUCT_STATE_CONFIG } from '../../list/shared/constants'
import { useUser } from '../../../shared/hooks/useUser'
import useAllowedActions from '../../../shared/hooks/useAllowedActions'
import { buildRoutePath } from '../../../shared/routes'
import {
	compareLanguage,
	formatNumber,
	withNoValueFallback,
} from '../../../shared/utils'
import { formatDate } from '../../../shared/dateUtils'
import { usePrintProductBarcode } from '../usePrintProductBarcode'
import PrintBarcodeModal from '../PrintBarcodeModal'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useDeleteProductMutation } from '../../../api/apiStore'
import useCustomToast from '../../common/CustomToast'

const styles = {
	listItemGridItem: {
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'start',
		alignItems: 'start',
	},
	valueText: {
		fontSize: 'sm',
		fontWeight: 'bold',
		textAlign: 'left',
		whiteSpace: 'normal',
		wordBreak: 'break-word',
		overflowWrap: 'break-word',
	},
	titleText: {
		fontSize: 'xs',
		color: '#929494',
	},
	accordionButton: {
		flexGrow: 1,
		width: '100%',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	accordionItem: {
		borderColor: '#EAEAEA',
		borderTop: 'none',
		_notLast: {
			borderBottom: '1px solid',
			borderBottomColor: '#EAEAEA',
		},
	},
	actionsContainer: {
		mt: '2rem',
		alignItems: 'center',
		gap: '1.25rem',
		flexWrap: 'wrap',
	},
} satisfies StylesObject

const MobileField = ({
	label,
	value,
	isLoading,
}: {
	label: string
	value?: string | number | null
	isLoading: boolean
}) => (
	<GridItem sx={styles.listItemGridItem}>
		<Text sx={styles.titleText}>{label}</Text>
		<Skeleton isLoaded={!isLoading}>
			<Text sx={styles.valueText}>
				{withNoValueFallback(
					value === undefined || value === null ? value : String(value),
				)}
			</Text>
		</Skeleton>
	</GridItem>
)

interface ProductTableMobilProps {
	product: Product
	isLoading: boolean
	onSelect: (id: string) => void
	onEditProduct: (product: Product) => void
	selectedProducts: string[]
	isOpen: boolean
	onToggle: () => void
}

const ProductTableMobil = ({
	product,
	isLoading,
	onSelect,
	onEditProduct,
	selectedProducts,
	isOpen,
	onToggle,
}: ProductTableMobilProps) => {
	const navigate = useNavigate()
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const { isOwnerOrAdmin } = useUser()
	const { printBarcode, isEnsuringBarcode, barcode, preview } =
		usePrintProductBarcode(product)
	const {
		seeSupplier,
		seeStockQuantity,
		seeMinStockQuantity,
		seeBuyCost,
		seeDiscount,
		seeLocationWarehouse,
		seeLocationShelf,
		canDeleteProduct,
	} = useAllowedActions()
	const {
		isOpen: isDeleteOpen,
		onOpen: onDeleteOpen,
		onClose: onDeleteClose,
	} = useDisclosure()
	const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation()
	const showToast = useCustomToast()
	const productState = PRODUCT_STATE_CONFIG[product.status]

	const onNavigate = (event: React.MouseEvent<HTMLDivElement>) => {
		event.stopPropagation()
		if (isLoading) return
		navigate(buildRoutePath.productById(product.productId))
	}

	return (
		<>
			<Accordion allowToggle index={isOpen ? [0] : []} onChange={onToggle}>
				<AccordionItem sx={styles.accordionItem}>
					<Box display="flex" flexDirection="row">
						<AccordionButton sx={styles.accordionButton}>
							<Flex alignItems="center" gap="6" flexGrow={1}>
								<Box
									sx={{
										...styles.listItemGridItem,
										width: '1.5rem',
										flex: '0 0 auto',
									}}
								>
									<Skeleton isLoaded={!isLoading}>
										<Checkbox
											onChange={event => {
												onSelect(product.productId)
												event.stopPropagation()
											}}
											isChecked={selectedProducts.includes(product.productId)}
											zIndex={2}
										/>
									</Skeleton>
								</Box>

								<Box
									sx={{ ...styles.listItemGridItem, flex: 1 }}
									onClick={onNavigate}
								>
									<Text sx={styles.titleText}>{t('common.productName')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(product.name)}
										</Text>
									</Skeleton>
								</Box>

								<Box
									sx={{ ...styles.listItemGridItem, flex: 1 }}
									onClick={onNavigate}
								>
									<Text sx={styles.titleText}>{t('common.barcode')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(product.barcode)}
										</Text>
									</Skeleton>
								</Box>
							</Flex>
							<AccordionIcon minWidth="3rem" />
						</AccordionButton>
					</Box>

					<AccordionPanel
						overflow="hidden"
						paddingLeft={isArabic ? 0 : 16}
						paddingRight={isArabic ? 16 : 0}
					>
						<Grid templateColumns="repeat(2, 1fr)" gap="6">
							<MobileField
								isLoading={isLoading}
								label={t('productModal.latinName')}
								value={product.latinName}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.internalCode')}
								value={product.internalCode}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.productFactoryCode')}
								value={product.productFactoryCode}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('common.brand')}
								value={product.brandName}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('common.category')}
								value={product.categoryName}
							/>
							{isOwnerOrAdmin && seeSupplier && (
								<MobileField
									isLoading={isLoading}
									label={t('common.supplierName')}
									value={product.supplierName}
								/>
							)}
							<MobileField
								isLoading={isLoading}
								label={t('common.unit')}
								value={product.unitName}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('common.status')}
								value={
									productState ? t(productState.translationKey) : undefined
								}
							/>
							{seeStockQuantity && (
								<MobileField
									isLoading={isLoading}
									label={t('common.stockQuantity')}
									value={formatNumber(product.inventory?.quantity, {
										minimumDecimals: 0,
										maximumDecimals: 0,
									})}
								/>
							)}
							{seeMinStockQuantity && (
								<MobileField
									isLoading={isLoading}
									label={t('common.stockMinQuantity')}
									value={formatNumber(product.inventory?.minQuantity, {
										minimumDecimals: 0,
										maximumDecimals: 0,
									})}
								/>
							)}
							{seeLocationWarehouse && (
								<MobileField
									isLoading={isLoading}
									label={t('common.locationWarehouse')}
									value={product.warehouseName}
								/>
							)}
							{seeLocationShelf && (
								<MobileField
									isLoading={isLoading}
									label={t('common.locationShelf')}
									value={product.shelfName}
								/>
							)}
							{isOwnerOrAdmin && seeBuyCost && (
								<MobileField
									isLoading={isLoading}
									label={t('common.buyCost')}
									value={formatNumber(product.price?.purchasePrice)}
								/>
							)}
							<MobileField
								isLoading={isLoading}
								label={t('common.priceSell')}
								value={formatNumber(product.price?.retailPrice)}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.wholesalePrice')}
								value={formatNumber(product.price?.wholesalePrice)}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.semiWholesalePrice')}
								value={formatNumber(product.price?.semiWholesalePrice)}
							/>
							{seeDiscount && (
								<MobileField
									isLoading={isLoading}
									label={t('common.discount')}
									value={formatNumber(product.price?.discount)}
								/>
							)}
							<MobileField
								isLoading={isLoading}
								label={t('common.currency')}
								value={product.price?.currency}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.taxRate')}
								value={product.taxRate}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.description')}
								value={product.description}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('common.color')}
								value={product.attributes?.color}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.size')}
								value={product.attributes?.size}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('common.weight')}
								value={product.attributes?.weight}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.length')}
								value={product.attributes?.length}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.width')}
								value={product.attributes?.width}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.height')}
								value={product.attributes?.height}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.flavor')}
								value={product.attributes?.flavor}
							/>
							<MobileField
								isLoading={isLoading}
								label={t('productModal.expiryDate')}
								value={
									product.attributes?.expiryDate
										? formatDate(product.attributes.expiryDate)
										: undefined
								}
							/>
						</Grid>

						<Flex
							sx={{
								...styles.actionsContainer,
								justifyContent: isArabic ? 'flex-start' : 'flex-end',
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<NotificationCircle
									productId={product.productId}
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
							<Skeleton isLoaded={!isLoading}>
								{isOwnerOrAdmin && (
									<OptionsPopover
										onEdit={() => onEditProduct(product)}
										onPrintBarcode={() => {
											void printBarcode()
										}}
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
					</AccordionPanel>
				</AccordionItem>
			</Accordion>
			{isOwnerOrAdmin && (
				<PrintBarcodeModal
					product={product}
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
						await deleteProduct(product.productId).unwrap()
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
								err.data?.message || t('components.product.deleteProductError'),
						})
					}
				}}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeleting}
			/>
		</>
	)
}

export default ProductTableMobil
