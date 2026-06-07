import { useState } from 'react'
import { Button, SimpleGrid, useDisclosure } from '@chakra-ui/react'
import { v4 as uuidv4 } from 'uuid'

import { AsCheckmarkCircleIcon } from '../../../../icons/CheckmarkCircle'
import { hoverFocusActiveButtonStyles } from '../../../../theme/styles'
import {
	useCreateCurrencyMutation,
	useCreateCustomerMutation,
	useCreateSupplierMutation,
	useCreateUnitMutation,
	usePostProductMutation,
} from '../../../../api/apiStore'
import AddQuickProductsModal from '../../AddQuickProductsModal'
import { useUser } from '../../../../shared/hooks/useUser'

const styles = {
	button: {
		margin: { base: '0 0 1rem 2rem', md: '1rem 1rem 1rem 0rem' },
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		p: { base: '4', md: '1rem 1.5rem' },
		whiteSpace: 'nowrap',
		borderRadius: '0',
		color: '#FFFFFF',
		...hoverFocusActiveButtonStyles,
	},
} satisfies StylesObject

type FormData = {
	code: string
	value: string
}

const BUTTONS: {
	type: AddQuickModalType
	label: string
}[] = [
	{ type: 'product', label: 'Add Product' },
	{ type: 'customer', label: 'Add Customer' },
	{ type: 'supplier', label: 'Add Supplier' },
	{ type: 'currency', label: 'Add Currency' },
	{ type: 'unit', label: 'Add Unit' },
]

const DailyActionsHelperButtons = () => {
	const [modalType, setModalType] = useState<AddQuickModalType>('product')
	const [formData, setFormData] = useState<FormData>({
		code: '',
		value: '',
	})

	const { isOwnerOrAdmin } = useUser()
	const { isOpen, onOpen, onClose } = useDisclosure()

	const [postNewProduct, { isLoading }] = usePostProductMutation()
	const [createSupplier] = useCreateSupplierMutation()
	const [createCustomer] = useCreateCustomerMutation()
	const [createCurrency] = useCreateCurrencyMutation()
	const [createUnit] = useCreateUnitMutation()

	const handleInputChange = (field: keyof FormData, value: string) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}))
	}

	const resetModal = () => {
		setFormData({
			code: '',
			value: '',
		})
		onClose()
	}

	const executeAction = async (
		action: () => Promise<unknown>,
		errorMessage: string,
	) => {
		try {
			await action()
		} catch (error) {
			console.error(errorMessage, error)
		} finally {
			resetModal()
		}
	}

	const actions: Record<AddQuickModalType, (data: FormData) => Promise<void>> =
		{
			product: async ({ value, code }) => {
				if (!value.trim()) return

				const generateRandomBarcode = (): string => {
					return Math.floor(Math.random() * 1000000)
						.toString()
						.padStart(6, '0')
				}
				await executeAction(
					() =>
						postNewProduct({
							name: value,
							internalCode: (code.trim() || value).toUpperCase(),
							barcode: generateRandomBarcode(),
							unit: 'kg',
							supplierId: '',
							state: '',
							stock: {
								quantity: 0,
								minQuantity: undefined,
							},
							price: {
								wholesale: 0,
								retailSale: 0,
								semiWholesaleSales: 0,
								buyCost: 0,
								discount: undefined,
								currency: 'EUR',
							},
						}).unwrap(),
					'Failed to add product',
				)
			},

			supplier: async ({ value, code }) => {
				if (!value.trim()) return

				await executeAction(
					() =>
						createSupplier({
							name: value,
							internalCode: (code.trim() || value).toUpperCase(),
						}).unwrap(),
					'Failed to add supplier',
				)
			},

			customer: async ({ value, code }) => {
				if (!value.trim()) return

				await executeAction(
					() =>
						createCustomer({
							name: value,
							internalCode: (code.trim() || value).toUpperCase(),
						}).unwrap(),
					'Failed to add customer',
				)
			},

			currency: async ({ value, code }) => {
				const label = value.trim()

				if (!label) return

				await executeAction(
					() =>
						createCurrency({
							name: label,
							internalCode: (code.trim() || label).toUpperCase(),
						}).unwrap(),
					'Failed to add currency',
				)
			},

			unit: async ({ value, code }) => {
				if (!value.trim()) return

				await executeAction(
					() =>
						createUnit({
							name: value,
							//internalCode: (code.trim() || value).toUpperCase(),
						}).unwrap(),
					'Failed to add unit',
				)
			},
		}

	const handleQuickAdd = async (data: FormData) => {
		await actions[modalType](data)
	}

	return (
		<>
			<SimpleGrid columns={[1, 2, 3]} gap={6} sx={{ marginTop: '2rem' }}>
				{BUTTONS.map(({ type, label }) => (
					<Button
						key={type}
						rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
						size="md"
						variant="primary"
						sx={styles.button}
						onClick={() => {
							setModalType(type)
							onOpen()
						}}
					>
						{label}
					</Button>
				))}
			</SimpleGrid>

			<AddQuickProductsModal
				handleInputChange={handleInputChange}
				isOpen={isOpen}
				modalType={modalType}
				onClose={onClose}
				isLoading={isLoading}
				setFormData={setFormData}
				inputValue={formData}
				handleQuickAdd={handleQuickAdd}
				userHasAdminRole={isOwnerOrAdmin}
			/>
		</>
	)
}

export default DailyActionsHelperButtons
