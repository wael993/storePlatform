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

interface ProductModalProps {
	isOpen: boolean
	onClose: () => void
	product: ProductApi | null | undefined
	isLoading: boolean
	onAdd: (product: ProductApi) => void
}

const ProductModal = ({ isOpen, onClose, product, isLoading, onAdd }: ProductModalProps) => {
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
									if (product) {
										onAdd(product)
									}
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
