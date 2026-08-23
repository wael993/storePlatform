import { IconButton, Flex, Text, useDisclosure } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useBulkDeleteSuppliersMutation } from '../../../api/apiStore'
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

interface SupplierListActionBarProps {
	selectedSuppliers: Supplier[]
}

const SupplierListActionBar = ({
	selectedSuppliers,
}: SupplierListActionBarProps) => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const showToast = useCustomToast()
	const [bulkDelete, { isLoading: isDeleting }] =
		useBulkDeleteSuppliersMutation()
	const canDelete = canSee(SEE.suppliersDelete)

	const handleDelete = async () => {
		try {
			const result = await bulkDelete(
				selectedSuppliers.map(supplier => supplier.supplierId),
			).unwrap()

			onClose()

			if (result.deleted.length) {
				showToast({
					status: 'success',
					description: t('components.supplier.deleteSelectedSuccess', {
						count: result.deleted.length,
					}),
				})
			}

			if (result.blocked.length) {
				showToast({
					status: 'error',
					description:
						result.blocked[0]?.reason ||
						t('components.supplier.deleteSupplierError'),
				})
			}
		} catch (error) {
			const err = error as { data?: { message?: string } }

			showToast({
				status: 'error',
				description:
					err.data?.message || t('components.supplier.deleteSupplierError'),
			})
		}
	}

	return (
		<Flex sx={styles.mainFlexWrapper}>
			<Text sx={styles.text}>
				{`${selectedSuppliers.length} 	${t('common.selected')}`}
			</Text>
			<Flex sx={styles.iconWrapper}>
				{canDelete ? (
					<IconButton
						sx={styles.iconButton}
						aria-label={t('components.supplier.deleteSelected')}
						icon={<AsTrashIcon boxSize={5} />}
						size="sm"
						onClick={onOpen}
					/>
				) : null}
			</Flex>
			<ConfirmationDialog
				header={t('components.supplier.deleteSelected')}
				body={t('components.supplier.deleteSelectedConfirm', {
					count: selectedSuppliers.length,
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

export default SupplierListActionBar
