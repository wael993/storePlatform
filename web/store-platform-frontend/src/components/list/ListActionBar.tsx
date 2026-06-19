import { Button, Flex, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { AsCloseCircleIcon } from '../../icons/CloseIconCircle'
import { AsCheckmarkCircleIcon } from '../../icons/CheckmarkCircle'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { useResources } from '../../shared/hooks/useResources'
import { AllowedActions } from '../../shared/globalEnums'
import { useUser } from '../../shared/hooks/useUser'
import AddRequiredDocumentButton from '../common/AddRequiredDocumentButton'

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

interface ListActionBarProps {
	selectedActivities: Product[]
	isRejectActivityInProgress: boolean
	onAddRequiredDocument: (
		selectedActivities: Product[],
		data: {},
	) => Promise<void>
	isAddRequiredDocumentInProgress: boolean
}
const ListActionBar = ({
	selectedActivities,
	isRejectActivityInProgress,
	onAddRequiredDocument,
	isAddRequiredDocumentInProgress,
}: ListActionBarProps) => {
	const { isActionAllowed } = useResources()
	const { isOwnerOrAdmin: isInternalUser } = useUser()

	const isRequiredDocumentCreationAllowed = isActionAllowed(
		AllowedActions.ADD_PRODUCT,
	)

	const { t } = useTranslation()

	const requiredDocumentCreatableOffers = true

	const handleAddRequiredDocument = async () => {
		await onAddRequiredDocument([], {})
	}

	return (
		<Flex sx={styles.mainFlexWrapper}>
			<Text sx={styles.text}>
				{`${selectedActivities.length} 	${t('common.selected')}`}
			</Text>
			<Flex sx={styles.iconWrapper}>
				{isRequiredDocumentCreationAllowed && isInternalUser && (
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

				{isInternalUser && (
					<Button
						sx={styles.iconButton}
						isDisabled={false}
						isLoading={isRejectActivityInProgress}
						size={'sm'}
						rightIcon={<AsCloseCircleIcon boxSize={6} />}
						onClick={() => {
							console.log('modal opened')
						}}
						aria-label={t('common.reject')}
					>
						{t('common.reject')}
					</Button>
				)}
				<Button
					isDisabled={false}
					size={'sm'}
					rightIcon={<AsCheckmarkCircleIcon boxSize={6} />}
					aria-label={t('common.accept')}
					variant="primary"
					// sx={hoverFocusActiveButtonStyles}
					onClick={() => {
						console.log('modal closed')
					}}
				>
					{t('common.accept')}
				</Button>
			</Flex>
		</Flex>
	)
}
export default ListActionBar
