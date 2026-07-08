import { Box, Flex, Heading, HStack } from '@chakra-ui/react'
import { useState } from 'react'
import BarcodeScanner from './BarcodeScanner'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { BreadCrumbItem } from '../shared/globalEnums'
import { generateBreadcrumbs } from '../shared/routes'
// import { useGetDailyActionsQuery } from '../api/apiStore'
import { hoverFocusActiveButtonStyles } from '../theme/styles'
import Filters from '../components/filters/Filters'

export type StoreCartItem = Product & {
	cartQuantity: number
}
const fullWidth = '100%'

const styles = {
	wrapper: {
		width: fullWidth,
		flexDir: 'column',
		paddingBottom: '1rem',
	},
	header: {
		flexDir: 'column',
		width: fullWidth,
		paddingX: '1rem',
	},
	title: {
		fontSize: '1.5rem',
		fontWeight: 700,
		marginTop: '0.4rem',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		display: 'block',
		whiteSpace: 'nowrap',
		paddingX: '1rem',
	},
	divider: {
		borderBottom: '1px solid #EAEAEA}',
		marginTop: '1px',
		marginRight: {
			base: '0',
			md: '0.5rem',
			xl: '0.5rem',
		},
	},
	addProductButton: {
		...hoverFocusActiveButtonStyles,
		gap: '0.25rem',
	},
	addProductButtonText: {
		fontSize: '0.875rem',
		fontWeight: 700,
		color: '#1E1E1E',
	},
} satisfies StylesObject

const BarcodePage = () => {
	const [_card, setCart] = useState<StoreCartItem[]>([])
	const breadCrumbItems = generateBreadcrumbs()

	// const { data: dailyActions = [], isLoading: isDailyActionsLoading } =
	// 	useGetDailyActionsQuery({})

	const addToCart = (p: Product) => {
		setCart(prev => {
			const existing = prev.find(item => item.productId === p.productId)
			const maxStock = p.price?.purchasePrice ?? 0

			if (existing) {
				if (existing.cartQuantity >= maxStock) {
					return prev
				}

				return prev.map(item =>
					item.productId === p.productId
						? {
								...item,
								cartQuantity: item.cartQuantity + 1,
							}
						: item,
				)
			}

			if (maxStock <= 0) {
				return prev
			}

			return [...prev, { ...p, cartQuantity: 1 }]
		})
	}

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.BARCODE]}
				/>
				<Heading sx={styles.title} variant={'h5'}>
					{'المتجر'}
				</Heading>
			</Flex>

			<Box sx={styles.divider} />

			<HStack justify="space-between" gap={4} w="100%">
				<Box flex="3">
					<BarcodeScanner addToCart={addToCart} />
				</Box>

				<Box flex="1">
					<Filters
						filters={{
							searchText: '',
							supplier: [],
							brand: [],
							state: [],
							category: [],
						}}
						onApplyFilters={() => {
							console.log('apply filters')
						}}
						onResetFilters={() => {
							console.log('reset filters')
						}}
						supplierOptions={[]}
						brandOptions={[]}
						stateOptions={[]}
						categoryOptions={[]}
						showSupplierFilter={false}
					/>
				</Box>
			</HStack>
		</Flex>
	)
}

export default BarcodePage
