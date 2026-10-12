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
	ModalCloseButton,
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
import { datePickerStyles } from '../../theme/styles'
import { AsFilterIcon } from '../icons/Filter'
import DatePickerLabel from '../common/DatePickerLabel'
import { Dropdown } from '../dropdown/Dropdown'
import { compareLanguage } from '../../shared/utils'

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
	invoiceDateFrom?: string
	invoiceDateTo?: string
}

export type FilterFieldVisibility = {
	supplier?: boolean
	brand?: boolean
	state?: boolean
	category?: boolean
	entryType?: boolean
	productName?: boolean
	invoiceDate?: boolean
}

const styles = {
	dropdown: {
		minW: '0',
		position: 'relative',
		zIndex: 12,
		border: 'solid 1px #EAEAEA',
		paddingY: '0.5rem',
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

const getDateInputValueFromDate = (date: Date) => {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')

	return `${year}-${month}-${day}`
}

const getDateFromInputValue = (dateInputValue?: string) => {
	if (!dateInputValue) return undefined
	const [year, month, day] = dateInputValue.split('-').map(Number)

	if (!year || !month || !day) return undefined

	return new Date(year, month - 1, day)
}

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
	fieldVisibility?: FilterFieldVisibility
	searchPlaceholder?: string
}

const FilterModal = ({
	selectedFiltersCount = 0,
	isMobile = false,
	showSavedFilterOptions = true,
	showSupplierFilter = false,
	filterValues,
	onApplyFilters,
	supplierOptions,
	brandOptions,
	stateOptions,
	categoryOptions,
	entryTypeOptions = [],
	productNameOptions = [],
	fieldVisibility,
	searchPlaceholder,
}: FilterModalProps) => {
	const { t, i18n } = useTranslation()

	const {
		isOpen: isFilterModalOpen,
		onOpen,
		onClose: onFilterModalClose,
	} = useDisclosure()
	const { isArabic } = compareLanguage(i18n.language)
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
				size={{ base: 'full', md: '3xl', xl: '4xl' }}
				isCentered={!isMobile}
				blockScrollOnMount
				trapFocus={false}
				allowPinchZoom
				preserveScrollBarGap={false}
			>
				<ModalOverlay bg="blackAlpha.500" backdropFilter="blur(3px)" />

				<ModalContent
					h={{ base: '100dvh', md: 'auto' }}
					maxH={{ base: '100dvh', md: '90vh' }}
					w={{ base: '100%', md: 'calc(100% - 2rem)', xl: '72rem' }}
					m={{ base: 0, md: 4 }}
					borderRadius={0}
					boxShadow="2xl"
				>
					{/* Header */}
					<ModalHeader
						px={{ base: 4, md: 6 }}
						py={{ base: 4, md: 5 }}
						borderBottom="1px solid"
						borderColor="gray.100"
						fontSize={{ base: 'md', md: 'lg' }}
						fontWeight={700}
						color="gray.800"
					>
						<HStack spacing={3}>
							<Box
								display="flex"
								alignItems="center"
								justifyContent="center"
								w={{ base: 8, md: 9 }}
								h={{ base: 8, md: 9 }}
								borderRadius="md"
								bg="gray.100"
								color="gray.600"
								flexShrink={0}
							>
								<AsFilterIcon />
							</Box>

							<Text>{t('components.filters.filter')}</Text>
						</HStack>
					</ModalHeader>

					<ModalCloseButton
						sx={{
							left: isArabic ? '0.4rem' : 'auto',
							right: isArabic ? 'auto' : '0.4rem',
							marginTop: '0.4rem',
						}}
					/>

					<Divider />

					{/* Body */}
					<ModalBody px={{ base: 4, md: 6 }} py={{ base: 4, md: 6 }}>
						<Flex direction="column" gap={{ base: 5, md: 6 }}>
							{/* Search */}
							<Box>
								<FormControl>
									<FormLabel
										mb={2}
										fontSize="sm"
										fontWeight={600}
										color="gray.700"
									>
										{t('components.filters.search')}
									</FormLabel>

									<Input
										h={'2.5rem'}
										borderRadius="md"
										placeholder={
											searchPlaceholder ??
											t('components.filters.searchPlaceholder')
										}
										value={localFilters.searchText}
										onChange={e =>
											setLocalFilters(prev => ({
												...prev,
												searchText: e.target.value,
											}))
										}
										_focus={{
											borderColor: '#005D81',
											boxShadow: '0 0 0 1px #005D81',
										}}
									/>
								</FormControl>
							</Box>

							{/* Filters */}
							<Grid
								templateColumns={{
									base: '1fr',
									sm: 'repeat(2, minmax(0, 1fr))',
									lg: 'repeat(2, minmax(0, 1fr))',
									'2xl': 'repeat(3, minmax(0, 1fr))',
								}}
								gap={{ base: 4, md: 5 }}
								alignItems="start"
								position="relative"
							>
								{isFieldVisible('entryType', false) && (
									<Box sx={styles.dropdown}>
										<Dropdown
											placeholder={t('common.entryType')}
											dropDownOptions={entryTypeOptions}
											selectedValues={localFilters.entryType ?? []}
											onSelect={(entryType: string[]) =>
												setLocalFilters(prev => ({
													...prev,
													entryType,
												}))
											}
										/>
									</Box>
								)}

								{isFieldVisible('productName', false) && (
									<Box sx={styles.dropdown}>
										<Dropdown
											placeholder={t('common.productName')}
											dropDownOptions={productNameOptions}
											selectedValues={localFilters.productName ?? []}
											onSelect={(productName: string[]) =>
												setLocalFilters(prev => ({
													...prev,
													productName,
												}))
											}
										/>
									</Box>
								)}

								{showSupplierFilter && isFieldVisible('supplier') && (
									<Box sx={styles.dropdown}>
										<Dropdown
											placeholder={t('common.supplier')}
											dropDownOptions={supplierOptions}
											selectedValues={localFilters.supplier}
											onSelect={(supplier: string[]) =>
												setLocalFilters(prev => ({
													...prev,
													supplier,
												}))
											}
										/>
									</Box>
								)}

								{/* TODO: this is not invoice date this has to be expiration date before the selected date*/}
								{isFieldVisible('invoiceDate', false) && (
									<Box sx={styles.dropdown}>
										<DatePickerLabel
											label={t('common.to')}
											onChange={(date: Date | undefined) =>
												setLocalFilters(prev => ({
													...prev,
													invoiceDateTo: date
														? getDateInputValueFromDate(date)
														: '',
												}))
											}
											defaultDate={getDateFromInputValue(
												localFilters.invoiceDateTo,
											)}
											minDate={getDateFromInputValue(
												localFilters.invoiceDateFrom,
											)}
											allowClear
											placeholder={t('common.datePlaceholder')}
											styles={datePickerStyles}
											usePortal
										/>
									</Box>
								)}

								{isFieldVisible('brand') && (
									<Box sx={styles.dropdown}>
										<Dropdown
											placeholder={t('common.brand')}
											dropDownOptions={brandOptions}
											selectedValues={localFilters.brand}
											onSelect={(brand: string[]) =>
												setLocalFilters(prev => ({
													...prev,
													brand,
												}))
											}
										/>
									</Box>
								)}

								{isFieldVisible('category') && (
									<Box sx={styles.dropdown}>
										<Dropdown
											placeholder={t('common.category')}
											dropDownOptions={categoryOptions}
											selectedValues={localFilters.category}
											onSelect={(category: string[]) =>
												setLocalFilters(prev => ({
													...prev,
													category,
												}))
											}
										/>
									</Box>
								)}

								{isFieldVisible('state', false) && (
									<Box sx={styles.dropdown}>
										<Box
											border="solid 1px #EAEAEA"
											paddingY={'0.5rem'}
											borderRadius={'0.5rem'}
										>
											<Dropdown
												placeholder={t('common.state')}
												dropDownOptions={stateOptions}
												selectedValues={localFilters.state}
												onSelect={(state: string[]) =>
													setLocalFilters(prev => ({
														...prev,
														state,
													}))
												}
											/>
										</Box>
									</Box>
								)}
							</Grid>
						</Flex>
					</ModalBody>

					{/* Footer */}
					<ModalFooter
						px={{ base: 4, md: 6 }}
						py={{ base: 3, md: 4 }}
						bg="gray.50"
						borderTop="1px solid"
						borderColor="gray.100"
						justifyContent="space-between"
						alignItems={{ base: 'stretch', sm: 'center' }}
						flexDirection={{ base: 'column', sm: 'row' }}
						gap={4}
					>
						{/* Save preset */}
						{showSavedFilterOptions && (
							<HStack
								spacing={2}
								w={{ base: 'full', sm: 'auto' }}
								alignItems="center"
							>
								<Checkbox
									isChecked={isSaveCurrentSelection}
									onChange={() =>
										setIsSaveCurrentSelection(!isSaveCurrentSelection)
									}
								/>

								<Text
									sx={styles.savePresetText}
									fontSize="sm"
									color="gray.600"
									fontWeight={500}
								>
									{t('components.filters.saveFilterPreset')}
								</Text>
							</HStack>
						)}

						{/* Actions */}
						<HStack
							w={{ base: 'full', sm: 'auto' }}
							spacing={3}
							flexDirection={{ base: 'column-reverse', sm: 'row' }}
						>
							<Button
								sx={styles.button}
								w={{ base: 'full', sm: 'auto' }}
								minW={{ sm: '100px' }}
								onClick={onFilterModalClose}
							>
								{t('common.cancel')}
							</Button>

							<Button
								sx={{
									...styles.button,
									color: '#FFFFFF',
									backgroundColor: '#005D81',
								}}
								variant="primary"
								w={{ base: 'full', sm: 'auto' }}
								minW={{ sm: '130px' }}
								onClick={handleShowResults}
								_hover={{
									backgroundColor: '#004C69',
								}}
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
