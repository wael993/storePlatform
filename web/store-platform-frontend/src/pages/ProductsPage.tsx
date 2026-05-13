import { useState } from 'react'
import {
	Box,
	Button,
	Heading,
	IconButton,
	Input,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Spinner,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	useDisclosure,
	VStack,
	HStack,
	FormControl,
	FormLabel,
	NumberInput,
	NumberInputField,
	Select,
	Badge,
} from '@chakra-ui/react'
import { DeleteIcon, EditIcon } from '@chakra-ui/icons'
import {
	useGetProductsQuery,
	useDeleteProductMutation,
	usePostProductMutation,
	useEditProductMutation,
} from '../api/apiStore'
import { AllowedActions } from '../shared/globalEnums'
import { useResources } from '../shared/hooks/useResources'
import { useUser } from '../shared/hooks/useUser'
import { useBreakpoints } from '../shared/hooks/useBreakpoints'
import { compareBreakpoint } from '../shared/utils'

const EMPTY_FORM = {
	name: '',
	barcode: '',
	brand: '',
	categoryId: '',
	categoryName: '',
	priceBuy: 0,
	priceSell: 0,
	priceDiscount: 0,
	currency: 'EUR',
	stockQuantity: 0,
	stockMinQuantity: 0,
	stockUnit: 'piece',
	taxType: 'VAT',
	taxValue: 19,
	supplierName: '',
	warehouse: '',
	shelf: '',
	status: 'active' as 'active' | 'inactive' | 'discontinued',
	description: '',
}

