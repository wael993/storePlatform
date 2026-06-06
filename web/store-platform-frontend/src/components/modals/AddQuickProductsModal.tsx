import {
	Modal,
	ModalOverlay,
	ModalContent,
	ModalHeader,
	Heading,
	ModalCloseButton,
	ModalBody,
	HStack,
	FormControl,
	FormLabel,
	Input,
	ButtonGroup,
	Button,
} from '@chakra-ui/react'
import { t } from 'i18next'
import React from 'react'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { AsCheckmarkCircleIcon } from '../../icons/CheckmarkCircle'

interface AddQuickProductsModalProps {
	isOpen: boolean
	onClose: () => void
	onAddQuickProduct: (productName: string) => void
	userHasAdminRole: boolean
	setProductName: React.Dispatch<React.SetStateAction<string>>
	productName: string
	isLoading?: boolean
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
		justifyContent: 'flex-end',
		gap: '0.5rem',
	},
	button: {
		margin: { base: '0 0 1rem 2rem', md: '1rem 1rem 1rem 0rem' },
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

const AddQuickProductsModal = ({
	isOpen,
	onClose,
	onAddQuickProduct,
	userHasAdminRole,
	setProductName,
	productName,
	isLoading,
}: AddQuickProductsModalProps) => {
	const onCloseModal = () => {
		setProductName('')
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
						{t('components.daily.addQuickProduct')}
					</Heading>
				</ModalHeader>
				<ModalCloseButton />
				<ModalBody>
					<HStack sx={styles.verticalContainer}>
						<FormControl>
							<FormLabel sx={styles.label}>
								{t('components.daily.productName')}
							</FormLabel>
							<Input
								size="sm"
								isRequired
								sx={styles.input}
								type="text"
								variant="filled"
								value={productName}
								onChange={event => setProductName(event.target.value)}
							/>
						</FormControl>
					</HStack>
					<ButtonGroup size="sm" sx={styles.buttonRow}>
						<Button
							rightIcon={
								<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />
							}
							size={'sm'}
							variant={'primary'}
							isDisabled={!productName || !userHasAdminRole || isLoading}
							onClick={() => onAddQuickProduct(productName)}
							sx={{
								...styles.button,
								backgroundColor: '#376288',
								color: '#FFFFFF',
							}}
						>
							{t('common.addProduct')}
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

export default AddQuickProductsModal
