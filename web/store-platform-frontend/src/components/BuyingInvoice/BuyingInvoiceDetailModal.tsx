import {
	Flex,
	Modal,
	ModalBody,
	ModalContent,
	ModalOverlay,
	Spinner,
} from '@chakra-ui/react'

import NewBuyingInvoicePanel, {
	type BuyingInvoicePanelMode,
} from './NewBuyingInvoicePanel'
import type { ApiBuyingInvoice } from './buyingInvoiceApiMappers'

interface BuyingInvoiceDetailModalProps {
	isOpen: boolean
	buyingInvoiceId?: string | null
	invoice?: ApiBuyingInvoice
	mode: BuyingInvoicePanelMode
	suppliers?: Supplier[]
	onClose: () => void
	onSaved?: () => void
	onRequestEdit?: () => void
	initialSupplierId?: string
	initialSupplierName?: string
	nextInvoiceNumber?: number
}

const BuyingInvoiceDetailModal = ({
	isOpen,
	buyingInvoiceId,
	invoice,
	mode,
	suppliers,
	onClose,
	onSaved,
	onRequestEdit,
	initialSupplierId,
	initialSupplierName,
	nextInvoiceNumber,
}: BuyingInvoiceDetailModalProps) => {
	if (mode !== 'create' && !buyingInvoiceId) return null

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
					{mode === 'create' && nextInvoiceNumber == null ? (
						<Flex justify="center" py={16} bg="white" borderRadius="xl">
							<Spinner />
						</Flex>
					) : (
						<NewBuyingInvoicePanel
							isActive={isOpen}
							mode={mode}
							buyingInvoiceId={buyingInvoiceId ?? undefined}
							invoice={invoice}
							suppliers={suppliers}
							onClose={onClose}
							onSaved={onSaved}
							onRequestEdit={onRequestEdit}
							initialSupplierId={initialSupplierId}
							initialSupplierName={initialSupplierName}
							nextInvoiceNumber={nextInvoiceNumber}
						/>
					)}
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default BuyingInvoiceDetailModal
