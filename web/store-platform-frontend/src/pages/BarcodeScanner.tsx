import {
	Input,
	Spinner,
	Box,
	Text,
	useDisclosure,
	VStack,
	Alert,
	AlertIcon,
	AlertTitle,
	AlertDescription,
} from '@chakra-ui/react'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useGetSingleProductQuery } from '../api/apiStore'
import ProductModal from './ProductModal'
import AddProductModal from './AddProductModal'

interface BarcodeScannerProps {
	addToCart: (product: ProductApi) => void
}

const BarcodeScanner = ({ addToCart }: BarcodeScannerProps) => {
	const [barcodeInput, setBarcodeInput] = useState('')
	const [searchBarcode, setSearchBarcode] = useState('')
	const [error, setError] = useState<string | null>(null)

	const inputRef = useRef<HTMLInputElement>(null)

	const {
		isOpen: isProductModalPreviewOpen,
		onOpen: onProductModalPreviewOpen,
		onClose: onProductModalPreviewClose,
	} = useDisclosure()
	const {
		isOpen: isAddProductModalOpen,
		onOpen: onAddProductModalOpen,
		onClose: onAddProductModalClose,
	} = useDisclosure()

	const {
		data: product,
		isFetching,
		isSuccess,
		isError: isQueryError,
		error: queryError,
	} = useGetSingleProductQuery(searchBarcode, {
		skip: !searchBarcode,
		refetchOnMountOrArgChange: false,
	})

	// Auto-focus on mount
	useEffect(() => {
		const timer = setTimeout(() => {
			inputRef.current?.focus()
		}, 100)
		return () => clearTimeout(timer)
	}, [])

	// Handle successful API response
	useEffect(() => {
		if (!searchBarcode) return

		if (isSuccess) {
			setError(null)
			if (product && product._id) {
				// Product exists - show product modal
				onProductModalPreviewOpen()
			}
		}
	}, [isSuccess, product, searchBarcode, onProductModalPreviewOpen])

	// Handle API errors
	useEffect(() => {
		if (isQueryError && searchBarcode) {
			const errorMessage =
				(queryError as any)?.data?.message || 'Product not found'
			setError(errorMessage)

			// Clear search barcode and error after delay
			const timer = setTimeout(() => {
				setSearchBarcode('')
				setError(null)
			}, 3000)
			return () => clearTimeout(timer)
		}
	}, [isQueryError, searchBarcode, queryError])

	const handleScan = useCallback(() => {
		const code = barcodeInput.trim()

		// Validate input
		if (!code) {
			setError('Please enter or scan a barcode')
			return
		}

		if (isFetching) {
			setError('Please wait, previous request is still processing')
			return
		}

		// Reset states before new search
		setError(null)
		setSearchBarcode(code)
		setBarcodeInput('')
	}, [barcodeInput, isFetching])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') {
				e.preventDefault()
				handleScan()
			}
		},
		[handleScan],
	)

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setBarcodeInput(e.target.value)
			// Clear error when user starts typing
			if (error) setError(null)
		},
		[error],
	)

	const handleModalClose = useCallback(() => {
		onProductModalPreviewClose()
		setSearchBarcode('')
		setError(null)
		// Refocus input after modal closes
		setTimeout(() => inputRef.current?.focus(), 100)
	}, [onProductModalPreviewClose])

	const handleCreateModalClose = useCallback(() => {
		onAddProductModalClose()
		setSearchBarcode('')
		setError(null)
		// Refocus input after modal closes
		setTimeout(() => inputRef.current?.focus(), 100)
	}, [onAddProductModalClose])

	const handleProductAddToCart = useCallback(
		(productToAdd: ProductApi) => {
			addToCart(productToAdd)
			handleModalClose()
		},
		[addToCart, handleModalClose],
	)

	const handleAddProductSuccess = useCallback(() => {
		handleCreateModalClose()
	}, [handleCreateModalClose])

	// Show add product modal when product doesn't exist after search completes
	useEffect(() => {
		if (!searchBarcode) return

		// If API call completed successfully but no product found
		if (!isFetching && isSuccess && !product) {
			onAddProductModalOpen()
			setSearchBarcode('') // Reset search barcode to prevent multiple triggers
		}
	}, [isFetching, isSuccess, product, searchBarcode, onAddProductModalOpen])

	return (
		<VStack spacing={4} align="stretch" width="100%">
			<Input
				ref={inputRef}
				value={barcodeInput}
				onChange={handleInputChange}
				onKeyDown={handleKeyDown}
				placeholder="Scan barcode or type manually..."
				size="lg"
				autoComplete="off"
				autoCorrect="off"
				spellCheck={false}
				isDisabled={isFetching}
			/>

			{isFetching && (
				<Box display="flex" justifyContent="center" py={2}>
					<Spinner size="md" />
					<Text ml={3}>Searching for product...</Text>
				</Box>
			)}

			{error && !isFetching && (
				<Alert status="error" variant="solid" borderRadius="md">
					<AlertIcon />
					<AlertTitle mr={2}>Error!</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{product && (
				<ProductModal
					isOpen={isProductModalPreviewOpen}
					onClose={handleModalClose}
					product={product}
					isLoading={isFetching}
					onAdd={handleProductAddToCart}
				/>
			)}

			<AddProductModal
				isOpen={isAddProductModalOpen}
				onClose={handleCreateModalClose}
				barcode={searchBarcode || barcodeInput}
				onSuccess={handleAddProductSuccess}
			/>
		</VStack>
	)
}

export default BarcodeScanner
