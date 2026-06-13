import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react'
import { RemoveArrowIcon } from '../icons/RemoveArrow'
import { useTranslation } from 'react-i18next'
import { hoverFocusButtonStyles } from '../../theme/styles'
import FilterModal, {
	FilterFieldVisibility,
	FilterSelectOption,
	ProductFilterValues,
} from './FilterModal'
const styles = {
	desktopFiltersRow: {
		alignItems: 'flex-start',
		paddingTop: '0.2rem',
		paddingBottom: '0.5rem',
		justifyContent: 'space-between',
		position: 'relative',
		zIndex: 2,
		width: 'calc(100% - 0.5rem)',
		borderBottom: '1px solid #EAEAEA',
	},
	desktopFiltersRowLeft: {
		gap: 0,
		maxWidth: '80%',
		flexWrap: 'wrap',
		alignItems: 'center',
	},
	desktopFiltersRowRight: {
		gap: '1rem',
		paddingTop: '0.2rem',
		marginRight: '1rem',
		alignItems: 'center',
	},
	resetFilterButton: {
		...hoverFocusButtonStyles,
		_active: { color: '#000000' },
		borderRadius: 4,
		fontWeight: 700,
		fontSize: '0.9rem',
		px: 0,
		color: '#929494',
	},
	spaceCount: {
		color: '#929494',
		fontSize: '0.875rem',
		fontStyle: 'normal',
		fontWeight: 500,
		alignSelf: 'end',
	},
} satisfies StylesObject

interface FiltersProps {
	filters: ProductFilterValues
	onApplyFilters: (filters: ProductFilterValues) => void
	onResetFilters: () => void
	supplierOptions: FilterSelectOption[]
	brandOptions: FilterSelectOption[]
	stateOptions: FilterSelectOption[]
	categoryOptions: FilterSelectOption[]
	entryTypeOptions?: FilterSelectOption[]
	productNameOptions?: FilterSelectOption[]
	customerOptions?: FilterSelectOption[]
	showSupplierFilter: boolean
	fieldVisibility?: FilterFieldVisibility
}

const Filters = ({
	filters,
	onApplyFilters,
	onResetFilters,
	supplierOptions,
	brandOptions,
	stateOptions,
	categoryOptions,
	entryTypeOptions = [],
	productNameOptions = [],
	customerOptions = [],
	showSupplierFilter,
	fieldVisibility,
}: FiltersProps) => {
	const { t } = useTranslation()
	const isFieldVisible = (
		field: keyof FilterFieldVisibility,
		defaultValue = true,
	) => fieldVisibility?.[field] ?? defaultValue

	const selectedFiltersCount =
		(filters.searchText ? 1 : 0) +
		(showSupplierFilter && isFieldVisible('supplier')
			? filters.supplier.length
			: 0) +
		(isFieldVisible('brand') ? filters.brand.length : 0) +
		(isFieldVisible('state') ? filters.state.length : 0) +
		(isFieldVisible('category') ? filters.category.length : 0) +
		(isFieldVisible('entryType', false) ? (filters.entryType ?? []).length : 0) +
		(isFieldVisible('productName', false)
			? (filters.productName ?? []).length
			: 0) +
		(isFieldVisible('customer', false) ? (filters.customer ?? []).length : 0) +
		(isFieldVisible('invoiceDate', false) && filters.invoiceDateFrom ? 1 : 0) +
		(isFieldVisible('invoiceDate', false) && filters.invoiceDateTo ? 1 : 0)

	return (
		<Flex sx={styles.desktopFiltersRow}>
			<HStack sx={styles.desktopFiltersRowLeft}>
				<Text sx={styles.spaceCount}>
					{selectedFiltersCount > 0
						? `${selectedFiltersCount} active filter${selectedFiltersCount > 1 ? 's' : ''}`
						: ''}
				</Text>
			</HStack>
			<HStack sx={styles.desktopFiltersRowRight}>
				<Box>
					<Button
						size={'sm'}
						rightIcon={<RemoveArrowIcon color={'#929494'} boxSize={5} />}
						variant="ghost"
						aria-label={t('components.filters.clearFilter')}
						sx={styles.resetFilterButton}
						onClick={onResetFilters}
						isDisabled={selectedFiltersCount === 0}
					>
						{t('components.filters.clearFilters')}
					</Button>
				</Box>
				<FilterModal
					selectedFiltersCount={selectedFiltersCount}
					filterValues={filters}
					onApplyFilters={onApplyFilters}
					onResetFilters={onResetFilters}
					supplierOptions={supplierOptions}
					brandOptions={brandOptions}
					stateOptions={stateOptions}
					categoryOptions={categoryOptions}
					entryTypeOptions={entryTypeOptions}
					productNameOptions={productNameOptions}
					customerOptions={customerOptions}
					showSupplierFilter={showSupplierFilter}
					fieldVisibility={fieldVisibility}
					showSavedFilterOptions={false}
				/>
			</HStack>
		</Flex>
	)
}

export default Filters
