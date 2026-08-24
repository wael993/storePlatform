import { Modal, ModalBody, ModalContent, ModalOverlay } from '@chakra-ui/react'

import NewSellingInvoicePanel, {
	type InvoicePanelMode,
} from './NewSellingInvoicePanel'

interface InvoiceDetailModalProps {
	isOpen: boolean
	invoiceId: string | null
	mode: Extract<InvoicePanelMode, 'view' | 'edit'>
	customers?: Customer[]
	onClose: () => void
	onSaved?: () => void
	onRequestEdit?: () => void
}

const InvoiceDetailModal = ({
	isOpen,
	invoiceId,
	mode,
	customers,
	onClose,
	onSaved,
	onRequestEdit,
}: InvoiceDetailModalProps) => {
	if (!invoiceId) return null

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
					<NewSellingInvoicePanel
						isActive={isOpen}
						mode={mode}
						invoiceId={invoiceId}
						customers={customers}
						onClose={onClose}
						onSaved={onSaved}
						onRequestEdit={onRequestEdit}
					/>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default InvoiceDetailModal
