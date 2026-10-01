import {
	AlertDialog,
	AlertDialogBody,
	AlertDialogCloseButton,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogOverlay,
	Button,
	Flex,
	Icon,
	IconProps,
	Text,
	Tooltip,
} from '@chakra-ui/react'
import { ComponentType, RefObject, useRef } from 'react'
import { hoverFocusActiveButtonStyles } from '../theme/styles'
import { useTranslation } from 'react-i18next'
import { compareLanguage } from '../shared/utils'

interface ConfirmationDialogProps {
	header: string
	headerIcon?: ComponentType<IconProps>
	body: string
	cancelButtonText?: string
	confirmationButtonText?: string
	isOpen: boolean
	onClose: () => void
	onConfirm: (() => void) | (() => Promise<void>)
	buttonsAlignment?: 'start' | 'end'
	confirmIsPrimary?: boolean
	isConfirmationButtonLoading?: boolean
	isTemporaryDisabled?: boolean
}
const styles = {
	AlertDialogHeaderSection: {
		fontSize: 'lg',
		fontWeight: 700,
		borderBottom: '1px solid #EAEAEA',
	},
	body: {
		paddingBlock: '1rem 2rem',
		borderBottom: '1px solid #EAEAEA',
	},
	bodyText: {
		fontWeight: 700,
		fontSize: '1rem',
		color: '#858585',
	},
	headerText: {
		fontWeight: 700,
		fontSize: '1.5rem',
		paddingBlock: '0.5rem',
	},
	secondaryButton: {
		...hoverFocusActiveButtonStyles,
		backgroundColor: '#EAEAEA',
		fontSize: '0.875rem',
		whiteSpace: 'nowrap',
	},
	primaryButton: {
		...hoverFocusActiveButtonStyles,
		fontSize: '0.875rem',
		backgroundColor: '#376288',
		color: '#FFFFFF',
	},
} satisfies StylesObject

const ConfirmationDialog = ({
	header,
	headerIcon,
	body,
	cancelButtonText,
	confirmationButtonText,
	isOpen,
	onClose,
	onConfirm,
	buttonsAlignment = 'end',
	confirmIsPrimary = false,
	isConfirmationButtonLoading = false,
	isTemporaryDisabled = false,
}: ConfirmationDialogProps) => {
	const { i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)

	const leastDestructiveRef = useRef<HTMLButtonElement>(
		null,
	) as RefObject<HTMLElement>

	const handleOnConfirm = async () => {
		await onConfirm()
		if (!isConfirmationButtonLoading) {
			onClose()
		}
	}

	return (
		<AlertDialog
			isOpen={isOpen}
			leastDestructiveRef={leastDestructiveRef}
			isCentered={true}
			onClose={onClose}
		>
			<AlertDialogOverlay>
				<AlertDialogContent>
					<AlertDialogCloseButton
						sx={{
							left: isArabic ? '0.4rem' : 'auto',
							right: isArabic ? 'auto' : '0.4rem',
							marginRight: 0,
						}}
					/>
					<AlertDialogHeader sx={styles.AlertDialogHeaderSection}>
						<Flex sx={{ gap: '1rem', alignItems: 'center' }}>
							<Text sx={styles.headerText}>{header}</Text>
							{headerIcon && <Icon as={headerIcon} boxSize="1.5rem" />}
						</Flex>
					</AlertDialogHeader>

					<AlertDialogBody sx={styles.body}>
						<Text sx={styles.bodyText}>{body}</Text>
					</AlertDialogBody>

					<AlertDialogFooter>
						<Flex justifyContent={buttonsAlignment} gap={'1rem'}>
							<Button sx={styles.secondaryButton} onClick={onClose}>
								{cancelButtonText}
							</Button>
							<Tooltip
								label={'سيتم اعادة تفعبل عملية الحدف في التحديث القادم.'}
								isDisabled={!isTemporaryDisabled}
							>
								{confirmIsPrimary ? (
									<Button
										sx={styles.primaryButton}
										variant="primary"
										onClick={handleOnConfirm}
										ml={3}
										isLoading={isConfirmationButtonLoading}
										isDisabled={isTemporaryDisabled}
									>
										{confirmationButtonText}
									</Button>
								) : (
									<Button
										isLoading={isConfirmationButtonLoading}
										colorScheme="red"
										onClick={handleOnConfirm}
										ml={3}
										isDisabled={isTemporaryDisabled}
									>
										{confirmationButtonText}
									</Button>
								)}
							</Tooltip>
						</Flex>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialogOverlay>
		</AlertDialog>
	)
}

export default ConfirmationDialog
