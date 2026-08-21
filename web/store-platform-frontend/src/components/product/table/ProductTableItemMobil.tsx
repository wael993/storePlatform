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

interface ProductTableMobilProps {
	product: Product
	isLoading: boolean
	onSelect: (id: string) => void
	selectedProducts: string[]
	isOpen: boolean
	onToggle: () => void
}

const ProductTableMobil = ({
	product,
	isLoading,
	onSelect,
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
		seeWholesalePrice,
		seeDiscount,
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
							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.brand')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(product.brandId)}
									</Text>
								</Skeleton>
							</GridItem>

							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.category')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(product.categoryName)}
									</Text>
								</Skeleton>
							</GridItem>

							{isOwnerOrAdmin && seeSupplier && (
								<GridItem sx={styles.listItemGridItem}>
									<Text sx={styles.titleText}>{t('common.supplierName')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(product.supplierName)}
										</Text>
									</Skeleton>
								</GridItem>
							)}

							{seeStockQuantity && (
								<GridItem sx={styles.listItemGridItem}>
									<Text sx={styles.titleText}>{t('common.stockQuantity')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(
												formatNumber(product.inventory?.quantity, {
													minimumDecimals: 0,
													maximumDecimals: 0,
												}),
											)}
										</Text>
									</Skeleton>
								</GridItem>
							)}

							{seeMinStockQuantity && (
								<GridItem sx={styles.listItemGridItem}>
									<Text sx={styles.titleText}>
										{t('common.stockMinQuantity')}
									</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(
												formatNumber(product.inventory?.minQuantity, {
													minimumDecimals: 0,
													maximumDecimals: 0,
												}),
											)}
										</Text>
									</Skeleton>
								</GridItem>
							)}

							{isOwnerOrAdmin && seeBuyCost && (
								<GridItem sx={styles.listItemGridItem}>
									<Text sx={styles.titleText}>{t('common.buyCost')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(
												formatNumber(product.price?.purchasePrice),
											)}
										</Text>
									</Skeleton>
								</GridItem>
							)}

							{isOwnerOrAdmin && seeWholesalePrice && (
								<GridItem sx={styles.listItemGridItem}>
									<Text sx={styles.titleText}>{t('common.priceSell')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(
												formatNumber(product.price?.retailPrice),
											)}
										</Text>
									</Skeleton>
								</GridItem>
							)}

							{seeDiscount && (
								<GridItem sx={styles.listItemGridItem}>
									<Text sx={styles.titleText}>{t('common.discount')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(
												formatNumber(product.price?.discount),
											)}
										</Text>
									</Skeleton>
								</GridItem>
							)}
							{/* 
						{seeLocationShelf && (
							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.locationShelf')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(product.attributes?.color)}
									</Text>
								</Skeleton>
							</GridItem>
						)}

						{seeLocationWarehouse && (
							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>
									{t('common.locationWarehouse')}
								</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(product.attributes?.color)}
									</Text>
								</Skeleton>
							</GridItem>
						)} */}

							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>{t('common.color')}</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{withNoValueFallback(product.attributes?.color)}
									</Text>
								</Skeleton>
							</GridItem>
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
