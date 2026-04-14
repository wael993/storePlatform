import {
	Modal,
	ModalOverlay,
	ModalContent,
	ModalHeader,
	ModalBody,
	VStack,
	Input,
	Button,
	Spinner,
	CloseButton,
} from '@chakra-ui/react'

const ProductModal = ({ isOpen, onClose, product, isLoading, onAdd }: any) => {
	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalOverlay />
			<ModalContent>
				<CloseButton onClick={onClose} />
				<ModalHeader>Product</ModalHeader>

				<ModalBody>
					{isLoading ? (
						<Spinner />
					) : (
						<VStack>
							<Input value={product?.name || ''} isReadOnly />
							<Input value={product?.price || ''} isReadOnly />
							<Input value={product?.barcode || ''} isReadOnly />
							<Input value={product?.description || ''} isReadOnly />
							<Input value={product?.count || ''} isReadOnly />

							<Button
								colorScheme="green"
								onClick={() => {
									onAdd(product)
									onClose()
								}}
							>
								Add to Cart
							</Button>
						</VStack>
					)}
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default ProductModal
