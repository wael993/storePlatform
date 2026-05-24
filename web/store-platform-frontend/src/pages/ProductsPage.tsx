import { useMemo, useState } from 'react'
import {
	Box,
	Button,
	Heading,
	Spinner,
	Text,
	HStack,
	Flex,
} from '@chakra-ui/react'
import { useGetProductsQuery } from '../api/apiStore'
import { useSettings } from '../shared/context/SettingsContext'
import { AllowedActions, BreadCrumbItem } from '../shared/globalEnums'
import { useResources } from '../shared/hooks/useResources'
import { useUser } from '../shared/hooks/useUser'
import ListWithActionBar from '../components/list/ListWithActionBar'
import { hoverFocusActiveButtonStyles } from '../theme/styles'
import { useTranslation } from 'react-i18next'
import { AddSquareIcon } from '../icons/AddSquare'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { generateBreadcrumbs } from '../shared/routes'
import Filters from '../components/filters/Filters'
import {
	FilterSelectOption,
	ProductFilterValues,
} from '../components/filters/FilterModal'
import { PRODUCT_STATE_CONFIG } from '../components/list/shared/constants'

const EMPTY_PRODUCT_FILTERS: ProductFilterValues = {
	searchText: '',
	supplier: [],
	brand: [],
	state: [],
	category: [],
}

const getUniqueFilterOptions = (
	products: Product[],
	getValue: (product: Product) => string | undefined,
	getLabel?: (product: Product) => string | undefined,
): FilterSelectOption[] => {
	const optionsMap = new Map<string, string>()

	products.forEach(product => {
		const value = getValue(product)
		if (!value) return

		const trimmedValue = value.trim()
		if (!trimmedValue) return

		const label = getLabel?.(product)?.trim() || trimmedValue
		optionsMap.set(trimmedValue, label)
	})

	return Array.from(optionsMap.entries())
		.map(([value, label]) => ({ value, label }))
		.sort((a, b) => a.label.localeCompare(b.label))
}
const fullWidth = '100%'

const styles = {
	wrapper: {
		width: fullWidth,
		flexDir: 'column',
		paddingBottom: '1rem',
	},
	header: {
		flexDir: 'column',
		width: fullWidth,
		paddingX: '1rem',
	},
	title: {
		fontSize: '1.5rem',
		fontWeight: 700,
		marginTop: '0.4rem',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		display: 'block',
		whiteSpace: 'nowrap',
		paddingX: '1rem',
	},
	divider: {
		borderBottom: `1px solid #EAEAEA}`,
		marginTop: '1px',
		marginRight: {
			base: '0',
			md: '0.5rem',
			xl: '0.5rem',
		},
	},
	addProductButton: {
		...hoverFocusActiveButtonStyles,
		gap: '0.25rem',
	},
	addProductButtonText: {
		fontSize: '0.875rem',
		fontWeight: 700,
		color: '#1E1E1E',
	},
} satisfies StylesObject

