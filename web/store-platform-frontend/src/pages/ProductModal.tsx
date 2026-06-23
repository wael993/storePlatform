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
import { useTranslation } from 'react-i18next'

interface ProductModalProps {
	isOpen: boolean
	onClose: () => void
	product: Product | null | undefined
	isLoading: boolean
	onAdd: (product: Product) => void
}

const ProductModal = ({
	isOpen,
	onClose,
	product,
	isLoading,
	onAdd,
}: ProductModalProps) => {
	const { t } = useTranslation()
	const handleAdd = () => {
		if (product) {
			onAdd(product)
			onClose()
		}
	}

	const formatPrice = (price?: number, currency = 'EUR') => {
		if (price == null) return '-'
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency,
		}).format(price)
	}

	const stockQuantity = product?.price?.purchasePrice ?? 0

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
			<ModalOverlay />
			<ModalContent borderRadius="xl" overflow="hidden">
				<ModalHeader>{t('productModal.productDetails')}</ModalHeader>
				<CloseButton
					position="absolute"
					top="12px"
					right="12px"
					onClick={onClose}
				/>

				<ModalBody>
					{isLoading ? (
						<Flex justify="center" align="center" minH="150px">
							<Spinner size="lg" />
						</Flex>
					) : !product ? (
						<Text textAlign="center" color="gray.500">
							{t('productModal.notFound')}
						</Text>
					) : (
						<VStack spacing={4} align="stretch">
							<Box>
								<Text fontSize="sm" color="gray.500">
									{t('common.productName')}
								</Text>
								<Text fontWeight="semibold">{product.name}</Text>
							</Box>

							<Box>
								<Text fontSize="sm" color="gray.500">
									{t('common.price')}
								</Text>
								<Text fontWeight="semibold">
									{formatPrice(
										product.price?.retailPrice,
										product.price?.currency,
									)}
								</Text>
							</Box>

							<Divider />

							<HStack justify="space-between">
								<Box>
									<Text fontSize="sm" color="gray.500">
										{t('common.barcode')}
									</Text>
									<Text>{product.barcode || '-'}</Text>
								</Box>

								<Box textAlign="right">
									<Text fontSize="sm" color="gray.500">
										{t('common.stock')}
									</Text>
									<Text>{stockQuantity}</Text>
								</Box>
							</HStack>

							<Box>
								<Text fontSize="sm" color="gray.500">
									{t('productModal.description')}
								</Text>
								<Text whiteSpace="pre-wrap">
									{product.description || t('productModal.noDescription')}
								</Text>
							</Box>
						</VStack>
					)}
				</ModalBody>

				{product && !isLoading && (
					<ModalFooter>
						<HStack w="100%">
							<Button variant="ghost" onClick={onClose} w="full">
								{t('common.cancel')}
							</Button>
							<Button
								colorScheme="green"
								onClick={handleAdd}
								w="full"
								isDisabled={stockQuantity <= 0}
							>
								{t('productModal.addToCart')}
							</Button>
						</HStack>
					</ModalFooter>
				)}
			</ModalContent>
		</Modal>
	)
}

export default ProductModal
