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
		productFactoryCode: '',
		barcode: '',
		categoryId: '',
		brandId: '',
		priceWholesale: '',
		priceRetailSale: '',
		priceSemiWholesaleSales: '',
		priceBuyCost: '',
		priceDiscount: '',
		currency: 'EUR',
		stockQuantity: '',
		stockMinQuantity: '',
		unit: 'piece' as 'piece' | 'kg' | 'meter' | 'set' | 'mm',
		taxType: 'VAT',
		taxValue: '19',
		supplierId: '',
		warehouse: '',
		shelf: '',
		color: '',
		size: '',
		weight: '',
		length: '',
		width: '',
		height: '',
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

		if (
			!form.priceWholesale ||
			!form.priceRetailSale ||
			!form.priceBuyCost ||
			!form.stockQuantity
		) {
			setError(
				'Wholesale price, retail sale price, buy cost and stock quantity are required.',
			)
			return
		}

		try {
			await postNewProduct({
				name: form.name.trim(),
				productFactoryCode: form.productFactoryCode.trim() || undefined,
				barcode: form.barcode.trim(),
				categoryId: form.categoryId.trim() || undefined,
				brandId: form.brandId.trim() || undefined,
				images: [],
				price: {
					wholesale: Number(form.priceWholesale),
					retailSale: Number(form.priceRetailSale),
					semiWholesaleSales: Number(form.priceSemiWholesaleSales) || 0,
					buyCost: Number(form.priceBuyCost),
					discount: form.priceDiscount ? Number(form.priceDiscount) : undefined,
					currency: form.currency.trim() || 'EUR',
				},
				stock: {
					quantity: Number(form.stockQuantity),
					minQuantity: form.stockMinQuantity
						? Number(form.stockMinQuantity)
						: undefined,
				},
				unit: form.unit || 'piece',
				tax: form.taxType.trim()
					? {
							type: form.taxType.trim(),
							value: Number(form.taxValue || 0),
						}
					: undefined,
				supplierId: form.supplierId.trim() || undefined,
				location:
					form.warehouse.trim() || form.shelf.trim()
						? {
								warehouse: form.warehouse.trim() || undefined,
								shelf: form.shelf.trim() || undefined,
							}
						: undefined,
				attributes: {
					color: form.color.trim() || undefined,
					size: form.size.trim() || undefined,
					weight: form.weight.trim() || undefined,
					length: form.length.trim() || undefined,
					width: form.width.trim() || undefined,
					height: form.height.trim() || undefined,
				},
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
						<Input
							placeholder="Product Factory Code"
							value={form.productFactoryCode}
							onChange={e => handleChange('productFactoryCode', e.target.value)}
						/>
						<Input placeholder="Barcode" value={form.barcode} isReadOnly />
						<Input
							placeholder="Category ID"
							value={form.categoryId}
							onChange={e => handleChange('categoryId', e.target.value)}
						/>
						<Input
							placeholder="Brand ID"
							value={form.brandId}
							onChange={e => handleChange('brandId', e.target.value)}
						/>
						<Input
							placeholder="Wholesale Price"
							type="number"
							value={form.priceWholesale}
							onChange={e => handleChange('priceWholesale', e.target.value)}
						/>
						<Input
							placeholder="Retail Sale Price"
							type="number"
							value={form.priceRetailSale}
							onChange={e => handleChange('priceRetailSale', e.target.value)}
						/>
						<Input
							placeholder="Semi-Wholesale Sales Price"
							type="number"
							value={form.priceSemiWholesaleSales}
							onChange={e =>
								handleChange('priceSemiWholesaleSales', e.target.value)
							}
						/>
						<Input
							placeholder="Buy Cost"
							type="number"
							value={form.priceBuyCost}
							onChange={e => handleChange('priceBuyCost', e.target.value)}
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
						<Select
							value={form.unit}
							onChange={e => handleChange('unit', e.target.value)}
						>
							<option value="piece">Piece</option>
							<option value="kg">KG</option>
							<option value="meter">Meter</option>
							<option value="set">Set</option>
							<option value="mm">MM</option>
						</Select>
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
							placeholder="Size"
							value={form.size}
							onChange={e => handleChange('size', e.target.value)}
						/>
						<Input
							placeholder="Weight"
							value={form.weight}
							onChange={e => handleChange('weight', e.target.value)}
						/>
						<Input
							placeholder="Length"
							value={form.length}
							onChange={e => handleChange('length', e.target.value)}
						/>
						<Input
							placeholder="Width"
							value={form.width}
							onChange={e => handleChange('width', e.target.value)}
						/>
						<Input
							placeholder="Height"
							value={form.height}
							onChange={e => handleChange('height', e.target.value)}
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