const ProductsPage = () => {
	const { isOwnerOrAdmin } = useUser()
	const { isActionAllowed } = useResources()
	const { productsPerPage } = useSettings()

	const [productFilters, setProductFilters] = useState<ProductFilterValues>(
		EMPTY_PRODUCT_FILTERS,
	)
	const [currentPage, setCurrentPage] = useState(0)

	const {
		data: response,
		isLoading,
		isFetching,
	} = useGetProductsQuery({
		...productFilters,
		limit: productsPerPage,
		offset: currentPage * productsPerPage,
	})

	const products = response?.products ?? []
	const totalCount = response?.totalCount ?? 0
	const totalPages = Math.ceil(totalCount / productsPerPage)
	const breadCrumbItems = generateBreadcrumbs()

	const handleApplyFilters = (filters: ProductFilterValues) => {
		setProductFilters(filters)
		setCurrentPage(0)
	}

	const handleResetFilters = () => {
		setProductFilters(EMPTY_PRODUCT_FILTERS)
		setCurrentPage(0)
	}

	const isGetProductsInProgress = isLoading || isFetching

	const memoizedProducts = useMemo(
		() => response?.products ?? [],
		[response?.products],
	)

	const supplierOptions = useMemo(
		() =>
			getUniqueFilterOptions(
				memoizedProducts,
				product => product.supplierId || product.supplierName,
				product => product.supplierName || product.supplierId,
			),
		[memoizedProducts],
	)

	const brandOptions = useMemo(
		() =>
			getUniqueFilterOptions(
				memoizedProducts,
				product => product.brandId || product.brandName,
				product => product.brandName || product.brandId,
			),
		[memoizedProducts],
	)

	const categoryOptions = useMemo(
		() =>
			getUniqueFilterOptions(
				memoizedProducts,
				product => product.categoryId || product.categoryName,
				product => product.categoryName || product.categoryId,
			),
		[memoizedProducts],
	)

	const stateOptions = useMemo(() => {
		const baseOptions = getUniqueFilterOptions(
			memoizedProducts,
			product => product.state,
			product => product.state,
		)

		return baseOptions.map(option => {
			const stateConfig =
				PRODUCT_STATE_CONFIG[option.value as keyof typeof PRODUCT_STATE_CONFIG]

			return {
				...option,
				stateColor: stateConfig?.color ?? '#808080',
				stateTitle: stateConfig?.translationKey ?? option.label,
			}
		})
	}, [memoizedProducts])

	const openAdd = () => {}

	const { t } = useTranslation()

	// const handleSubmit = async () => {
	// 	try {
	// 		if (!form.name || !form.barcode) {
	// 			setFeedback('Name and barcode are required')
	// 			return
	// 		}

	// 		const productPayload = {
	// 			name: form.name,
	// 			productFactoryCode: form.productFactoryCode || undefined,
	// 			barcode: form.barcode,
	// 			categoryId: form.categoryId || undefined,
	// 			brandId: form.brandId || undefined,
	// 			images: [],
	// 			price: {
	// 				wholesale: Number(form.priceWholesale),
	// 				retailSale: Number(form.priceRetailSale),
	// 				semiWholesaleSales: Number(form.priceSemiWholesaleSales) || 0,
	// 				buyCost: Number(form.priceBuyCost),
	// 				discount: Number(form.priceDiscount) || undefined,
	// 				currency: form.currency,
	// 			},
	// 			stock: {
	// 				quantity: Number(form.stockQuantity),
	// 				minQuantity: Number(form.stockMinQuantity) || undefined,
	// 			},
	// 			unit: form.unit || 'piece',
	// 			tax: form.taxType
	// 				? { type: form.taxType, value: Number(form.taxValue) }
	// 				: undefined,
	// 			supplierId: form.supplierId || undefined,
	// 			location:
	// 				form.warehouse || form.shelf
	// 					? {
	// 							warehouse: form.warehouse || undefined,
	// 							shelf: form.shelf || undefined,
	// 						}
	// 					: undefined,
	// 			attributes: {
	// 				color: form.color || undefined,
	// 				size: form.size || undefined,
	// 				weight: form.weight || undefined,
	// 				length: form.length || undefined,
	// 				width: form.width || undefined,
	// 				height: form.height || undefined,
	// 			},
	// 			status: form.status,
	// 			description: form.description || undefined,
	// 		}

	// 		if (editingId) {
	// 			await editProduct({
	// 				id: editingId,
	// 				body: productPayload,
	// 			}).unwrap()
	// 		} else {
	// 			await postProduct(productPayload).unwrap()
	// 		}
	// 		handleClose()
	// 	} catch (err: any) {
	// 		setFeedback(err?.data?.message || 'Operation failed.')
	// 	}
	// }

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				{!isGetProductsInProgress && (
					<CustomBreadcrumb
						marginTop="2rem"
						items={breadCrumbItems[BreadCrumbItem.PRODUCTS]}
					/>
				)}
			</Flex>

			<HStack justify="space-between" mb={'4rem'}>
				<Heading sx={styles.title} variant={'h5'}>
					Products
				</Heading>
				{isActionAllowed(AllowedActions.ADD_PRODUCT) && isOwnerOrAdmin && (
					<Button
						leftIcon={<AddSquareIcon />}
						onClick={openAdd}
						sx={styles.addProductButton}
						variant="ghost"
					>
						<Text sx={styles.addProductButtonText}>
							{t('common.addProduct')}
						</Text>
					</Button>
				)}
			</HStack>

			{isGetProductsInProgress && <Spinner />}

			<Box sx={styles.divider} />

			<Filters
				filters={productFilters}
				onApplyFilters={handleApplyFilters}
				onResetFilters={handleResetFilters}
				supplierOptions={supplierOptions}
				brandOptions={brandOptions}
				stateOptions={stateOptions}
				categoryOptions={categoryOptions}
				showSupplierFilter={isOwnerOrAdmin}
			/>

			{!isGetProductsInProgress && products.length === 0 && (
				<Text color="gray.500">{t('components.product.noProducts')}</Text>
			)}

			{/* {!isGetProductsInProgress && products.length > 0 && (
				<Box overflowX="auto">
					<Table variant="simple" size="sm">
						<Thead>
							<Tr>
								<Th>Name</Th>
								<Th>Barcode</Th>
								<Th>Brand</Th>
								<Th>Category</Th>
								<Th isNumeric>Sell Price</Th>
								<Th isNumeric>Stock</Th>
								<Th>Status</Th>
								{isOwnerOrAdmin && <Th>Actions</Th>}
							</Tr>
						</Thead>
						<Tbody>
							{products.map(p => (
								<Tr key={p._id}>
									<Td>{p.name}</Td>
									<Td>{p.barcode}</Td>
								<Td>{p.brand?.name ?? p.brandId ?? '—'}</Td>
								<Td>{p.category?.name ?? p.categoryId ?? '—'}</Td>
									<Td isNumeric>
										{p.price?.retailSale?.toFixed(2)} {p.price?.currency}
									</Td>
									<Td isNumeric>{p.stock?.quantity}</Td>
									<Td>
										<Badge
											colorScheme={
												p.status === 'active'
													? 'green'
													: p.status === 'inactive'
														? 'yellow'
														: 'red'
											}
										>
											{p.status ?? 'active'}
										</Badge>
									</Td>
									{isOwnerOrAdmin && (
										<Td>
											<HStack gap={1}>
												<IconButton
													aria-label="Edit product"
													icon={<EditIcon />}
													size="xs"
													variant="ghost"
													colorScheme="blue"
													onClick={() => openEdit(p)}
												/>
												<IconButton
													aria-label="Delete product"
													icon={<DeleteIcon />}
													size="xs"
													variant="ghost"
													colorScheme="red"
													isLoading={isDeleting}
													onClick={() => handleDelete(p._id)}
												/>
											</HStack>
										</Td>
									)}
								</Tr>
							))}
						</Tbody>
					</Table>
				</Box>
			)} */}
			<ListWithActionBar
				products={products as Product[]}
				isLoading={isLoading || isFetching}
			/>

			{!isGetProductsInProgress && totalPages > 1 && (
				<HStack justify="center" mt="2rem" gap="1rem">
					<Button
						onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
						isDisabled={currentPage === 0}
						size="sm"
					>
						← Previous
					</Button>
					<Text fontSize="sm">
						Page {currentPage + 1} of {totalPages}
					</Text>
					<Button
						onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
						isDisabled={currentPage >= totalPages - 1}
						size="sm"
					>
						Next →
					</Button>
				</HStack>
			)}

			{/* <Modal isOpen={isOpen} onClose={handleClose} isCentered size="lg">
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>
						{editingId ? 'Edit Product' : 'Add Product'}
					</ModalHeader>
					<ModalBody>
						<VStack gap={3}>
							<FormControl isRequired>
								<FormLabel>Name</FormLabel>
								<Input
									value={form.name}
									onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>Product Factory Code</FormLabel>
								<Input
									value={form.productFactoryCode}
									onChange={e =>
										setForm(f => ({ ...f, productFactoryCode: e.target.value }))
									}
								/>
							</FormControl>
							<FormControl isRequired>
								<FormLabel>Barcode</FormLabel>
								<Input
									value={form.barcode}
									onChange={e =>
										setForm(f => ({ ...f, barcode: e.target.value }))
									}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>Category ID</FormLabel>
								<Input
									value={form.categoryId}
									onChange={e =>
										setForm(f => ({ ...f, categoryId: e.target.value }))
									}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>Brand ID</FormLabel>
								<Input
									value={form.brandId}
									onChange={e =>
										setForm(f => ({ ...f, brandId: e.target.value }))
									}
								/>
							</FormControl>
							<HStack w="100%">
								<FormControl isRequired>
									<FormLabel>Wholesale Price</FormLabel>
									<NumberInput
										value={form.priceWholesale}
										min={0}
										onChange={val =>
											setForm(f => ({ ...f, priceWholesale: Number(val) }))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
								<FormControl isRequired>
									<FormLabel>Retail Sale Price</FormLabel>
									<NumberInput
										value={form.priceRetailSale}
										min={0}
										onChange={val =>
											setForm(f => ({ ...f, priceRetailSale: Number(val) }))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
							</HStack>
							<HStack w="100%">
								<FormControl>
									<FormLabel>Semi-Wholesale Sales Price</FormLabel>
									<NumberInput
										value={form.priceSemiWholesaleSales}
										min={0}
										onChange={val =>
											setForm(f => ({
												...f,
												priceSemiWholesaleSales: Number(val),
											}))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
								<FormControl isRequired>
									<FormLabel>Buy Cost</FormLabel>
									<NumberInput
										value={form.priceBuyCost}
										min={0}
										onChange={val =>
											setForm(f => ({ ...f, priceBuyCost: Number(val) }))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
							</HStack>
							<HStack w="100%">
								<FormControl>
									<FormLabel>Discount Price</FormLabel>
									<NumberInput
										value={form.priceDiscount}
										min={0}
										onChange={val =>
											setForm(f => ({ ...f, priceDiscount: Number(val) }))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
								<FormControl>
									<FormLabel>Currency</FormLabel>
									<Input
										value={form.currency}
										onChange={e =>
											setForm(f => ({ ...f, currency: e.target.value }))
										}
									/>
								</FormControl>
							</HStack>
							<HStack w="100%">
								<FormControl isRequired>
									<FormLabel>Stock Quantity</FormLabel>
									<NumberInput
										value={form.stockQuantity}
										min={0}
										onChange={val =>
											setForm(f => ({ ...f, stockQuantity: Number(val) }))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
								<FormControl>
									<FormLabel>Min Quantity</FormLabel>
									<NumberInput
										value={form.stockMinQuantity}
										min={0}
										onChange={val =>
											setForm(f => ({ ...f, stockMinQuantity: Number(val) }))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
							</HStack>
							<FormControl>
								<FormLabel>Unit</FormLabel>
								<Select
									value={form.unit}
									onChange={e =>
										setForm(f => ({
											...f,
											unit: e.target.value as
												| 'piece'
												| 'kg'
												| 'meter'
												| 'set'
												| 'mm',
										}))
									}
								>
									<option value="piece">Piece</option>
									<option value="kg">KG</option>
									<option value="meter">Meter</option>
									<option value="set">Set</option>
									<option value="mm">MM</option>
								</Select>
							</FormControl>
							<HStack w="100%">
								<FormControl>
									<FormLabel>Tax Type</FormLabel>
									<Input
										value={form.taxType}
										onChange={e =>
											setForm(f => ({ ...f, taxType: e.target.value }))
										}
									/>
								</FormControl>
								<FormControl>
									<FormLabel>Tax Value (%)</FormLabel>
									<NumberInput
										value={form.taxValue}
										min={0}
										onChange={val =>
											setForm(f => ({ ...f, taxValue: Number(val) }))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
							</HStack>
							<FormControl>
								<FormLabel>Supplier ID</FormLabel>
								<Input
									value={form.supplierId}
									onChange={e =>
										setForm(f => ({ ...f, supplierId: e.target.value }))
									}
								/>
							</FormControl>
							<HStack w="100%">
								<FormControl>
									<FormLabel>Warehouse</FormLabel>
									<Input
										value={form.warehouse}
										onChange={e =>
											setForm(f => ({ ...f, warehouse: e.target.value }))
										}
									/>
								</FormControl>
								<FormControl>
									<FormLabel>Shelf</FormLabel>
									<Input
										value={form.shelf}
										onChange={e =>
											setForm(f => ({ ...f, shelf: e.target.value }))
										}
									/>
								</FormControl>
							</HStack>
							<HStack w="100%">
								<FormControl>
									<FormLabel>Color</FormLabel>
									<Input
										value={form.color}
										onChange={e =>
											setForm(f => ({ ...f, color: e.target.value }))
										}
									/>
								</FormControl>
								<FormControl>
									<FormLabel>Size</FormLabel>
									<Input
										value={form.size}
										onChange={e =>
											setForm(f => ({ ...f, size: e.target.value }))
										}
									/>
								</FormControl>
							</HStack>
							<HStack w="100%">
								<FormControl>
									<FormLabel>Weight</FormLabel>
									<Input
										value={form.weight}
										onChange={e =>
											setForm(f => ({ ...f, weight: e.target.value }))
										}
									/>
								</FormControl>
								<FormControl>
									<FormLabel>Length</FormLabel>
									<Input
										value={form.length}
										onChange={e =>
											setForm(f => ({ ...f, length: e.target.value }))
										}
									/>
								</FormControl>
							</HStack>
							<HStack w="100%">
								<FormControl>
									<FormLabel>Width</FormLabel>
									<Input
										value={form.width}
										onChange={e =>
											setForm(f => ({ ...f, width: e.target.value }))
										}
									/>
								</FormControl>
								<FormControl>
									<FormLabel>Height</FormLabel>
									<Input
										value={form.height}
										onChange={e =>
											setForm(f => ({ ...f, height: e.target.value }))
										}
									/>
								</FormControl>
							</HStack>
							<FormControl>
								<FormLabel>Status</FormLabel>
								<Select
									value={form.status}
									onChange={e =>
										setForm(f => ({
											...f,
											status: e.target.value as
												| 'active'
												| 'inactive'
												| 'discontinued',
										}))
									}
								>
									<option value="active">Active</option>
									<option value="inactive">Inactive</option>
									<option value="discontinued">Discontinued</option>
								</Select>
							</FormControl>
							<FormControl>
								<FormLabel>Description</FormLabel>
								<Input
									value={form.description}
									onChange={e =>
										setForm(f => ({ ...f, description: e.target.value }))
									}
								/>
							</FormControl>
							{feedback && (
								<Text color="red.500" fontSize="sm">
									{feedback}
								</Text>
							)}
						</VStack>
					</ModalBody>
					<ModalFooter gap={2}>
						<Button variant="ghost" onClick={handleClose}>
							Cancel
						</Button>
						<Button
							colorScheme="blue"
							onClick={handleSubmit}
							isLoading={isPosting || isEditing}
						>
							{editingId ? 'Save' : 'Add'}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal> */}
		</Flex>
	)
}

export default ProductsPage
