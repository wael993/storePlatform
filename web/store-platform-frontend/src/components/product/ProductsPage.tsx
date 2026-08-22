import { useMemo, useState } from 'react'
import {
	Box,
	Button,
	Heading,
	Spinner,
	Text,
	HStack,
	Flex,
	useDisclosure,
} from '@chakra-ui/react'
import { Outlet } from 'react-router-dom'
import {
	useGetProductsQuery,
	useGetFilterValuesQuery,
} from '../../api/apiStore'
import { useSettings } from '../../shared/context/SettingsContext'
import {
	AllowedActions,
	BreadCrumbItem,
	TargetType,
} from '../../shared/globalEnums'
import { useResources } from '../../shared/hooks/useResources'
import { useUser } from '../../shared/hooks/useUser'
import TableWithActionBar from './table/ProductTableWithActionBar'
import { ListColumnConfigProvider } from '../list/columnConfig/ListColumnConfigProvider'
import { useProductColumnCatalog } from './table/productColumns'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { useTranslation } from 'react-i18next'
import { AddSquareIcon } from '../icons/AddSquare'
import CustomBreadcrumb from '../CustomBreadcrumb'
import { generateBreadcrumbs } from '../../shared/routes'
import Filters from '../filters/Filters'
import { FilterSelectOption, ProductFilterValues } from '../filters/FilterModal'
import { PRODUCT_STATE_CONFIG } from '../list/shared/constants'
import AddProductModal from '../../pages/AddProductModal'

const EMPTY_PRODUCT_FILTERS: ProductFilterValues = {
	searchText: '',
	supplier: [],
	brand: [],
	state: [],
	category: [],
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

interface ProductsPageProps {
	targetType: TargetType
}

const ProductsPage = (_targetType: ProductsPageProps) => {
	const { isOwnerOrAdmin } = useUser()
	const { isActionAllowed } = useResources()
	const { productsPerPage } = useSettings()

	const [productFilters, setProductFilters] = useState<ProductFilterValues>(
		EMPTY_PRODUCT_FILTERS,
	)
	const [currentPage, setCurrentPage] = useState(0)

	const { data: response, isLoading } = useGetProductsQuery(
		{
			...productFilters,
			limit: productsPerPage,
			offset: currentPage * productsPerPage,
		},
		{ refetchOnMountOrArgChange: false },
	)

	const { data: filterValuesResponse } = useGetFilterValuesQuery()

	const products = response?.products ?? []
	const totalCount = response?.totalCount ?? 0
	const totalPages = Math.ceil(totalCount / productsPerPage)
	const breadCrumbItems = generateBreadcrumbs()

	const {
		isOpen: isAddProductModalOpen,
		onOpen: onAddProductModalOpen,
		onClose: onAddProductModalClose,
	} = useDisclosure()

	const handleApplyFilters = (filters: ProductFilterValues) => {
		setProductFilters(filters)
		setCurrentPage(0)
	}

	const handleResetFilters = () => {
		setProductFilters(EMPTY_PRODUCT_FILTERS)
		setCurrentPage(0)
	}

	const supplierOptions: FilterSelectOption[] =
		filterValuesResponse?.supplier ?? []
	const brandOptions: FilterSelectOption[] = filterValuesResponse?.brand ?? []
	const categoryOptions: FilterSelectOption[] =
		filterValuesResponse?.category ?? []

	const stateOptions = useMemo(() => {
		const baseOptions = filterValuesResponse?.state ?? []

		return baseOptions.map(option => {
			const stateConfig =
				PRODUCT_STATE_CONFIG[option.value as keyof typeof PRODUCT_STATE_CONFIG]

			return {
				...option,
				stateColor: stateConfig?.color ?? '#808080',
				stateTitle: stateConfig?.translationKey ?? option.label,
			}
		})
	}, [filterValuesResponse?.state])

	const openAdd = () => {
		onAddProductModalOpen()
	}

	const { t } = useTranslation()
	const productColumnCatalog = useProductColumnCatalog()

	return (
		<ListColumnConfigProvider
			listType="products"
			catalog={productColumnCatalog}
		>
			<Flex sx={styles.wrapper}>
				<Flex sx={styles.header}>
					{!isLoading && (
						<CustomBreadcrumb
							marginTop="2rem"
							items={breadCrumbItems[BreadCrumbItem.PRODUCTS]}
						/>
					)}
				</Flex>

				<HStack
					justify="space-between"
					mb={{ base: '1.5rem', md: '4rem' }}
					flexWrap={{ base: 'wrap', md: 'nowrap' }}
					gap={{ base: 3, md: 0 }}
				>
					<Heading sx={styles.title} variant={'h5'}>
						{t('components.pageHeaders.products')}
					</Heading>
					{isActionAllowed(AllowedActions.ADD_PRODUCT) && isOwnerOrAdmin && (
						<Button
							leftIcon={<AddSquareIcon />}
							onClick={openAdd}
							sx={styles.addProductButton}
							variant="ghost"
						>
							<Text sx={styles.addProductButtonText}>
								{t('common.addProduct')}
							</Text>
						</Button>
					)}
				</HStack>

				{isLoading && <Spinner />}

				<Box sx={styles.divider} />

				<Filters
					filters={productFilters}
					onApplyFilters={handleApplyFilters}
					onResetFilters={handleResetFilters}
					supplierOptions={supplierOptions}
					brandOptions={brandOptions}
					stateOptions={stateOptions}
					categoryOptions={categoryOptions}
					showSupplierFilter={isOwnerOrAdmin}
				/>

				{!isLoading && products.length === 0 && (
					<Text color="gray.500">{t('components.product.noProducts')}</Text>
				)}

				<TableWithActionBar
					products={products as Product[]}
					isLoading={isLoading}
				/>

				{!isLoading && totalPages > 1 && (
					<HStack justify="center" mt="2rem" gap="1rem">
						<Button
							onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
							isDisabled={currentPage === 0}
							size="sm"
						>
							{t('pagination.previous')}
						</Button>
						<Text fontSize="sm">
							{t('pagination.pageOf', {
								currentPage: currentPage + 1,
								totalPages,
							})}
						</Text>
						<Button
							onClick={() =>
								setCurrentPage(p => Math.min(totalPages - 1, p + 1))
							}
							isDisabled={currentPage >= totalPages - 1}
							size="sm"
						>
							{t('pagination.next')}
						</Button>
					</HStack>
				)}

				<AddProductModal
					isOpen={isAddProductModalOpen}
					onClose={onAddProductModalClose}
					barcode={''}
					onSuccess={onAddProductModalClose}
				/>
				<Outlet />
			</Flex>
		</ListColumnConfigProvider>
	)
}

export default ProductsPage
