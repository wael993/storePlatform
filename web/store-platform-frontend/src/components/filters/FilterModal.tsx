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
	IconButton,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Text,
	VStack,
	useDisclosure,
} from '@chakra-ui/react'
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { AsFilterIcon } from '../icons/Filter'
import StateCircle from '../StateCircle'

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
}

const EMPTY_FILTERS: ProductFilterValues = {
	searchText: '',
	supplier: [],
	brand: [],
	state: [],
	category: [],
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
	filterPanel: {
		border: '1px solid #EAEAEA',
		borderRadius: '0.5rem',
		overflow: 'hidden',
		backgroundColor: '#FFFFFF',
	},
	filterPanelHeader: {
		padding: '0.625rem 0.75rem',
		justifyContent: 'space-between',
		alignItems: 'center',
		cursor: 'pointer',
		borderBottom: '1px solid #F2F2F2',
	},
	filterPanelBody: {
		padding: '0.625rem 0.75rem 0.75rem',
		gap: '0.5rem',
	},
	filterPanelList: {
		maxHeight: '11rem',
		overflowY: 'auto',
		paddingRight: '0.25rem',
	},
	filterPanelItem: {
		padding: '0.25rem 0.125rem',
		alignItems: 'center',
	},
	selectionCount: {
		fontSize: '0.75rem',
		fontWeight: 600,
		color: '#6F6F6F',
	},
	clearSingleFilterButton: {
		minW: 'auto',
		h: '1.5rem',
		px: '0.4rem',
		fontSize: '0.75rem',
		fontWeight: 600,
		color: '#6F6F6F',
	},
	dropdownNoBorder: {
		width: '100%',
		justifyContent: 'flex-start',
		marginTop: '1.25rem',
		flexWrap: 'wrap',
		gap: '1rem',
	},
	savedFilterContainer: {
		width: '100%',
		justifyContent: 'flex-start',
		paddingBottom: '1.25rem',
	},
	button: {
		fontSize: '0.875rem',
		fontWeight: '700',
		borderRadius: 0,
		...hoverFocusActiveButtonStyles,
	},
	savePresetText: {
		fontSize: '0.875rem',
		fontWeight: '700',
		color: '#929494',
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
	searchInput: {
		height: '2rem',
		fontSize: '0.875rem',
	},
}

type MultiFilterKey = Exclude<keyof ProductFilterValues, 'searchText'>

interface FilterModalProps {
	selectedFiltersCount?: number
	isMobile?: boolean
	showSavedFilterOptions?: boolean
	isInternalUser?: boolean
	showSupplierFilter?: boolean
	filterValues: ProductFilterValues
	onApplyFilters: (filters: ProductFilterValues) => void
	onResetFilters: () => void
	supplierOptions: FilterSelectOption[]
	brandOptions: FilterSelectOption[]
	stateOptions: FilterSelectOption[]
	categoryOptions: FilterSelectOption[]
}

const FilterModal = ({
	selectedFiltersCount = 0,
	isMobile = false,
	showSavedFilterOptions = true,
	isInternalUser = false,
	showSupplierFilter = false,
	filterValues,
	onApplyFilters,
	onResetFilters,
	supplierOptions,
	brandOptions,
	stateOptions,
	categoryOptions,
}: FilterModalProps) => {
	const { t } = useTranslation()
	const {
		isOpen: isFilterModalOpen,
		onOpen,
		onClose: onFilterModalClose,
	} = useDisclosure()
	const [localFilters, setLocalFilters] =
		useState<ProductFilterValues>(filterValues)
	const [openSection, setOpenSection] = useState<MultiFilterKey | null>('brand')
	const [sectionSearch, setSectionSearch] = useState<
		Record<MultiFilterKey, string>
	>({
		supplier: '',
		brand: '',
		state: '',
		category: '',
	})
	const [isSaveCurrentSelection, setIsSaveCurrentSelection] = useState(false)

	useEffect(() => {
		if (isFilterModalOpen) {
			setLocalFilters(filterValues)
		}
	}, [filterValues, isFilterModalOpen])

	const updateLocalFilter = (key: keyof ProductFilterValues, value: string) => {
		setLocalFilters(prev => ({ ...prev, [key]: value }))
	}

	const toggleFilterOption = (key: MultiFilterKey, value: string) => {
		setLocalFilters(prev => {
			const selectedValues = prev[key]
			const nextValues = selectedValues.includes(value)
				? selectedValues.filter(item => item !== value)
				: [...selectedValues, value]

			return {
				...prev,
				[key]: nextValues,
			}
		})
	}

	const clearSingleFilter = (key: MultiFilterKey) => {
		setLocalFilters(prev => ({
			...prev,
			[key]: [],
		}))
	}

	const updateSectionSearch = (key: MultiFilterKey, value: string) => {
		setSectionSearch(prev => ({
			...prev,
			[key]: value,
		}))
	}

	const handleShowResults = () => {
		onApplyFilters(localFilters)
		onFilterModalClose()
	}

	const handleResetAndClose = () => {
		setLocalFilters(EMPTY_FILTERS)
		onResetFilters()
		onFilterModalClose()
	}

	const getFilteredOptions = (
		key: MultiFilterKey,
		options: FilterSelectOption[],
	) => {
		const query = sectionSearch[key].trim().toLowerCase()
		if (!query) {
			return options
		}

		return options.filter(option => {
			return (
				option.label.toLowerCase().includes(query) ||
				option.value.toLowerCase().includes(query)
			)
		})
	}

	const renderMultiSelectSection = (
		key: MultiFilterKey,
		label: string,
		options: FilterSelectOption[],
		renderStateCircle = false,
	) => {
		const isOpen = openSection === key
		const selectedCount = localFilters[key].length
		const filteredOptions = getFilteredOptions(key, options)

		return (
			<Box sx={styles.filterPanel}>
				<HStack
					sx={styles.filterPanelHeader}
					onClick={() => setOpenSection(prev => (prev === key ? null : key))}
				>
					<HStack gap={2}>
						<Text fontWeight={700} fontSize="0.875rem">
							{label}
						</Text>
						{selectedCount > 0 && (
							<Text sx={styles.selectionCount}>{selectedCount} selected</Text>
						)}
					</HStack>
					<HStack>
						<Button
							variant="ghost"
							sx={styles.clearSingleFilterButton}
							onClick={e => {
								e.stopPropagation()
								clearSingleFilter(key)
							}}
							isDisabled={selectedCount === 0}
						>
							Clear
						</Button>
						<IconButton
							aria-label={isOpen ? `close ${label}` : `open ${label}`}
							icon={isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
							variant="ghost"
							size="sm"
							onClick={e => {
								e.stopPropagation()
								setOpenSection(prev => (prev === key ? null : key))
							}}
						/>
					</HStack>
				</HStack>

				{isOpen && (
					<VStack sx={styles.filterPanelBody} align="stretch">
						<Input
							placeholder={`Search ${label.toLowerCase()}`}
							sx={styles.searchInput}
							value={sectionSearch[key]}
							onChange={e => updateSectionSearch(key, e.target.value)}
						/>
						<VStack sx={styles.filterPanelList} align="stretch" spacing={0}>
							{filteredOptions.length === 0 && (
								<Text fontSize="0.8125rem" color="#6F6F6F" px={1} py={2}>
									No results
								</Text>
							)}
							{filteredOptions.map(option => {
								const isChecked = localFilters[key].includes(option.value)
								return (
									<HStack key={option.value} sx={styles.filterPanelItem}>
										<Checkbox
											isChecked={isChecked}
											onChange={() => toggleFilterOption(key, option.value)}
										/>
										{renderStateCircle && (
											<StateCircle
												stateColor={option.stateColor ?? '#808080'}
												stateTitle={option.stateTitle ?? option.label}
												isTooltipEnabled={true}
												customStyles={{
													colorCircle: {
														width: '0.875rem',
														height: '0.875rem',
													},
												}}
											/>
										)}
										<Text fontSize="0.875rem">{option.label}</Text>
									</HStack>
								)
							})}
						</VStack>
					</VStack>
				)}
			</Box>
		)
	}

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
										updateLocalFilter('searchText', e.target.value)
									}
								/>
							</FormControl>
						</Flex>

						<Grid sx={isMobile ? styles.mobileGrid : styles.grid}>
							{showSupplierFilter &&
								renderMultiSelectSection(
									'supplier',
									'Supplier',
									supplierOptions,
								)}

							{renderMultiSelectSection('brand', 'Brand', brandOptions)}

							{renderMultiSelectSection('state', 'State', stateOptions, true)}

							{renderMultiSelectSection(
								'category',
								'Category',
								categoryOptions,
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
							<Button sx={styles.button} onClick={handleResetAndClose}>
								Clear
							</Button>
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
