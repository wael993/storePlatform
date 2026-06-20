import {
	Modal,
	ModalOverlay,
	ModalContent,
	ModalHeader,
	Heading,
	ModalCloseButton,
	ModalBody,
	ButtonGroup,
	Button,
	VStack,
} from '@chakra-ui/react'
import { t } from 'i18next'
import React from 'react'
import {
	documentNameStyles,
	hoverFocusActiveButtonStyles,
} from '../../theme/styles'
import { AsCheckmarkCircleIcon } from '../../icons/CheckmarkCircle'
import InputLabel from '../common/InputLabel'
import { MODAL_CONFIG } from '../../shared/globalConstant'

interface AddQuickModalProps {
	nextInternalCode?: string
	isOpen: boolean
	onClose: () => void
	handleQuickAdd: (value: { code: string; value: string }) => void
	userHasAdminRole: boolean
	setFormData: React.Dispatch<
		React.SetStateAction<{ code: string; value: string }>
	>
	inputValue: { code: string; value: string }
	isLoading?: boolean
	modalType: AddQuickModalType
	handleInputChange: (field: 'value' | 'code', value: string) => void
}

const styles: StylesObject = {
	modalOverlay: {
		backgroundColor: 'blackAlpha.300',
		backdropFilter: 'blur(2px)',
	},
	modalHeader: {
		marginRight: '3rem',
	},
	headerText: {
		fontWeight: 700,
		fontSize: '1.5rem',
	},
	verticalContainer: {
		alignItems: 'start',
		paddingBottom: '2rem',
		gap: '1.5rem',
		flexDirection: { base: 'column', md: 'row' },
	},
	label: { color: '#747474', fontSize: '0.875rem', fontWeight: 700 },
	input: {
		backgroundColor: '#F8F8F8',
	},
	selectWrapper: {
		paddingRight: 0,
		backgroundColor: '#F8F8F8',
		border: 0,
	},
	buttonRow: {
		width: { base: '50%', md: '35%' },
		gap: '0.5rem',
	},
	button: {
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		color: '#FFFFFF',
		p: { base: '4', md: '1rem 1.5rem 1rem 1.5rem' },
		whiteSpace: 'nowrap',
		borderRadius: '0',
		...hoverFocusActiveButtonStyles,
	},
	cancelButton: {
		width: '-webkit-fill-available',
		backgroundColor: '#EAEAEA',
	},
	secondaryButton: {
		backgroundColor: '#EAEAEA',
		color: '#1E1E1E',
	},
}

const AddQuickModal = ({
	nextInternalCode,
	isOpen,
	onClose,
	handleQuickAdd,
	userHasAdminRole,
	setFormData,
	inputValue,
	isLoading,
	modalType,
	handleInputChange,
}: AddQuickModalProps) => {
	const onCloseModal = () => {
		setFormData({ code: '', value: '' })
		onClose()
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={onCloseModal}
			size="4xl"
			blockScrollOnMount={false}
			scrollBehavior="inside"
			isCentered
		>
			<ModalOverlay sx={styles.modalOverlay} />
			<ModalContent style={{ padding: '1rem' }}>
				<ModalHeader sx={styles.modalHeader}>
					<Heading variant="h5" sx={styles.headerText}>
						{t(MODAL_CONFIG[modalType].title)}
					</Heading>
				</ModalHeader>
				<ModalCloseButton />
				<ModalBody>
					<VStack
						sx={{ gap: '1rem', alignItems: 'left', marginBottom: '1.5rem' }}
					>
						<InputLabel
							withGap={true}
							label={t(MODAL_CONFIG[modalType].label)}
							inputPlaceholder={t(MODAL_CONFIG[modalType].placeholder)}
							inputType={MODAL_CONFIG[modalType].inputType}
							styles={documentNameStyles}
							value={inputValue.value ?? ''}
							isDisabled={false}
							onChange={(value: string) => handleInputChange('value', value)}
						/>
					</VStack>

					<VStack
						sx={{ gap: '1.25rem', alignItems: 'left', marginBottom: '1.5rem' }}
					>
						<InputLabel
							withGap={true}
							label={t(MODAL_CONFIG[modalType].code)}
							inputPlaceholder={
								nextInternalCode
									? nextInternalCode
									: t(MODAL_CONFIG[modalType].code)
							}
							inputType={MODAL_CONFIG[modalType].inputType}
							styles={documentNameStyles}
							value={inputValue.code ?? nextInternalCode}
							onChange={(value: string) => handleInputChange('code', value)}
						/>
					</VStack>

					<ButtonGroup size="sm" sx={styles.buttonRow}>
						<Button
							rightIcon={
								<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />
							}
							size={'sm'}
							variant={'primary'}
							isDisabled={!inputValue.value || !userHasAdminRole || isLoading}
							onClick={() => handleQuickAdd(inputValue)}
							sx={{
								...styles.button,
								backgroundColor: '#376288',
								color: '#FFFFFF',
							}}
						>
							{t(MODAL_CONFIG[modalType].buttonText)}
						</Button>

						<Button
							sx={{ ...styles.button, ...styles.secondaryButton }}
							onClick={onCloseModal}
						>
							{t('common.cancel')}
						</Button>
					</ButtonGroup>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default AddQuickModal
