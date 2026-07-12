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
} from '@chakra-ui/react'
import { ComponentType, RefObject, useRef } from 'react'
import { hoverFocusActiveButtonStyles } from '../theme/styles'

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
	closeButton: {
		...hoverFocusActiveButtonStyles,
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
}: ConfirmationDialogProps) => {
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
					<AlertDialogCloseButton sx={styles.closeButton} />
					<AlertDialogHeader sx={styles.AlertDialogHeaderSection}>
						<Flex>
							{headerIcon && (
								<Icon as={headerIcon} fontSize="1.5rem" mr={'1rem'} />
							)}
							<Text sx={styles.headerText}>{header}</Text>
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
							{confirmIsPrimary ? (
								<Button
									sx={styles.primaryButton}
									variant="primary"
									onClick={handleOnConfirm}
									ml={3}
									isLoading={isConfirmationButtonLoading}
								>
									{confirmationButtonText}
								</Button>
							) : (
								<Button
									isLoading={isConfirmationButtonLoading}
									colorScheme="red"
									onClick={handleOnConfirm}
									ml={3}
								>
									{confirmationButtonText}
								</Button>
							)}
						</Flex>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialogOverlay>
		</AlertDialog>
	)
}

export default ConfirmationDialog
