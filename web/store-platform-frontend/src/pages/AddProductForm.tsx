import { Box, Input, Button, VStack } from '@chakra-ui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const AddProductForm = () => {
	const { t } = useTranslation()
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
					placeholder={t('common.productName')}
					onChange={e => handleChange('name', e.target.value)}
				/>
				<Input
					placeholder={t('common.price')}
					onChange={e => handleChange('price', e.target.value)}
				/>
				<Input
					placeholder={t('common.barcode')}
					onChange={e => handleChange('barcode', e.target.value)}
				/>
				<Input
					placeholder={t('common.stock')}
					onChange={e => handleChange('count', e.target.value)}
				/>
				<Button onClick={handleSubmit} colorScheme="green">
					{t('common.addProduct')}
				</Button>
			</VStack>
		</Box>
	)
}

export default AddProductForm
