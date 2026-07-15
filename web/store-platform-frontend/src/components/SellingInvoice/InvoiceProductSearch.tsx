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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AddProductModal from '../../pages/AddProductModal'
import { PAGE_COLORS } from './constants'
import {
	hasShortNameTokens,
	normalizeSearchQuery,
	productMatchesCode,
	searchProducts,
	SEARCH_RESULTS_LIMIT,
} from './productSearch'
import { useProductCatalog } from './useProductCatalog'
import { AsSearchIcon } from '../../icons/Search'
import { AsCirclePlusIcon } from '../../shared/icons/CirclePlus'
import { AsQrCodeIcon } from '../../icons/QrCode'

interface InvoiceProductSearchProps {
	onAddProduct: (product: Product) => void
	initialSearch?: string
	autoFocus?: boolean
}

const InvoiceProductSearch = ({
	onAddProduct,
	initialSearch = '',
	autoFocus = true,
}: InvoiceProductSearchProps) => {
	const { t } = useTranslation()
	const inputRef = useRef<HTMLInputElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const lastInitialSearchRef = useRef('')
	const pendingSearchRef = useRef<string | null>(null)

	const [searchText, setSearchText] = useState('')
	const [suggestions, setSuggestions] = useState<Product[]>([])
	const [showSuggestions, setShowSuggestions] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isAddProductOpen, setIsAddProductOpen] = useState(false)
	const [pendingBarcode, setPendingBarcode] = useState('')

	const { products, indexes, isReady, isSyncing, refetch } = useProductCatalog()

	const clearInput = useCallback(() => {
		setSearchText('')
		if (inputRef.current) {
			inputRef.current.value = ''
		}
	}, [])

	const handleAddProduct = useCallback(
		(product: Product) => {
			onAddProduct(product)
			clearInput()
			setSuggestions([])
			setError(null)
			setShowSuggestions(false)
			setTimeout(() => inputRef.current?.focus(), 100)
		},
		[clearInput, onAddProduct],
	)

	const processSearchResults = useCallback(
		(results: Product[], trimmed: string) => {
			if (results.length === 0) {
				setSuggestions([])
				setShowSuggestions(false)
				setError(null)
				setPendingBarcode(trimmed)
				setIsAddProductOpen(true)
				return
			}

			const exactCodeMatches = results.filter(product =>
				productMatchesCode(product, trimmed),
			)
			if (exactCodeMatches.length === 1) {
				handleAddProduct(exactCodeMatches[0])
				return
			}

			if (results.length === 1) {
				handleAddProduct(results[0])
				return
			}

			setSuggestions(results)
			setShowSuggestions(true)
			setError(null)
		},
		[handleAddProduct],
	)

	const submitSearch = useCallback(
		(rawQuery: string) => {
			const trimmed = normalizeSearchQuery(rawQuery)

			if (!trimmed) {
				setError(t('components.sellingInvoices.drawer.enterBarcodeOrName'))
				setShowSuggestions(false)
				return
			}

			if (hasShortNameTokens(trimmed)) {
				setError(t('components.sellingInvoices.drawer.searchMinTokenLength'))
				setShowSuggestions(false)
				return
			}

			if (!isReady) {
				pendingSearchRef.current = trimmed
				setSearchText(trimmed)
				if (inputRef.current) {
					inputRef.current.value = trimmed
				}
				setError(null)
				setShowSuggestions(false)
				return
			}

			setSearchText(trimmed)
			if (inputRef.current) {
				inputRef.current.value = trimmed
			}
			setError(null)
			setShowSuggestions(false)

			const results = searchProducts(
				products,
				trimmed,
				SEARCH_RESULTS_LIMIT,
				indexes,
			)
			processSearchResults(results, trimmed)
		},
		[indexes, isReady, processSearchResults, products, t],
	)

	useEffect(() => {
		if (!isReady || !pendingSearchRef.current) return

		const query = pendingSearchRef.current
		pendingSearchRef.current = null
		submitSearch(query)
	}, [isReady, products, submitSearch])

	useEffect(() => {
		const normalized = normalizeSearchQuery(initialSearch)
		if (!normalized || lastInitialSearchRef.current === normalized) return

		lastInitialSearchRef.current = normalized
		if (inputRef.current) {
			inputRef.current.value = normalized
		}
		submitSearch(normalized)
	}, [initialSearch, submitSearch])

	useEffect(() => {
		if (!autoFocus) return

		const timer = setTimeout(() => {
			inputRef.current?.focus()
		}, 150)

		return () => clearTimeout(timer)
	}, [autoFocus])

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault()
			submitSearch(inputRef.current?.value ?? '')
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

	const showPreparingCatalog = !isReady && (isSyncing || products.length === 0)

	return (
		<Box ref={containerRef} position="relative">
			<Flex gap={2} direction={{ base: 'column', md: 'row' }}>
				<InputGroup flex="1" size="md">
					<InputLeftElement pointerEvents="none" h="full">
						<Icon as={AsSearchIcon} color={PAGE_COLORS.primary} boxSize={5} />
					</InputLeftElement>
					<Input
						ref={inputRef}
						defaultValue={normalizeSearchQuery(initialSearch)}
						onInput={event => {
							setSearchText(event.currentTarget.value)
							setShowSuggestions(false)
							if (error) setError(null)
						}}
						onFocus={() => {
							if (suggestions.length > 0) setShowSuggestions(true)
						}}
						onKeyDown={handleKeyDown}
						placeholder={t(
							'components.sellingInvoices.drawer.searchPlaceholder',
						)}
						borderRadius="lg"
						borderColor={PAGE_COLORS.border}
						bg="white"
						pl={10}
						autoComplete="off"
						spellCheck={false}
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

			{showPreparingCatalog && (
				<Flex align="center" gap={2} mt={2}>
					<Spinner size="sm" color={PAGE_COLORS.primary} />
					<Text fontSize="sm" color={PAGE_COLORS.muted}>
						{t('components.sellingInvoices.drawer.preparingCatalog')}
					</Text>
				</Flex>
			)}

			{isReady && !error && !showSuggestions && (
				<Text fontSize="xs" color={PAGE_COLORS.muted} mt={2}>
					{t('components.sellingInvoices.drawer.searchHint')}
				</Text>
			)}

			{error && (
				<Text fontSize="sm" color={PAGE_COLORS.danger} mt={2}>
					{error}
				</Text>
			)}

			{showSuggestions && suggestions.length > 0 && (
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
							<Flex gap={3} mt={0.5} flexWrap="wrap">
								{product.barcode && (
									<Text fontSize="xs" color={PAGE_COLORS.muted}>
										{product.barcode}
									</Text>
								)}
								{product.internalCode && (
									<Text fontSize="xs" color={PAGE_COLORS.muted}>
										{product.internalCode}
									</Text>
								)}
								{product.productFactoryCode && (
									<Text fontSize="xs" color={PAGE_COLORS.muted}>
										{product.productFactoryCode}
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
				onSuccess={async () => {
					setIsAddProductOpen(false)
					setPendingBarcode('')
					await refetch()
					if (searchText.trim()) {
						submitSearch(searchText)
					}
				}}
			/>
		</Box>
	)
}

export default InvoiceProductSearch
