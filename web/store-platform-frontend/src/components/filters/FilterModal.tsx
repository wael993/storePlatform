import {
	Box,
	Button,
	Checkbox,
	Circle,
	Divider,
	Flex,
	FormControl,
	FormLabel,
	Grid,
	HStack,
	Input,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { AsFilterIcon } from '../icons/Filter'
import { Dropdown } from '../dropdown/Dropdown'
import {
	BrandDropdown,
	CategoryDropdown,
	StateDropdown,
	SupplierDropdown,
} from './dropdowns/index'
import { dropdownStyles } from './dropdowns/styles'

export interface FilterSelectOption {
	value: string
	label: string
	stateColor?: string
	stateTitle?: string
}

export interface ProductFilterValues {
	searchText: string
	supplier: string[]
	brand: string[]
	state: string[]
	category: string[]
	entryType?: string[]
	productName?: string[]
	customer?: string[]
}

export type FilterFieldVisibility = {
	supplier?: boolean
	brand?: boolean
	state?: boolean
	category?: boolean
	entryType?: boolean
	productName?: boolean
	customer?: boolean
}

const styles = {
	dropdown: {
		border: 'solid 1px #EAEAEA',
		borderRadius: '0.5rem',
		padding: '0.75rem',
		width: '100%',
		justifyContent: 'flex-start',
		alignItems: 'center',
	},
	desktopFiltersFilterButton: {
		gap: 2,
		alignItems: 'center',
		cursor: 'pointer',
		fontWeight: 700,
		fontSize: '0.9rem',
		px: 0,
		color: '#929494',
	},
	savePresetText: {
		fontSize: '0.875rem',
		fontWeight: '700',
		color: '#929494',
	},
	button: {
		fontSize: '0.875rem',
		fontWeight: '700',
		borderRadius: 0,
		...hoverFocusActiveButtonStyles,
	},
	grid: {
		gridTemplateColumns: 'repeat(2, calc(50% - 0.625rem))',
		gap: '1.25rem',
	},
	mobileGrid: {
		gridTemplateColumns: 'repeat(1, 100%)',
		gap: '1.25rem',
	},
	filterField: {
		width: '100%',
	},
	modalBody: {
		padding: '1.25rem',
	},
	circleFilterCounter: {
		width: '1.2rem',
		height: '1.2rem',
		backgroundColor: '#929494',
		color: '#FFFFFF',
		textAlign: 'center',
		marginRight: '0.25rem',
	},
} satisfies StylesObject

interface FilterModalProps {
	selectedFiltersCount?: number
	isMobile?: boolean
	showSavedFilterOptions?: boolean
	showSupplierFilter?: boolean
	filterValues: ProductFilterValues
	onApplyFilters: (filters: ProductFilterValues) => void
	onResetFilters: () => void
	supplierOptions: FilterSelectOption[]
	brandOptions: FilterSelectOption[]
	stateOptions: FilterSelectOption[]
	categoryOptions: FilterSelectOption[]
	entryTypeOptions?: FilterSelectOption[]
	productNameOptions?: FilterSelectOption[]
	customerOptions?: FilterSelectOption[]
	fieldVisibility?: FilterFieldVisibility
	showWarningBorder?: boolean
}

const FilterModal = ({
	selectedFiltersCount = 0,
	isMobile = false,
	showSavedFilterOptions = true,
	showSupplierFilter = false,
	filterValues,
	onApplyFilters,
	onResetFilters,
	supplierOptions,
	brandOptions,
	stateOptions,
	showWarningBorder,
	categoryOptions,
	entryTypeOptions = [],
	productNameOptions = [],
	customerOptions = [],
	fieldVisibility,
}: FilterModalProps) => {
	const { t } = useTranslation()
	const {
		isOpen: isFilterModalOpen,
		onOpen,
		onClose: onFilterModalClose,
	} = useDisclosure()
	const [localFilters, setLocalFilters] =
		useState<ProductFilterValues>(filterValues)
	const [isSaveCurrentSelection, setIsSaveCurrentSelection] = useState(false)

	useEffect(() => {
		if (isFilterModalOpen) {
			setLocalFilters(filterValues)
		}
	}, [filterValues, isFilterModalOpen])

	const handleShowResults = () => {
		onApplyFilters(localFilters)
		onFilterModalClose()
	}

	// const handleResetAndClose = () => {
	// 	setLocalFilters(EMPTY_FILTERS)
	// 	onResetFilters()
	// 	onFilterModalClose()
	// }

	// const handleBrandsFilterChange = useHandleBrandsFilterChange()

	const isFieldVisible = (
		field: keyof FilterFieldVisibility,
		defaultValue = true,
	) => fieldVisibility?.[field] ?? defaultValue

	return (
		<>
			<HStack sx={styles.desktopFiltersFilterButton} onClick={onOpen}>
				{selectedFiltersCount > 0 && (
					<Circle sx={styles.circleFilterCounter}>
						<Text fontSize="xs">{selectedFiltersCount}</Text>
					</Circle>
				)}
				<Text>{t('components.filters.filter')}</Text>
				<AsFilterIcon />
			</HStack>

			<Modal
				isOpen={isFilterModalOpen}
				onClose={onFilterModalClose}
				size={isMobile ? 'full' : '2xl'}
				isCentered={!isMobile}
				blockScrollOnMount={true}
				scrollBehavior="inside"
				trapFocus={false}
				allowPinchZoom={true}
				preserveScrollBarGap={false}
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>
						<HStack>
							<AsFilterIcon />
							<Text>{t('components.filters.filter')}</Text>
						</HStack>
					</ModalHeader>
					<Divider />
					<ModalBody sx={styles.modalBody}>
						<Flex
							sx={styles.dropdown}
							marginBottom={'1.25rem'}
							key={'searchbar'}
						>
							<FormControl sx={styles.filterField}>
								<FormLabel mb={1}>Search</FormLabel>
								<Input
									placeholder="Name, Product ID, Barcode"
									value={localFilters.searchText}
									onChange={e =>
										setLocalFilters(prev => ({
											...prev,
											searchText: e.target.value,
										}))
									}
								/>
							</FormControl>
						</Flex>

						<Grid sx={isMobile ? styles.mobileGrid : styles.grid}>
							{isFieldVisible('entryType', false) && (
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										placeholder={t('common.entryType')}
										dropDownOptions={entryTypeOptions}
										selectedValues={localFilters.entryType ?? []}
										onSelect={(entryType: string[]) =>
											setLocalFilters(prev => ({ ...prev, entryType }))
										}
									/>
								</Box>
							)}

							{isFieldVisible('productName', false) && (
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										placeholder={t('common.productName')}
										dropDownOptions={productNameOptions}
										selectedValues={localFilters.productName ?? []}
										onSelect={(productName: string[]) =>
											setLocalFilters(prev => ({ ...prev, productName }))
										}
									/>
								</Box>
							)}

							{showSupplierFilter && isFieldVisible('supplier') && (
								<SupplierDropdown
									options={supplierOptions}
									selectedValues={localFilters.supplier}
									onChange={supplier =>
										setLocalFilters(prev => ({ ...prev, supplier }))
									}
								/>
							)}

							{isFieldVisible('customer', false) && (
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										placeholder={t('components.pageHeaders.customer')}
										dropDownOptions={customerOptions}
										selectedValues={localFilters.customer ?? []}
										onSelect={(customer: string[]) =>
											setLocalFilters(prev => ({ ...prev, customer }))
										}
									/>
								</Box>
							)}

							{isFieldVisible('brand') && (
								<Box
									sx={{
										outline: showWarningBorder ? '1px solid #FF0000' : 'none',
									}}
								>
									<BrandDropdown
										options={brandOptions}
										selectedValues={localFilters.brand}
										onChange={brand =>
											setLocalFilters(prev => ({ ...prev, brand }))
										}
									/>
								</Box>
							)}

							{isFieldVisible('state') && (
								<StateDropdown
									options={stateOptions}
									selectedValues={localFilters.state}
									onChange={(state: string[]) =>
										setLocalFilters(prev => ({ ...prev, state }))
									}
								/>
							)}

							{isFieldVisible('category') && (
								<CategoryDropdown
									options={categoryOptions}
									selectedValues={localFilters.category}
									onChange={category =>
										setLocalFilters(prev => ({ ...prev, category }))
									}
								/>
							)}
						</Grid>
					</ModalBody>
					<ModalFooter
						justifyContent={
							showSavedFilterOptions ? 'space-between' : 'flex-end'
						}
					>
						{showSavedFilterOptions && (
							<HStack>
								<Checkbox
									isChecked={isSaveCurrentSelection}
									onChange={() =>
										setIsSaveCurrentSelection(!isSaveCurrentSelection)
									}
								/>
								<Text sx={styles.savePresetText}>
									{t('components.filters.saveFilterPreset')}
								</Text>
							</HStack>
						)}
						<HStack>
							{/* <Button sx={styles.button} onClick={handleResetAndClose}>
								Clear
							</Button> */}
							<Button sx={styles.button} onClick={onFilterModalClose}>
								{t('common.cancel')}
							</Button>
							<Button
								sx={{
									...styles.button,
									color: '#FFFFFF',
									backgroundColor: '#005D81',
								}}
								variant="primary"
								onClick={handleShowResults}
							>
								{t('common.showResults')}
							</Button>
						</HStack>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	)
}

export default FilterModal
