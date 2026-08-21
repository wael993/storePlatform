import { IconButton, Flex, Text, useDisclosure } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import { AllowedActions } from '../../../shared/globalEnums'
import { useResources } from '../../../shared/hooks/useResources'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useBulkDeleteProductsMutation } from '../../../api/apiStore'
import useCustomToast from '../../common/CustomToast'
import { AsTrashIcon } from '../../../icons/Trash'

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
	selectedActivities: Product[]
}

const ProductTableActionBar = ({
	selectedActivities,
}: ProductTableActionBarProps) => {
	const { t } = useTranslation()
	const { isActionAllowed } = useResources()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const showToast = useCustomToast()
	const [bulkDelete, { isLoading: isDeleting }] =
		useBulkDeleteProductsMutation()
	const canDelete = isActionAllowed(AllowedActions.DELETE_PRODUCT)

	const handleDelete = async () => {
		try {
			const result = await bulkDelete(
				selectedActivities.map(product => product.productId),
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
				{`${selectedActivities.length} 	${t('common.selected')}`}
			</Text>
			<Flex sx={styles.iconWrapper}>
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
					count: selectedActivities.length,
				})}
				isOpen={isOpen}
				onClose={onClose}
				onConfirm={handleDelete}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeleting}
			/>
		</Flex>
	)
}

export default ProductTableActionBar
