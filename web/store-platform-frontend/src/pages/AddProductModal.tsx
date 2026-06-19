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
import { useTranslation } from 'react-i18next'

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
	const { t } = useTranslation()
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
			setError(t('productModal.nameBarcodeRequired'))
			return
		}

		if (
			!form.priceWholesale ||
			!form.priceRetailSale ||
			!form.priceBuyCost ||
			!form.stockQuantity
		) {
			setError(t('productModal.requiredProductValues'))
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
				state: 'active',
				status: form.status,
				description: form.description.trim() || undefined,
			}).unwrap()
		} catch (error) {
			const err = error as { data?: { message?: string } }
			setError(err?.data?.message || t('productModal.createFailed'))
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
				<ModalHeader>{t('productModal.newProduct')}</ModalHeader>
				<ModalBody>
					<VStack spacing={3} pb={4}>
						{error ? <Text color="red.500">{error}</Text> : null}
						<Input
							placeholder={t('common.productName')}
							value={form.name}
							onChange={e => handleChange('name', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.productFactoryCode')}
							value={form.productFactoryCode}
							onChange={e => handleChange('productFactoryCode', e.target.value)}
						/>
						<Input
							placeholder={t('common.barcode')}
							value={form.barcode}
							isReadOnly
						/>
						<Input
							placeholder={t('productModal.categoryId')}
							value={form.categoryId}
							onChange={e => handleChange('categoryId', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.brandId')}
							value={form.brandId}
							onChange={e => handleChange('brandId', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.wholesalePrice')}
							type="number"
							value={form.priceWholesale}
							onChange={e => handleChange('priceWholesale', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.retailSalePrice')}
							type="number"
							value={form.priceRetailSale}
							onChange={e => handleChange('priceRetailSale', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.semiWholesaleSalesPrice')}
							type="number"
							value={form.priceSemiWholesaleSales}
							onChange={e =>
								handleChange('priceSemiWholesaleSales', e.target.value)
							}
						/>
						<Input
							placeholder={t('common.buyCost')}
							type="number"
							value={form.priceBuyCost}
							onChange={e => handleChange('priceBuyCost', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.discountPrice')}
							type="number"
							value={form.priceDiscount}
							onChange={e => handleChange('priceDiscount', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.currencyPlaceholder')}
							value={form.currency}
							onChange={e => handleChange('currency', e.target.value)}
						/>
						<Input
							placeholder={t('common.stockQuantity')}
							type="number"
							value={form.stockQuantity}
							onChange={e => handleChange('stockQuantity', e.target.value)}
						/>
						<Input
							placeholder={t('common.stockMinQuantity')}
							type="number"
							value={form.stockMinQuantity}
							onChange={e => handleChange('stockMinQuantity', e.target.value)}
						/>
						<Select
							value={form.unit}
							onChange={e => handleChange('unit', e.target.value)}
						>
							<option value="piece">{t('productModal.units.piece')}</option>
							<option value="kg">{t('productModal.units.kg')}</option>
							<option value="meter">{t('productModal.units.meter')}</option>
							<option value="set">{t('productModal.units.set')}</option>
							<option value="mm">{t('productModal.units.mm')}</option>
						</Select>
						<Input
							placeholder={t('productModal.taxType')}
							value={form.taxType}
							onChange={e => handleChange('taxType', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.taxValue')}
							type="number"
							value={form.taxValue}
							onChange={e => handleChange('taxValue', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.supplierId')}
							value={form.supplierId}
							onChange={e => handleChange('supplierId', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.warehouse')}
							value={form.warehouse}
							onChange={e => handleChange('warehouse', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.shelf')}
							value={form.shelf}
							onChange={e => handleChange('shelf', e.target.value)}
						/>
						<Input
							placeholder={t('common.color')}
							value={form.color}
							onChange={e => handleChange('color', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.size')}
							value={form.size}
							onChange={e => handleChange('size', e.target.value)}
						/>
						<Input
							placeholder={t('common.weight')}
							value={form.weight}
							onChange={e => handleChange('weight', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.length')}
							value={form.length}
							onChange={e => handleChange('length', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.width')}
							value={form.width}
							onChange={e => handleChange('width', e.target.value)}
						/>
						<Input
							placeholder={t('productModal.height')}
							value={form.height}
							onChange={e => handleChange('height', e.target.value)}
						/>
						<Input
							placeholder={t('common.weight')}
							value={form.weight}
							onChange={e => handleChange('weight', e.target.value)}
						/>
						<Select
							value={form.status}
							onChange={e => handleChange('status', e.target.value)}
						>
							<option value="active">{t('common.active')}</option>
							<option value="inactive">{t('common.inactive')}</option>
							<option value="discontinued">
								{t('components.product.states.discontinued')}
							</option>
						</Select>
						<Input
							placeholder={t('productModal.description')}
							value={form.description}
							onChange={e => handleChange('description', e.target.value)}
						/>

						<Button
							colorScheme="green"
							onClick={handleSubmit}
							isLoading={isLoading}
						>
							{t('productModal.saveProduct')}
						</Button>
					</VStack>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default AddProductModal