const ProductsPage = () => {
	const { isOwnerOrAdmin } = useUser()
	const { isActionAllowed } = useResources()
	const breakpoint = useBreakpoints()

	const { isMobile, isTablet, isDesktop, isLargeDesktop } =
		compareBreakpoint(breakpoint)

	const { data: products = [], isLoading, isFetching } = useGetProductsQuery({})
	const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation()
	const [postProduct, { isLoading: isPosting }] = usePostProductMutation()
	const [editProduct] = useEditProductMutation()

	const { isOpen, onOpen, onClose } = useDisclosure()
	const [form, setForm] = useState(EMPTY_FORM)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [feedback, setFeedback] = useState('')
	const isGetProductsInProgress = isLoading || isFetching

	const openAdd = () => {
		setForm(EMPTY_FORM)
		setEditingId(null)
		setFeedback('')
		onOpen()
	}

	const openEdit = (p: ProductApi) => {
		setForm({
			name: p.name,
			barcode: p.barcode,
			brand: p.brand ?? '',
			categoryId: p.category?.id ?? '',
			categoryName: p.category?.name ?? '',
			priceBuy: p.price?.buy ?? 0,
			priceSell: p.price?.sell ?? 0,
			priceDiscount: p.price?.discount ?? 0,
			currency: p.price?.currency ?? 'EUR',
			stockQuantity: p.stock?.quantity ?? 0,
			stockMinQuantity: p.stock?.minQuantity ?? 0,
			stockUnit: p.stock?.unit ?? 'piece',
			taxType: p.tax?.type ?? 'VAT',
			taxValue: p.tax?.value ?? 19,
			supplierName: p.supplier?.name ?? '',
			warehouse: p.location?.warehouse ?? '',
			shelf: p.location?.shelf ?? '',
			status: p.status ?? 'active',
			description: p.description ?? '',
		})
		setEditingId(p._id)
		setFeedback('')
		onOpen()
	}

	const handleClose = () => {
		setForm(EMPTY_FORM)
		setEditingId(null)
		setFeedback('')
		onClose()
	}

	const handleSubmit = async () => {
		setFeedback('')
		try {
			if (editingId) {
				await editProduct(editingId).unwrap()
			} else {
				await postProduct({
					name: form.name,
					barcode: form.barcode,
					brand: form.brand || undefined,
					images: [],
					category: form.categoryId
						? { id: form.categoryId, name: form.categoryName }
						: undefined,
					price: {
						buy: Number(form.priceBuy),
						sell: Number(form.priceSell),
						discount: Number(form.priceDiscount) || undefined,
						currency: form.currency,
					},
					stock: {
						quantity: Number(form.stockQuantity),
						minQuantity: Number(form.stockMinQuantity) || undefined,
						unit: form.stockUnit || 'piece',
					},
					tax: form.taxType
						? { type: form.taxType, value: Number(form.taxValue) }
						: undefined,
					supplier: form.supplierName ? { name: form.supplierName } : undefined,
					location:
						form.warehouse || form.shelf
							? {
									warehouse: form.warehouse || undefined,
									shelf: form.shelf || undefined,
								}
							: undefined,
					status: form.status,
					description: form.description || undefined,
				}).unwrap()
			}
			handleClose()
		} catch (err: any) {
			setFeedback(err?.data?.message || 'Operation failed.')
		}
	}

	const handleDelete = async (id: string) => {
		try {
			await deleteProduct(id).unwrap()
		} catch {
			// silently ignore
		}
	}

	return (
		<Box>
			<HStack justify="space-between" mb={6}>
				<Heading size="lg">Products</Heading>
				{isActionAllowed(AllowedActions.ADD_PRODUCT) && isOwnerOrAdmin && (
					<Button colorScheme="blue" onClick={openAdd}>
						Add Product
					</Button>
				)}
			</HStack>

			{isGetProductsInProgress && <Spinner />}

			{!isGetProductsInProgress && products.length === 0 && (
				<Text color="gray.500">No products found.</Text>
			)}

			{!isGetProductsInProgress && products.length > 0 && (
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
									<Td>{p.brand ?? '—'}</Td>
									<Td>{p.category?.name ?? '—'}</Td>
									<Td isNumeric>
										{p.price?.sell?.toFixed(2)} {p.price?.currency}
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
			)}

			<Modal isOpen={isOpen} onClose={handleClose} isCentered size="lg">
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
								<FormLabel>Brand</FormLabel>
								<Input
									value={form.brand}
									onChange={e =>
										setForm(f => ({ ...f, brand: e.target.value }))
									}
								/>
							</FormControl>
							<HStack w="100%">
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
									<FormLabel>Category Name</FormLabel>
									<Input
										value={form.categoryName}
										onChange={e =>
											setForm(f => ({ ...f, categoryName: e.target.value }))
										}
									/>
								</FormControl>
							</HStack>
							<HStack w="100%">
								<FormControl isRequired>
									<FormLabel>Buy Price</FormLabel>
									<NumberInput
										value={form.priceBuy}
										min={0}
										onChange={val =>
											setForm(f => ({ ...f, priceBuy: Number(val) }))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
								<FormControl isRequired>
									<FormLabel>Sell Price</FormLabel>
									<NumberInput
										value={form.priceSell}
										min={0}
										onChange={val =>
											setForm(f => ({ ...f, priceSell: Number(val) }))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
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
							</HStack>
							<FormControl>
								<FormLabel>Currency</FormLabel>
								<Input
									value={form.currency}
									onChange={e =>
										setForm(f => ({ ...f, currency: e.target.value }))
									}
								/>
							</FormControl>
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
								<FormControl>
									<FormLabel>Unit</FormLabel>
									<Input
										value={form.stockUnit}
										onChange={e =>
											setForm(f => ({ ...f, stockUnit: e.target.value }))
										}
									/>
								</FormControl>
							</HStack>
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
								<FormLabel>Supplier Name</FormLabel>
								<Input
									value={form.supplierName}
									onChange={e =>
										setForm(f => ({ ...f, supplierName: e.target.value }))
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
							isLoading={isPosting}
						>
							{editingId ? 'Save' : 'Add'}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Box>
	)
}

export default ProductsPage
