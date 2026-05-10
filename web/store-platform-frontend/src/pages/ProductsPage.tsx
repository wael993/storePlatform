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
} from '@chakra-ui/react'
import { DeleteIcon, EditIcon } from '@chakra-ui/icons'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import { UserRole } from '../shared/globalEnums'
import {
	useGetProductsQuery,
	useDeleteProductMutation,
	usePostProductMutation,
	useEditProductMutation,
} from '../api/apiStore'

const EMPTY_FORM = {
	id: '',
	name: '',
	barcode: '',
	price: 0,
	count: 0,
	description: '',
}

const ProductsPage = () => {
	const userRole = useSelector(
		(state: RootState) => state.user.user?.role ?? null,
	)
	const canEdit = userRole === UserRole.OWNER || userRole === UserRole.ADMIN

	const { data: products = [], isLoading, isFetching } = useGetProductsQuery({})
	const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation()
	const [postProduct, { isLoading: isPosting }] = usePostProductMutation()
	const [editProduct] = useEditProductMutation()

	const { isOpen, onOpen, onClose } = useDisclosure()
	const [form, setForm] = useState(EMPTY_FORM)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [feedback, setFeedback] = useState('')

	const openAdd = () => {
		setForm(EMPTY_FORM)
		setEditingId(null)
		setFeedback('')
		onOpen()
	}

	const openEdit = (p: ProductApi) => {
		setForm({
			id: p.id ?? '',
			name: p.name,
			barcode: p.barcode,
			price: p.price,
			count: p.count,
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
					id: form.id,
					name: form.name,
					barcode: form.barcode,
					price: Number(form.price),
					count: Number(form.count),
					description: form.description,
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

	const isBusy = isLoading || isFetching

	return (
		<Box>
			<HStack justify="space-between" mb={6}>
				<Heading size="lg">Products</Heading>
				{canEdit && (
					<Button colorScheme="blue" onClick={openAdd}>
						Add Product
					</Button>
				)}
			</HStack>

			{isBusy && <Spinner />}

			{!isBusy && products.length === 0 && (
				<Text color="gray.500">No products found.</Text>
			)}

			{!isBusy && products.length > 0 && (
				<Box overflowX="auto">
					<Table variant="simple" size="sm">
						<Thead>
							<Tr>
								<Th>Name</Th>
								<Th>Barcode</Th>
								<Th isNumeric>Price (€)</Th>
								<Th isNumeric>Stock</Th>
								{canEdit && <Th>Actions</Th>}
							</Tr>
						</Thead>
						<Tbody>
							{products.map(p => (
								<Tr key={p._id}>
									<Td>{p.name}</Td>
									<Td>{p.barcode}</Td>
									<Td isNumeric>{p.price.toFixed(2)}</Td>
									<Td isNumeric>{p.count}</Td>
									{canEdit && (
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

			<Modal isOpen={isOpen} onClose={handleClose} isCentered>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>
						{editingId ? 'Edit Product' : 'Add Product'}
					</ModalHeader>
					<ModalBody>
						<VStack gap={3}>
							<FormControl>
								<FormLabel>ID</FormLabel>
								<Input
									value={form.id}
									onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>Name</FormLabel>
								<Input
									value={form.name}
									onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>Barcode</FormLabel>
								<Input
									value={form.barcode}
									onChange={e =>
										setForm(f => ({ ...f, barcode: e.target.value }))
									}
								/>
							</FormControl>
							<FormControl>
								<FormLabel>Price (€)</FormLabel>
								<NumberInput
									value={form.price}
									min={0}
									onChange={val => setForm(f => ({ ...f, price: Number(val) }))}
								>
									<NumberInputField />
								</NumberInput>
							</FormControl>
							<FormControl>
								<FormLabel>Stock</FormLabel>
								<NumberInput
									value={form.count}
									min={0}
									onChange={val => setForm(f => ({ ...f, count: Number(val) }))}
								>
									<NumberInputField />
								</NumberInput>
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
