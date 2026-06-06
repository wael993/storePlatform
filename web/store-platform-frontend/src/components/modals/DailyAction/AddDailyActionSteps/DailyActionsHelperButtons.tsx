import { SimpleGrid, Button, useDisclosure } from '@chakra-ui/react'
import { AsCheckmarkCircleIcon } from '../../../../icons/CheckmarkCircle'
import { hoverFocusActiveButtonStyles } from '../../../../theme/styles'
import { useState } from 'react'
import {
	useCreateCurrencyMutation,
	useCreateCustomerMutation,
	useCreateSupplierMutation,
	useCreateUnitMutation,
	useGetCurrenciesQuery,
	useGetCustomersQuery,
	useGetProductsQuery,
	useGetSuppliersQuery,
	useGetUnitsQuery,
	useQuickAddProductMutation,
	usePostProductMutation,
} from '../../../../api/apiStore'
import AddQuickProductsModal from '../../AddQuickProductsModal'
import { useUser } from '../../../../shared/hooks/useUser'
import { v4 as uuidv4 } from 'uuid'

const styles = {
	button: {
		margin: { base: '0 0 1rem 2rem', md: '1rem 1rem 1rem 0rem' },
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		p: { base: '4', md: '1rem 1.5rem 1rem 1.5rem' },
		whiteSpace: 'nowrap',
		borderRadius: '0',
		...hoverFocusActiveButtonStyles,
	},
} satisfies StylesObject

const DailyActionsHelperButtons = () => {
	const [productName, setProductName] = useState<string>('')
	const {
		isOpen: isQuickAddModalOpen,
		onOpen: onQuickAddModalOpen,
		onClose: onQuickAddModalClose,
	} = useDisclosure()

	const { isOwnerOrAdmin } = useUser()

	const [postNewProduct, { isLoading }] = usePostProductMutation()
	const [createSupplier] = useCreateSupplierMutation()
	const [createCustomer] = useCreateCustomerMutation()
	const [createCurrency] = useCreateCurrencyMutation()
	const [createUnit] = useCreateUnitMutation()

	const askName = (label: string): string | null => {
		const value = window.prompt(`Enter ${label} name`)
		if (!value || !value.trim()) {
			return null
		}

		return value.trim()
	}

	const onAddQuickProduct = async (productName: string) => {
		if (!productName) return

		const unit = 'kg'

		try {
			await postNewProduct({
				name: productName,
				barcode: uuidv4(),
				unit,
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
			}).unwrap()
		} catch (error) {
			console.error('Failed to add product', error)
		} finally {
			onQuickAddModalClose()
			setProductName('')
		}
	}

	const addSupplier = async () => {
		const name = askName('supplier')
		if (!name) return

		try {
			await createSupplier({ name }).unwrap()
		} catch (error) {
			console.error('Failed to add supplier', error)
		}
	}
	const addCustomer = async () => {
		const name = askName('customer')
		if (!name) return

		try {
			await createCustomer({ name }).unwrap()
		} catch (error) {
			console.error('Failed to add customer', error)
		}
	}
	const addCurrency = async () => {
		const codeInput = window.prompt('Enter currency code (e.g. EUR)')
		if (!codeInput || !codeInput.trim()) return

		const code = codeInput.trim().toUpperCase()
		const labelInput = window.prompt(
			`Enter currency label for ${code} (optional)`,
		)
		const label = labelInput?.trim() || code

		try {
			await createCurrency({ code, label }).unwrap()
		} catch (error) {
			console.error('Failed to add currency', error)
		}
	}
	const addUnit = async () => {
		const name = askName('unit')
		if (!name) return

		try {
			await createUnit({ name }).unwrap()
		} catch (error) {
			console.error('Failed to add unit', error)
		}
	}

	return (
		<>
			<SimpleGrid columns={[1, 2, 3]} gap={6} sx={{ marginTop: '2rem' }}>
				<Button
					rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
					size={'md'}
					variant={'primary'}
					onClick={onQuickAddModalOpen}
					sx={{
						...styles.button,
						backgroundColor: '#376288',
						color: '#FFFFFF',
					}}
				>
					Add Product
				</Button>
				<Button
					rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
					size={'md'}
					variant={'primary'}
					onClick={addCurrency}
					sx={{
						...styles.button,
						backgroundColor: '#376288',
						color: '#FFFFFF',
					}}
				>
					Add Currency
				</Button>
				<Button
					rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
					size={'md'}
					variant={'primary'}
					onClick={addSupplier}
					sx={{
						...styles.button,
						backgroundColor: '#376288',
						color: '#FFFFFF',
					}}
				>
					Add Supplier
				</Button>
				<Button
					rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
					size={'md'}
					variant={'primary'}
					onClick={addCustomer}
					sx={{
						...styles.button,
						backgroundColor: '#376288',
						color: '#FFFFFF',
					}}
				>
					Add Customer
				</Button>
				<Button
					rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
					size={'md'}
					variant={'primary'}
					onClick={addUnit}
					sx={{
						...styles.button,
						backgroundColor: '#376288',
						color: '#FFFFFF',
					}}
				>
					Add Unit
				</Button>
			</SimpleGrid>

			<AddQuickProductsModal
				isOpen={isQuickAddModalOpen}
				onClose={() => onQuickAddModalClose()}
				isLoading={isLoading}
				setProductName={setProductName}
				productName={productName}
				onAddQuickProduct={product => {
					onAddQuickProduct(product)
				}}
				userHasAdminRole={isOwnerOrAdmin}
			/>
		</>
	)
}
export default DailyActionsHelperButtons
