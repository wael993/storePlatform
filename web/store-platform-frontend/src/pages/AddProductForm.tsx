import { Box, Input, Button, VStack } from '@chakra-ui/react'
import { useState } from 'react'

const AddProductForm = () => {
	const [form, setForm] = useState({
		name: '',
		price: '',
		barcode: '',
		count: '',
	})

	const handleChange = (key: string, value: string) => {
		setForm(prev => ({ ...prev, [key]: value }))
	}

	const handleSubmit = () => {
		console.log('Create product:', form)
		// 🔥 call mutation here
	}

	return (
		<Box>
			<VStack>
				<Input
					placeholder="Name"
					onChange={e => handleChange('name', e.target.value)}
				/>
				<Input
					placeholder="Price"
					onChange={e => handleChange('price', e.target.value)}
				/>
				<Input
					placeholder="Barcode"
					onChange={e => handleChange('barcode', e.target.value)}
				/>
				<Input
					placeholder="Stock"
					onChange={e => handleChange('count', e.target.value)}
				/>
				<Button onClick={handleSubmit} colorScheme="green">
					Add Product
				</Button>
			</VStack>
		</Box>
	)
}

export default AddProductForm
