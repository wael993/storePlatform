import {
	Modal,
	ModalOverlay,
	ModalContent,
	ModalHeader,
	ModalBody,
	Input,
	Button,
	Select,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { usePostProductMutation } from '../api/apiStore'

interface AddProductModalProps {
	isOpen: boolean
	onClose: () => void
	barcode: string
	onSuccess?: () => void
}

const AddProductModal = ({
	isOpen,
	onClose,
	barcode,
	onSuccess,
}: AddProductModalProps) => {
	const [postNewProduct, { isLoading }] = usePostProductMutation()
	const [error, setError] = useState('')

	const [form, setForm] = useState({
		name: '',
		barcode: '',
		brand: '',
		categoryId: '',
		categoryName: '',
		priceBuy: '',
		priceSell: '',
		priceDiscount: '',
		currency: 'EUR',
		stockQuantity: '',
		stockMinQuantity: '',
		stockUnit: 'piece',
		taxType: 'VAT',
		taxValue: '19',
		supplierId: '',
		supplierName: '',
		warehouse: '',
		shelf: '',
		color: '',
		weight: '',
		status: 'active' as 'active' | 'inactive' | 'discontinued',
		description: '',
	})

	useEffect(() => {
		if (barcode) {
			setForm(prev => ({ ...prev, barcode }))
		}
	}, [barcode])

	useEffect(() => {
		if (!isOpen) {
			setError('')
		}
	}, [isOpen])

	const handleChange = (key: string, value: string) => {
		setForm(prev => ({ ...prev, [key]: value }))
	}

	const handleSubmit = async () => {
		setError('')

		if (!form.name.trim() || !form.barcode.trim()) {
			setError('Name and barcode are required.')
			return
		}

		if (!form.priceBuy || !form.priceSell || !form.stockQuantity) {
			setError('Buy price, sell price and stock quantity are required.')
			return
		}

		try {
			await postNewProduct({
				name: form.name.trim(),
				barcode: form.barcode.trim(),
				brand: form.brand.trim() || undefined,
				images: [],
				category: form.categoryId.trim()
					? {
							id: form.categoryId.trim(),
							name: form.categoryName.trim(),
						}
					: undefined,
				price: {
					buy: Number(form.priceBuy),
					sell: Number(form.priceSell),
					discount: form.priceDiscount ? Number(form.priceDiscount) : undefined,
					currency: form.currency.trim() || 'EUR',
				},
				stock: {
					quantity: Number(form.stockQuantity),
					minQuantity: form.stockMinQuantity
						? Number(form.stockMinQuantity)
						: undefined,
					unit: form.stockUnit.trim() || 'piece',
				},
				tax: form.taxType.trim()
					? {
							type: form.taxType.trim(),
							value: Number(form.taxValue || 0),
						}
					: undefined,
				supplier:
					form.supplierId.trim() || form.supplierName.trim()
						? {
								id: form.supplierId.trim() || undefined,
								name: form.supplierName.trim() || undefined,
							}
						: undefined,
				location:
					form.warehouse.trim() || form.shelf.trim()
						? {
								warehouse: form.warehouse.trim() || undefined,
								shelf: form.shelf.trim() || undefined,
							}
						: undefined,
				attributes:
					form.color.trim() || form.weight.trim()
						? {
								color: form.color.trim() || undefined,
								weight: form.weight.trim() || undefined,
							}
						: undefined,
				status: form.status,
				description: form.description.trim() || undefined,
			}).unwrap()
		} catch (err: any) {
			setError(err?.data?.message || 'Failed to create product.')
			return
		}

		if (onSuccess) {
			onSuccess()
			return
		}

		onClose()
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalOverlay />

			<ModalContent>
				<ModalHeader>New Product</ModalHeader>
				<ModalBody>
					<VStack spacing={3} pb={4}>
						{error ? <Text color="red.500">{error}</Text> : null}
						<Input
							placeholder="Name"
							value={form.name}
							onChange={e => handleChange('name', e.target.value)}
						/>
						<Input placeholder="Barcode" value={form.barcode} isReadOnly />
						<Input
							placeholder="Brand"
							value={form.brand}
							onChange={e => handleChange('brand', e.target.value)}
						/>
						<Input
							placeholder="Category ID"
							value={form.categoryId}
							onChange={e => handleChange('categoryId', e.target.value)}
						/>
						<Input
							placeholder="Category Name"
							value={form.categoryName}
							onChange={e => handleChange('categoryName', e.target.value)}
						/>
						<Input
							placeholder="Buy Price"
							type="number"
							value={form.priceBuy}
							onChange={e => handleChange('priceBuy', e.target.value)}
						/>
						<Input
							placeholder="Sell Price"
							type="number"
							value={form.priceSell}
							onChange={e => handleChange('priceSell', e.target.value)}
						/>
						<Input
							placeholder="Discount Price"
							type="number"
							value={form.priceDiscount}
							onChange={e => handleChange('priceDiscount', e.target.value)}
						/>
						<Input
							placeholder="Currency (e.g. EUR)"
							value={form.currency}
							onChange={e => handleChange('currency', e.target.value)}
						/>
						<Input
							placeholder="Stock Quantity"
							type="number"
							value={form.stockQuantity}
							onChange={e => handleChange('stockQuantity', e.target.value)}
						/>
						<Input
							placeholder="Stock Min Quantity"
							type="number"
							value={form.stockMinQuantity}
							onChange={e => handleChange('stockMinQuantity', e.target.value)}
						/>
						<Input
							placeholder="Stock Unit (e.g. piece)"
							value={form.stockUnit}
							onChange={e => handleChange('stockUnit', e.target.value)}
						/>
						<Input
							placeholder="Tax Type"
							value={form.taxType}
							onChange={e => handleChange('taxType', e.target.value)}
						/>
						<Input
							placeholder="Tax Value"
							type="number"
							value={form.taxValue}
							onChange={e => handleChange('taxValue', e.target.value)}
						/>
						<Input
							placeholder="Supplier ID"
							value={form.supplierId}
							onChange={e => handleChange('supplierId', e.target.value)}
						/>
						<Input
							placeholder="Supplier Name"
							value={form.supplierName}
							onChange={e => handleChange('supplierName', e.target.value)}
						/>
						<Input
							placeholder="Warehouse"
							value={form.warehouse}
							onChange={e => handleChange('warehouse', e.target.value)}
						/>
						<Input
							placeholder="Shelf"
							value={form.shelf}
							onChange={e => handleChange('shelf', e.target.value)}
						/>
						<Input
							placeholder="Color"
							value={form.color}
							onChange={e => handleChange('color', e.target.value)}
						/>
						<Input
							placeholder="Weight"
							value={form.weight}
							onChange={e => handleChange('weight', e.target.value)}
						/>
						<Select
							value={form.status}
							onChange={e => handleChange('status', e.target.value)}
						>
							<option value="active">active</option>
							<option value="inactive">inactive</option>
							<option value="discontinued">discontinued</option>
						</Select>
						<Input
							placeholder="Description"
							value={form.description}
							onChange={e => handleChange('description', e.target.value)}
						/>

						<Button
							colorScheme="green"
							onClick={handleSubmit}
							isLoading={isLoading}
						>
							Save Product
						</Button>
					</VStack>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default AddProductModal
