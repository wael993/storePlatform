import { Modal, ModalBody, ModalContent, ModalOverlay } from '@chakra-ui/react'

import NewBuyingInvoicePanel, {
	type BuyingInvoicePanelMode,
} from './NewBuyingInvoicePanel'

interface BuyingInvoiceDetailModalProps {
	isOpen: boolean
	buyingInvoiceId: string | null
	mode: Extract<BuyingInvoicePanelMode, 'view' | 'edit'>
	suppliers?: Supplier[]
	onClose: () => void
	onSaved?: () => void
	onRequestEdit?: () => void
}

const BuyingInvoiceDetailModal = ({
	isOpen,
	buyingInvoiceId,
	mode,
	suppliers,
	onClose,
	onSaved,
	onRequestEdit,
}: BuyingInvoiceDetailModalProps) => {
	if (!buyingInvoiceId) return null

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			size="6xl"
			scrollBehavior="inside"
			isCentered
		>
			<ModalOverlay />
			<ModalContent
				maxH="90vh"
				borderRadius="xl"
				overflow="hidden"
				bg="transparent"
				boxShadow="none"
			>
				<ModalBody p={0} display="flex" flexDirection="column" maxH="90vh">
					<NewBuyingInvoicePanel
						isActive={isOpen}
						mode={mode}
						buyingInvoiceId={buyingInvoiceId}
						suppliers={suppliers}
						onClose={onClose}
						onSaved={onSaved}
						onRequestEdit={onRequestEdit}
					/>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default BuyingInvoiceDetailModal
