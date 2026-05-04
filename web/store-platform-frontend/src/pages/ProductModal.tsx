import {
	Modal,
	ModalOverlay,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
	VStack,
	HStack,
	Text,
	Button,
	Spinner,
	CloseButton,
	Box,
	Divider,
	Flex,
} from '@chakra-ui/react'

interface ProductModalProps {
	isOpen: boolean
	onClose: () => void
	product: ProductApi | null | undefined
	isLoading: boolean
	onAdd: (product: ProductApi) => void
}

const ProductModal = ({
	isOpen,
	onClose,
	product,
	isLoading,
	onAdd,
}: ProductModalProps) => {
	console.log("🚀 ~ ProductModal ~ product:", product)
	const handleAdd = () => {
		if (product) {
			onAdd(product)
			onClose()
		}
	}

	const formatPrice = (price?: number) => {
		if (price == null) return '-'
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
		}).format(price)
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
			<ModalOverlay />
			<ModalContent borderRadius="xl" overflow="hidden">
				<ModalHeader>Product Details</ModalHeader>
				<CloseButton position="absolute" top="12px" right="12px" />

				<ModalBody>
					{isLoading ? (
						<Flex justify="center" align="center" minH="150px">
							<Spinner size="lg" />
						</Flex>
					) : !product ? (
						<Text textAlign="center" color="gray.500">
							Product not found
						</Text>
					) : (
						<VStack spacing={4} align="stretch">
							<Box>
								<Text fontSize="sm" color="gray.500">
									Name
								</Text>
								<Text fontWeight="semibold">{product.name}</Text>
							</Box>

							<Box>
								<Text fontSize="sm" color="gray.500">
									Price
								</Text>
								<Text fontWeight="semibold">
									{formatPrice(product.price)}
								</Text>
							</Box>

							<Divider />

							<HStack justify="space-between">
								<Box>
									<Text fontSize="sm" color="gray.500">
										Barcode
									</Text>
									<Text>{product.barcode || '-'}</Text>
								</Box>

								<Box textAlign="right">
									<Text fontSize="sm" color="gray.500">
										Stock
									</Text>
									<Text>{product.count ?? 0}</Text>
								</Box>
							</HStack>

							<Box>
								<Text fontSize="sm" color="gray.500">
									Description
								</Text>
								<Text whiteSpace="pre-wrap">
									{product.description || 'No description'}
								</Text>
							</Box>
						</VStack>
					)}
				</ModalBody>

				{product && !isLoading && (
					<ModalFooter>
						<HStack w="100%">
							<Button variant="ghost" onClick={onClose} w="full">
								Cancel
							</Button>
							<Button
								colorScheme="green"
								onClick={handleAdd}
								w="full"
								isDisabled={product.count === 0}
							>
								Add to Cart
							</Button>
						</HStack>
					</ModalFooter>
				)}
			</ModalContent>
		</Modal>
	)
}

export default ProductModal