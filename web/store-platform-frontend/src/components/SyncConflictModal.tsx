import {
	Modal,
	ModalOverlay,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
	Button,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

interface SyncConflictModalProps {
	isOpen: boolean
	conflicts: string[]
	onClose: () => void
}

const SyncConflictModal = ({
	isOpen,
	conflicts,
	onClose,
}: SyncConflictModalProps) => {
	const { t } = useTranslation()

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered>
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>{t('offline.conflictTitle')}</ModalHeader>
				<ModalBody>
					<Text mb={3}>{t('offline.conflictMessage')}</Text>
					<VStack align="stretch" spacing={2}>
						{conflicts.map(conflict => (
							<Text key={conflict} fontSize="sm" color="red.600">
								{conflict}
							</Text>
						))}
					</VStack>
				</ModalBody>
				<ModalFooter>
					<Button colorScheme="blue" onClick={onClose}>
						{t('common.ok')}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default SyncConflictModal
