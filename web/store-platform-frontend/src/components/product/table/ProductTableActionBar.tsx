import {
	IconButton,
	Flex,
	Text,
	useDisclosure,
	Tooltip,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import useAllowedActions from '../../../shared/hooks/useAllowedActions'
import { useWarehouseScope } from '../../../shared/hooks/useWarehouseScope'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useBulkDeleteProductsMutation } from '../../../api/apiStore'
import useCustomToast from '../../common/CustomToast'
import { AsTrashIcon } from '../../../icons/Trash'
import { AsTruckIcon } from '../../../shared/icons/Truck'
import { useOfflineSync } from '../../../shared/hooks/useOfflineSync'
import { useUser } from '../../../shared/hooks/useUser'
import { AsEditIcon } from '../../icons/Edit'
import BulkEditModal from '../BulkEditModal'

const styles = {
	mainFlexWrapper: {
		minHeight: '3.375rem',
		padding: '0.625rem 1.25rem',
		justifyContent: 'space-between',
		alignItems: 'center',
		width: '100%',
		background: '#F4F4F4',
		marginTop: '0.5rem',
		flexWrap: 'wrap',
		gap: '0.5rem',
	},
	text: {
		color: '#929494',
		fontSize: '0.75rem',
		fontWeight: 700,
		lineHeight: '1rem',
		fontStyle: 'normal',
	},
	iconWrapper: {
		alignItems: 'center',
		gap: '1.25rem',
		flexWrap: 'wrap',
	},
	iconButton: {
		background: '#EAEAEA',
		...hoverFocusActiveButtonStyles,
	},
} satisfies StylesObject

interface ProductTableActionBarProps {
	selectedProducts: Product[]
	onMovementProducts: (products: Product[]) => void
}

const ProductTableActionBar = ({
	selectedProducts,
	onMovementProducts,
}: ProductTableActionBarProps) => {
	const { t } = useTranslation()
	const {
		canDeleteProduct,
		canEditProduct,
		canEditStockQuantity,
		canEditMinStockQuantity,
	} = useAllowedActions()
	const { isOperational, hasMultipleAccessible, operationalWarehouseId } =
		useWarehouseScope()
	const { user } = useUser()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const { isOnline } = useOfflineSync(user?.tenantId)
	const {
		isOpen: isBulkEditModalOpen,
		onOpen: onOpenBulkEditModal,
		onClose: onCloseBulkEditModal,
	} = useDisclosure()
	const showToast = useCustomToast()
	const [bulkDelete, { isLoading: isDeleting }] =
		useBulkDeleteProductsMutation()
	const canDelete = canDeleteProduct
	const canBulkEdit = canEditProduct
	const canMove =
		canEditStockQuantity &&
		isOperational &&
		hasMultipleAccessible &&
		selectedProducts.length >= 1

	const handleDelete = async () => {
		try {
			const result = await bulkDelete(
				selectedProducts.map(product => product.productId),
			).unwrap()

			onClose()

			if (result.blocked.length) {
				showToast({
					status: 'error',
					description:
						result.blocked[0]?.reason ||
						t('components.product.deleteProductError'),
				})
				return
			}

			showToast({
				status: 'success',
				description: t('components.product.deleteSelectedSuccess', {
					count: result.deleted.length,
				}),
			})
		} catch (error) {
			const err = error as { data?: { message?: string } }

			showToast({
				status: 'error',
				description:
					err.data?.message || t('components.product.deleteProductError'),
			})
		}
	}

	return (
		<Flex sx={styles.mainFlexWrapper}>
			<Text sx={styles.text}>
				{`${selectedProducts.length} 	${t('common.selected')}`}
			</Text>

			<Flex sx={styles.iconWrapper}>
				{canBulkEdit ? (
					<IconButton
						sx={styles.iconButton}
						aria-label={t('components.product.bulkEdit.title')}
						icon={<AsEditIcon boxSize={5} />}
						size="sm"
						isDisabled={!selectedProducts.length}
						onClick={onOpenBulkEditModal}
					/>
				) : null}
				{canMove ? (
					<Tooltip
						label={t('components.product.warehouseTransfer.movementOffline')}
						isDisabled={isOnline}
					>
						<span>
							<IconButton
								sx={styles.iconButton}
								aria-label={t('components.product.warehouseTransfer.movement')}
								icon={<AsTruckIcon boxSize={5} />}
								size="sm"
								isDisabled={!isOnline}
								onClick={() => onMovementProducts(selectedProducts)}
							/>
						</span>
					</Tooltip>
				) : null}
				{canDelete ? (
					<IconButton
						sx={styles.iconButton}
						aria-label={t('components.product.deleteSelected')}
						icon={<AsTrashIcon boxSize={5} />}
						size="sm"
						onClick={onOpen}
					/>
				) : null}
			</Flex>
			<ConfirmationDialog
				header={t('components.product.deleteSelected')}
				body={t('components.product.deleteSelectedConfirm', {
					count: selectedProducts.length,
				})}
				isOpen={isOpen}
				onClose={onClose}
				onConfirm={handleDelete}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeleting}
				isTemporaryDisabled={true}
			/>

			<BulkEditModal
				isOpen={isBulkEditModalOpen}
				onClose={onCloseBulkEditModal}
				selectedProducts={selectedProducts}
				canEditMinQuantity={
					canEditMinStockQuantity &&
					isOperational &&
					Boolean(operationalWarehouseId)
				}
				operationalWarehouseId={operationalWarehouseId ?? undefined}
			/>
		</Flex>
	)
}

export default ProductTableActionBar
