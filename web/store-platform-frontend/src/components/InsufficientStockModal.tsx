import {
	Button,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

import type { InsufficientStockItem } from '../offline/insufficientStockConfirmation'

interface InsufficientStockModalProps {
	isOpen: boolean
	items: InsufficientStockItem[]
	onClose: () => void
}

const InsufficientStockModal = ({
	isOpen,
	items,
	onClose,
}: InsufficientStockModalProps) => {
	const { t } = useTranslation()

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered>
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>{t('offline.insufficientStockTitle')}</ModalHeader>
				<ModalBody>
					<Text mb={3}>{t('offline.insufficientStockMessage')}</Text>
					<VStack align="stretch" spacing={2}>
						{items.map(item => (
							<Text key={item.productId} fontSize="sm" color="orange.600">
								{t('offline.insufficientStockItem', {
									name: item.name,
									requested: item.requested,
									available: item.available,
								})}
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

export default InsufficientStockModal
