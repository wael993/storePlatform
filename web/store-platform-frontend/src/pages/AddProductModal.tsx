import {
	Modal,
	ModalOverlay,
	ModalContent,
	ModalHeader,
	ModalBody,
	Input,
	Button,
	VStack,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { usePostProductMutation } from '../api/apiStore'

const AddProductModal = ({ isOpen, onClose, barcode }: any) => {
	const [postNewProduct, { isLoading }] = usePostProductMutation()

	const [form, setForm] = useState({
		id: '',
		name: '',
		barcode: '',
		price: 0,
		count: 0,
		description: '',
	})

	// 👇 auto-fill barcode
	useEffect(() => {
		if (barcode) {
			setForm(prev => ({ ...prev, barcode }))
		}
	}, [barcode])

	const handleChange = (key: string, value: string) => {
		setForm(prev => ({ ...prev, [key]: value }))
	}

	const handleSubmit = async () => {
		console.log('Create product:', form)

		await postNewProduct({
			id: form.id,
			name: form.name,
			barcode: form.barcode,
			price: Number(form.price),
			count: Number(form.price),
			description: form.description,
		}).unwrap()
		onClose()
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalOverlay />

			<ModalContent>
				<ModalHeader>New Product</ModalHeader>
				<ModalBody>
					<VStack>
						<Input
							placeholder="Id"
							onChange={e => handleChange('id', e.target.value)}
						/>
						<Input
							placeholder="Name"
							onChange={e => handleChange('name', e.target.value)}
						/>
						<Input
							placeholder="Price"
							onChange={e => handleChange('price', e.target.value)}
						/>
						<Input
							placeholder="Description"
							onChange={e => handleChange('description', e.target.value)}
						/>
						<Input
							placeholder="Count"
							onChange={e => handleChange('count', e.target.value)}
						/>
						<Input value={form.barcode} isReadOnly />

						<Button colorScheme="green" onClick={handleSubmit}>
							Save Product
						</Button>
					</VStack>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default AddProductModal
