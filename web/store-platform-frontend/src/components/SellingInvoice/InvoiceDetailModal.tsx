import {
	Flex,
	Modal,
	ModalBody,
	ModalContent,
	ModalOverlay,
	Spinner,
} from '@chakra-ui/react'

import NewSellingInvoicePanel, {
	type InvoicePanelMode,
} from './NewSellingInvoicePanel'
import type { ApiSellingInvoice } from './invoiceApiMappers'
import { PricingLabelsType } from '../../shared/globalEnums'

interface InvoiceDetailModalProps {
	isOpen: boolean
	invoiceId?: string | null
	invoice?: ApiSellingInvoice
	mode: InvoicePanelMode
	customers?: Customer[]
	onClose: () => void
	onSaved?: () => void
	onRequestEdit?: () => void
	initialCustomerId?: string
	initialCustomerName?: string
	initialProjectId?: string
	initialPricingLabels?: PricingLabelsType
	nextInvoiceNumber?: number
}

const InvoiceDetailModal = ({
	isOpen,
	invoiceId,
	invoice,
	mode,
	customers,
	onClose,
	onSaved,
	onRequestEdit,
	initialCustomerId,
	initialCustomerName,
	initialProjectId,
	initialPricingLabels,
	nextInvoiceNumber,
}: InvoiceDetailModalProps) => {
	if (mode !== 'create' && !invoiceId) return null

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
						<NewSellingInvoicePanel
							isActive={isOpen}
							mode={mode}
							invoiceId={invoiceId ?? undefined}
							invoice={invoice}
							customers={customers}
							onClose={onClose}
							onSaved={onSaved}
							onRequestEdit={onRequestEdit}
							initialCustomerId={initialCustomerId}
							initialCustomerName={initialCustomerName}
							initialProjectId={initialProjectId}
							initialPricingLabels={initialPricingLabels}
							nextInvoiceNumber={nextInvoiceNumber}
						/>
					)}
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default InvoiceDetailModal
