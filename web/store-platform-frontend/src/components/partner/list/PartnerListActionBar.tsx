import { IconButton, Flex, Text, useDisclosure } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useBulkDeletePartnersMutation } from '../../../api/apiStore'
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

interface PartnerListActionBarProps {
	selectedPartners: Partner[]
}

const PartnerListActionBar = ({
	selectedPartners,
}: PartnerListActionBarProps) => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const showToast = useCustomToast()
	const [bulkDelete, { isLoading: isDeleting }] =
		useBulkDeletePartnersMutation()
	const canDelete = canSee(SEE.partnersDelete)

	const handleDelete = async () => {
		try {
			const result = await bulkDelete(
				selectedPartners.map(partner => partner.partnerId),
			).unwrap()

			onClose()

			if (result.deleted.length) {
				showToast({
					status: 'success',
					description: t('partner.deleteSelectedSuccess', {
						count: result.deleted.length,
					}),
				})
			}

			if (result.blocked.length) {
				showToast({
					status: 'error',
					description:
						result.blocked[0]?.reason || t('partner.deletePartnerError'),
				})
			}
		} catch (error) {
			const err = error as { data?: { message?: string } }

			showToast({
				status: 'error',
				description: err.data?.message || t('partner.deletePartnerError'),
			})
		}
	}

	return (
		<Flex sx={styles.mainFlexWrapper}>
			<Text sx={styles.text}>
				{`${selectedPartners.length} 	${t('common.selected')}`}
			</Text>
			<Flex sx={styles.iconWrapper}>
				{canDelete ? (
					<IconButton
						sx={styles.iconButton}
						aria-label={t('partner.deleteSelected')}
						icon={<AsTrashIcon boxSize={5} />}
						size="sm"
						onClick={onOpen}
					/>
				) : null}
			</Flex>
			<ConfirmationDialog
				header={t('partner.deleteSelected')}
				body={t('partner.deleteSelectedConfirm', {
					count: selectedPartners.length,
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

export default PartnerListActionBar
