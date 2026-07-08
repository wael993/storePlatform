import {
	Box,
	Button,
	Flex,
	Icon,
	Input,
	InputGroup,
	InputLeftElement,
	List,
	ListItem,
	Spinner,
	Text,
} from '@chakra-ui/react'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	useGetProductsQuery,
	useGetSingleProductQuery,
} from '../../api/apiStore'
import AddProductModal from '../../pages/AddProductModal'
import { PAGE_COLORS } from './constants'
import { AsSearchIcon } from '../../icons/Search'
import { AsCirclePlusIcon } from '../../shared/icons/CirclePlus'
import { AsQrCodeIcon } from '../../icons/QrCode'

interface InvoiceProductSearchProps {
	onAddProduct: (product: Product) => void
	initialSearch?: string
	autoFocus?: boolean
}

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_RESULTS_LIMIT = 8

const InvoiceProductSearch = ({
	onAddProduct,
	initialSearch = '',
	autoFocus = true,
}: InvoiceProductSearchProps) => {
	const { t } = useTranslation()
	const inputRef = useRef<HTMLInputElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	const [searchText, setSearchText] = useState(initialSearch)
	const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
	const [barcodeLookup, setBarcodeLookup] = useState('')
	const [pendingBarcode, setPendingBarcode] = useState('')
	const [showSuggestions, setShowSuggestions] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isAddProductOpen, setIsAddProductOpen] = useState(false)

	useEffect(() => {
		setSearchText(initialSearch)
		setDebouncedSearch(initialSearch)
	}, [initialSearch])

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchText.trim())
		}, SEARCH_DEBOUNCE_MS)

		return () => clearTimeout(timer)
	}, [searchText])

	useEffect(() => {
		if (!autoFocus) return

		const timer = setTimeout(() => {
			inputRef.current?.focus()
		}, 150)

		return () => clearTimeout(timer)
	}, [autoFocus])

	const { data: searchResponse, isFetching: isSearching } = useGetProductsQuery(
		{ searchText: debouncedSearch, limit: SEARCH_RESULTS_LIMIT, offset: 0 },
		{ skip: debouncedSearch.length < 2 },
	)

	const {
		data: barcodeProduct,
		isFetching: isBarcodeFetching,
		isSuccess: isBarcodeSuccess,
		isError: isBarcodeError,
		error: barcodeError,
	} = useGetSingleProductQuery(barcodeLookup, {
		skip: !barcodeLookup,
	})

	const suggestions = useMemo(
		() => searchResponse?.products ?? [],
		[searchResponse?.products],
	)

	const getQueryErrorMessage = useCallback(
		(apiError: unknown): string => {
			if (!apiError)
				return t('components.sellingInvoices.drawer.productNotFound')

			const errorObj = apiError as FetchBaseQueryError & {
				data?: { message?: string }
				error?: string
			}

			if (typeof errorObj.data === 'object' && errorObj.data?.message) {
				return errorObj.data.message
			}

			if (typeof errorObj.error === 'string' && errorObj.error.trim()) {
				return errorObj.error
			}

			return t('components.sellingInvoices.drawer.productNotFound')
		},
		[t],
	)

	const handleAddProduct = useCallback(
		(product: Product) => {
			onAddProduct(product)
			setSearchText('')
			setDebouncedSearch('')
			setBarcodeLookup('')
			setError(null)
			setShowSuggestions(false)
			setTimeout(() => inputRef.current?.focus(), 100)
		},
		[onAddProduct],
	)

	const lookupProduct = useCallback(
		(value: string) => {
			const trimmed = value.trim()

			if (!trimmed) {
				setError(t('components.sellingInvoices.drawer.enterBarcodeOrName'))
				return
			}

			if (isBarcodeFetching || isSearching) return

			setError(null)
			setPendingBarcode(trimmed)
			setBarcodeLookup(trimmed)
		},
		[isBarcodeFetching, isSearching, t],
	)

	useEffect(() => {
		if (!barcodeLookup) return

		if (isBarcodeSuccess && barcodeProduct) {
			handleAddProduct(barcodeProduct)
			return
		}

		if (!isBarcodeFetching && isBarcodeSuccess && !barcodeProduct) {
			setIsAddProductOpen(true)
			setBarcodeLookup('')
		}
	}, [
		barcodeLookup,
		barcodeProduct,
		handleAddProduct,
		isBarcodeFetching,
		isBarcodeSuccess,
	])

	useEffect(() => {
		if (!isBarcodeError || !barcodeLookup) return

		const message = getQueryErrorMessage(barcodeError)

		if (message.toLowerCase().includes('not found')) {
			setIsAddProductOpen(true)
			setBarcodeLookup('')
			setError(null)
			return
		}

		setError(message)
		setBarcodeLookup('')
	}, [barcodeError, barcodeLookup, getQueryErrorMessage, isBarcodeError])

	const handleSubmit = () => {
		const exactMatch = suggestions.find(
			product =>
				product.barcode === searchText.trim() ||
				product.productId === searchText.trim() ||
				product.name.toLowerCase() === searchText.trim().toLowerCase(),
		)

		if (exactMatch) {
			handleAddProduct(exactMatch)
			return
		}

		if (suggestions.length === 1) {
			handleAddProduct(suggestions[0])
			return
		}

		lookupProduct(searchText)
	}

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault()
			handleSubmit()
		}

		if (event.key === 'Escape') {
			setShowSuggestions(false)
		}
	}

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setShowSuggestions(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const isLoading = isSearching || isBarcodeFetching

	return (
		<Box ref={containerRef} position="relative">
			<Flex gap={2} direction={{ base: 'column', md: 'row' }}>
				<InputGroup flex="1" size="md">
					<InputLeftElement pointerEvents="none" h="full">
						<Icon as={AsSearchIcon} color={PAGE_COLORS.primary} boxSize={5} />
					</InputLeftElement>
					<Input
						ref={inputRef}
						value={searchText}
						onChange={event => {
							setSearchText(event.target.value)
							setShowSuggestions(true)
							if (error) setError(null)
						}}
						onFocus={() => setShowSuggestions(true)}
						onKeyDown={handleKeyDown}
						placeholder={t(
							'components.sellingInvoices.drawer.searchPlaceholder',
						)}
						borderRadius="lg"
						borderColor={PAGE_COLORS.border}
						bg="white"
						pl={10}
						isDisabled={isLoading}
					/>
				</InputGroup>

				<Flex gap={2}>
					<Button
						variant="outline"
						leftIcon={
							<Icon
								as={AsCirclePlusIcon}
								fill="1E1E1E"
								color={PAGE_COLORS.primary}
								boxSize={5}
							/>
						}
						borderRadius="lg"
						borderColor={PAGE_COLORS.border}
						fontWeight={600}
						onClick={() => setIsAddProductOpen(true)}
					>
						{t('components.sellingInvoices.drawer.addProduct')}
					</Button>
					<Button
						variant="outline"
						leftIcon={
							<Icon as={AsQrCodeIcon} color={PAGE_COLORS.primary} boxSize={5} />
						}
						borderRadius="lg"
						borderColor={PAGE_COLORS.border}
						fontWeight={600}
						onClick={() => inputRef.current?.focus()}
					>
						{t('components.sellingInvoices.drawer.scan')}
					</Button>
				</Flex>
			</Flex>

			{isLoading && (
				<Flex align="center" gap={2} mt={2}>
					<Spinner size="sm" color={PAGE_COLORS.primary} />
					<Text fontSize="sm" color={PAGE_COLORS.muted}>
						{t('components.sellingInvoices.drawer.searching')}
					</Text>
				</Flex>
			)}

			{error && !isLoading && (
				<Text fontSize="sm" color={PAGE_COLORS.danger} mt={2}>
					{error}
				</Text>
			)}

			{showSuggestions &&
				debouncedSearch.length >= 2 &&
				suggestions.length > 0 && (
					<List
						position="absolute"
						top="calc(100% + 4px)"
						left={0}
						right={0}
						bg="white"
						border="1px solid"
						borderColor={PAGE_COLORS.border}
						borderRadius="lg"
						boxShadow="md"
						zIndex={10}
						maxH="16rem"
						overflowY="auto"
					>
						{suggestions.map(product => (
							<ListItem
								key={product.productId}
								px={4}
								py={3}
								cursor="pointer"
								_hover={{ bg: 'gray.50' }}
								onClick={() => handleAddProduct(product)}
								borderBottom="1px solid"
								borderColor={PAGE_COLORS.border}
							>
								<Text fontWeight={600} fontSize="sm">
									{product.name}
								</Text>
								<Flex gap={3} mt={0.5}>
									{product.barcode && (
										<Text fontSize="xs" color={PAGE_COLORS.muted}>
											{product.barcode}
										</Text>
									)}
									<Text fontSize="xs" color={PAGE_COLORS.primary}>
										{product.price?.retailPrice?.toFixed(2)}{' '}
										{product.price?.currency}
									</Text>
								</Flex>
							</ListItem>
						))}
					</List>
				)}

			<AddProductModal
				isOpen={isAddProductOpen}
				onClose={() => {
					setIsAddProductOpen(false)
					setPendingBarcode('')
					setTimeout(() => inputRef.current?.focus(), 100)
				}}
				barcode={pendingBarcode || searchText}
				onSuccess={() => {
					setIsAddProductOpen(false)
					setPendingBarcode('')
					if (searchText.trim()) {
						lookupProduct(searchText)
					}
				}}
			/>
		</Box>
	)
}

export default InvoiceProductSearch
