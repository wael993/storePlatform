import { IconButton, Flex, Text, useDisclosure } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useBulkDeleteCustomersMutation } from '../../../api/apiStore'
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

interface CustomerListActionBarProps {
	selectedCustomers: Customer[]
}

const CustomerListActionBar = ({
	selectedCustomers,
}: CustomerListActionBarProps) => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const showToast = useCustomToast()
	const [bulkDelete, { isLoading: isDeleting }] =
		useBulkDeleteCustomersMutation()
	const canDelete = canSee(SEE.customersDelete)

	const handleDelete = async () => {
		try {
			const result = await bulkDelete(
				selectedCustomers.map(customer => customer.customerId),
			).unwrap()

			onClose()

			if (result.deleted.length) {
				showToast({
					status: 'success',
					description: t('components.customer.deleteSelectedSuccess', {
						count: result.deleted.length,
					}),
				})
			}

			if (result.blocked.length) {
				showToast({
					status: 'error',
					description:
						result.blocked[0]?.reason ||
						t('components.customer.deleteCustomerError'),
				})
			}
		} catch (error) {
			const err = error as { data?: { message?: string } }

			showToast({
				status: 'error',
				description:
					err.data?.message || t('components.customer.deleteCustomerError'),
			})
		}
	}

	return (
		<Flex sx={styles.mainFlexWrapper}>
			<Text sx={styles.text}>
				{`${selectedCustomers.length} 	${t('common.selected')}`}
			</Text>
			<Flex sx={styles.iconWrapper}>
				{canDelete ? (
					<IconButton
						sx={styles.iconButton}
						aria-label={t('components.customer.deleteSelected')}
						icon={<AsTrashIcon boxSize={5} />}
						size="sm"
						onClick={onOpen}
					/>
				) : null}
			</Flex>
			<ConfirmationDialog
				header={t('components.customer.deleteSelected')}
				body={t('components.customer.deleteSelectedConfirm', {
					count: selectedCustomers.length,
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

export default CustomerListActionBar
