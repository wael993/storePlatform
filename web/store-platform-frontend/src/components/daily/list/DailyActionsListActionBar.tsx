import { Button, Flex, Text, useDisclosure } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import { AsCheckmarkCircleIcon } from '../../../icons/CheckmarkCircle'
import { AsCloseCircleIcon } from '../../../icons/CloseIconCircle'
import { AllowedActions } from '../../../shared/globalEnums'
import { useResources } from '../../../shared/hooks/useResources'
import { useUser } from '../../../shared/hooks/useUser'
import AddRequiredDocumentButton from '../../common/AddRequiredDocumentButton'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useDeleteDailyActionMutation } from '../../../api/apiStore'
import useCustomToast from '../../common/CustomToast'

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
	requiredDocumentButton: {
		backgroundColor: '#EAEAEA',
		color: '#1E1E1E',
		fontSize: '0.875rem',
		fontWeight: '700',
		height: '2rem',
		paddingLeft: '0.625rem',
		paddingRight: '0.625rem',
		width: 'unset',
	},
} satisfies StylesObject

interface DailyListActionBarProps {
	selectedDailies: DailyAction[]
	isRejectActivityInProgress: boolean
	onAddRequiredDocument: (
		selectedDailies: DailyAction[],
		data: {},
	) => Promise<void>
	isAddRequiredDocumentInProgress: boolean
}

const DailyListActionBar = ({
	selectedDailies,
	isRejectActivityInProgress,
	onAddRequiredDocument,
	isAddRequiredDocumentInProgress,
}: DailyListActionBarProps) => {
	const { t } = useTranslation()
	const { isActionAllowed } = useResources()
	const { isAdmin, user } = useUser()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const showToastMessage = useCustomToast()
	const [deleteDailyAction, { isLoading: isDeletingDailyAction }] =
		useDeleteDailyActionMutation()
	const isRequiredDocumentCreationAllowed = isActionAllowed(
		AllowedActions.ADD_PRODUCT,
	)

	const handleDeleteDailyAction = async (dailyActionIds: string[]) => {
		try {
			await deleteDailyAction(dailyActionIds).unwrap()
			onClose()
			showToastMessage({
				status: 'success',
				description: t(
					'components.daily.confirmations.deleteDailyActionSuccess',
				),
			})
		} catch (error) {
			showToastMessage({
				status: 'error',
				description: t('components.daily.confirmations.deleteDailyActionError'),
			})
		}
	}

	const requiredDocumentCreatableOffers = true

	const handleAddRequiredDocument = async (
		documentName: string,
		deadline: string,
	) => {
		await onAddRequiredDocument([], {})
	}

	return (
		<Flex sx={styles.mainFlexWrapper}>
			<Text sx={styles.text}>
				{`${selectedDailies.length} 	${t('common.selected')}`}
			</Text>
			<Flex sx={styles.iconWrapper}>
				{isRequiredDocumentCreationAllowed && isAdmin && (
					<AddRequiredDocumentButton
						onAddDocument={handleAddRequiredDocument}
						isLoading={isAddRequiredDocumentInProgress}
						isDisabled={
							!requiredDocumentCreatableOffers ||
							isAddRequiredDocumentInProgress
						}
						// requiredDocumentButtonStyles={styles.requiredDocumentButton}
						requiredDocumentIconStyles={
							{
								// color: '#1E1E1E',
								// boxSize: '5',
							}
						}
					/>
				)}

				{isActionAllowed(AllowedActions.CAN_DELETE_DAILY_ACTION) && isAdmin && (
					<Button
						sx={styles.iconButton}
						isDisabled={false}
						isLoading={isRejectActivityInProgress}
						size={'sm'}
						rightIcon={<AsCloseCircleIcon boxSize={6} />}
						onClick={() => {
							onOpen()
						}}
						aria-label={t('common.delete')}
					>
						{t('common.delete')}
					</Button>
				)}
				<Button
					isDisabled={false}
					size={'sm'}
					rightIcon={<AsCheckmarkCircleIcon boxSize={6} />}
					aria-label={t('common.lock')}
					variant="primary"
					sx={{
						...styles.iconButton,
						backgroundColor: '#376288',
						color: '#FFFFFF',
						hoverFocusActiveButtonStyles,
					}}
					onClick={() => {
						console.log('modal closed')
					}}
				>
					{t('common.lock')}
				</Button>
			</Flex>

			<ConfirmationDialog
				header={t('components.daily.confirmations.deleteDailyAction')}
				body={t(
					'components.daily.confirmations.deleteDailyActionConfirmationBody',
				)}
				isOpen={isOpen}
				onClose={onClose}
				onConfirm={() =>
					handleDeleteDailyAction(
						selectedDailies.map(dailyAction => dailyAction.actionId),
					)
				}
				confirmIsPrimary
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeletingDailyAction}
			/>
		</Flex>
	)
}

export default DailyListActionBar
