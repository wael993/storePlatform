import {
	Box,
	Button,
	HStack,
	Icon,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	useDisclosure,
	VStack,
} from '@chakra-ui/react'
import { format } from 'date-fns'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import hoverFocusActiveButtonStyles from '../../theme'
import InputLabel from './InputLabel'
import { AsAddSquareIcon } from '../icons/AddSquare'
import { datePickerStyles, documentNameStyles } from '../../theme/styles'
import { AsSaveIcon } from '../icons/Save'
import DatePickerLabel from './DatePickerLabel'

const styles = {
	requiredDocumentButton: {
		color: '#929494',
		display: 'flex',
		alignItems: 'center',
		paddingLeft: { base: '0.5rem', md: '2rem' },
		fontSize: { base: 'sm', md: 'md' },
		width: '100%',
		background: 'unset',
		...hoverFocusActiveButtonStyles,
	},
	requiredDocumentIcon: {
		boxSize: { base: 4, md: 6 },
		color: '#929494',
	},
	modalBody: {
		borderY: `1px solid #EAEAEA`,
		paddingTop: '1.25rem',
		paddingBottom: '2.5rem',
		paddingX: '1.25rem',
	},
	addDocumentIcon: { boxSize: 6, color: '#FFFFFF' },
	cancelButton: {
		backgroundColor: '#EAEAEA',
		fontWeight: 700,
		fontSize: '0.875rem',
		...hoverFocusActiveButtonStyles,
	},
	saveButton: {
		backgroundColor: '#929494',
		fontWeight: 700,
		fontSize: '0.875rem',
		color: '#FFFFFF',
		...hoverFocusActiveButtonStyles,
	},
} satisfies StylesObject

interface AddRequiredDocumentButtonProps {
	onAddDocument: (documentName: string, deadline: string) => Promise<void>
	isLoading: boolean
	isDisabled?: boolean
	requiredDocumentButtonStyles?: StylesObject
	requiredDocumentIconStyles?: StylesObject
}

const AddRequiredDocumentButton = ({
	onAddDocument,
	isLoading,
	isDisabled = false,
	requiredDocumentButtonStyles = {},
	requiredDocumentIconStyles = {},
}: AddRequiredDocumentButtonProps) => {
	const { t } = useTranslation()
	const [documentName, setDocumentName] = useState<string>('')
	const [deadline, setDeadline] = useState<string>('')
	const documentNameRef = useRef<HTMLInputElement>(null)
	const { isOpen, onOpen, onClose } = useDisclosure()

	const handleAddDocument = async () => {
		await onAddDocument(documentName, deadline)
		onCloseModal()
	}

	const onCloseModal = () => {
		onClose()

		setDocumentName('')
		setDeadline('')
	}

	return (
		<Box>
			<Button
				sx={{
					...styles.requiredDocumentButton,
					...requiredDocumentButtonStyles,
				}}
				leftIcon={
					<Icon
						as={AsAddSquareIcon}
						sx={{
							...styles.requiredDocumentIcon,
							...requiredDocumentIconStyles,
						}}
					/>
				}
				onClick={onOpen}
				isDisabled={isDisabled}
			>
				{t('common.buttonText')}
			</Button>
			<Modal
				isOpen={isOpen}
				onClose={onCloseModal}
				size={'lg'}
				// initialFocusRef={documentNameRef}
				isCentered
			>
				<ModalOverlay />
				<ModalContent>
					<ModalCloseButton size={'lg'} />
					<ModalHeader sx={{ paddingX: '1.25rem' }}>
						{t('common.buttonText')}
					</ModalHeader>
					<ModalBody sx={styles.modalBody}>
						<HStack sx={{ gap: '1.25rem' }}>
							<VStack>
								<InputLabel
									// inputRef={documentNameRef}
									label={t('common.name')}
									inputPlaceholder={t('common.namePlaceholder')}
									inputType={'text'}
									styles={documentNameStyles}
									value={documentName}
									onChange={setDocumentName}
								/>
							</VStack>
							<VStack>
								<DatePickerLabel
									label={t('common.deadline')}
									onChange={(date: Date | undefined) =>
										date && setDeadline(format(date, 'yyyy-MM-dd'))
									}
									styles={datePickerStyles}
								/>
							</VStack>
						</HStack>
					</ModalBody>
					<ModalFooter sx={{ padding: '1.25rem' }}>
						<HStack>
							<Button
								sx={styles.cancelButton}
								isDisabled={isLoading}
								onClick={onCloseModal}
							>
								{t('common.cancel')}
							</Button>
							<Button
								sx={styles.saveButton}
								leftIcon={<Icon as={AsSaveIcon} sx={styles.addDocumentIcon} />}
								isDisabled={!documentName.trim() || !deadline.trim()}
								onClick={handleAddDocument}
								isLoading={isLoading}
							>
								{t('common.save')}
							</Button>
						</HStack>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Box>
	)
}

export default AddRequiredDocumentButton
