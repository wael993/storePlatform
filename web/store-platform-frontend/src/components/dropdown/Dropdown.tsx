import {
	Box,
	Button,
	Checkbox,
	Flex,
	HStack,
	Icon,
	IconButton,
	Input,
	Menu,
	MenuButton,
	Portal,
	Spinner,
	SystemStyleObject,
	Text,
	Tooltip,
	useDisclosure,
} from '@chakra-ui/react'
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons'
import { useCallback, useMemo, useState } from 'react'
import StateCircle from '../StateCircle'
import type { FilterSelectOption } from '../filters/FilterModal'
import { AsCloseIcon } from '../icons/Close'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import {
	dropdownSharedStyles,
	dropdownStyleVariables,
} from '../filters/dropdowns/sharedConstants'
import DropdownMenuList from './DropdownMenuList'
import { isTruthy } from '../list/shared/utils'

type DropdownStylesObjectKeys = 'placeholder' | 'menuButton'
type DropdownStylesObject = {
	[key in DropdownStylesObjectKeys]?: SystemStyleObject
}
const DROPDOWN_VIRTUALIZATION_THRESHOLD = 200

interface DropdownProps {
	tooltip?: string
	placeholder: string
	dropDownOptions: FilterSelectOption[]
	selectedValues: string[]
	renderStateCircle?: boolean
	disabled?: boolean
	isDropdownOpenDisabled?: boolean
	customTrigger?: React.ReactNode
	customStyles?: DropdownStylesObject
	showChevron?: boolean
	isLoading?: boolean
	showClearOptions?: boolean
	onSelect: Function
	usePortal?: boolean
	isSingle?: boolean
	initialOptions?: DropdownOption[]
	noOptionsSelection?: DropdownOption
	minimumSelectedOptions?: number
	showClearIconOnOption?: boolean
	isSearchable?: boolean
	allowMultipleEntriesAtOnce?: boolean
}

export const Dropdown = ({
	onSelect,
	tooltip,
	isDropdownOpenDisabled = false,
	customStyles,
	showChevron = true,
	isLoading = false,
	placeholder,
	initialOptions,
	showClearOptions = true,
	showClearIconOnOption = false,

	noOptionsSelection,
	dropDownOptions,
	usePortal = false,
	selectedValues,
	customTrigger,
	isSingle = false,
	minimumSelectedOptions = 0,
	isSearchable = true,
	allowMultipleEntriesAtOnce = false,

	renderStateCircle = false,
	disabled = false,
}: DropdownProps) => {
	// const [isOpen, setIsOpen] = useState(false)
	const [search, setSearch] = useState('')

	const selectedOptions = useMemo(() => {
		const allOptions = [
			...dropDownOptions,
			...(noOptionsSelection ? [noOptionsSelection] : []),
		]
		return selectedValues
			.map(val => allOptions.find(opt => opt.value === val))
			.filter(isTruthy)
	}, [dropDownOptions, noOptionsSelection, selectedValues])

	const { onOpen, isOpen, onClose } = useDisclosure()

	const filteredOptions = useMemo(() => {
		const query = search.trim().toLowerCase()
		if (!query) {
			return dropDownOptions
		}

		return dropDownOptions.filter(option => {
			return (
				option.label.toLowerCase().includes(query) ||
				option.value.toLowerCase().includes(query)
			)
		})
	}, [dropDownOptions, search])

	const options = useMemo(() => {
		const selectedOptions = filteredOptions.filter(option =>
			selectedValues.includes(option.value),
		)
		const nonSelectedOptions = filteredOptions.filter(
			option => !selectedValues.includes(option.value),
		)

		return [...selectedOptions, ...nonSelectedOptions]
	}, [filteredOptions, selectedValues])

	const onClearOptions = () => {
		onSelect([])
		onClose()
	}
	const virtualizationEnabled =
		options.length >= DROPDOWN_VIRTUALIZATION_THRESHOLD

	const handleMultipleSelectionChange = useCallback(
		(options: DropdownOption[]) => {
			const currentValues = new Set(selectedValues)
			const processedValues = new Set<string>()
			const valuesToAdd: string[] = []

			options.forEach(option => {
				if (!option?.value) return
				if (currentValues.has(option.value)) return
				if (processedValues.has(option.value)) return

				valuesToAdd.push(option.value)
				processedValues.add(option.value)
			})

			if (valuesToAdd.length === 0) return

			onSelect([...selectedValues, ...valuesToAdd])
		},
		[onSelect, selectedValues],
	)

	const styles = {
		menuButton: {
			width: customTrigger ? 'fit-content' : '100%',
			height: customTrigger ? 'fit-content' : 'inherit',
			bg: 'transparent',
			color: '#929494',
			lineHeight: '1.2rem',
			paddingRight: customTrigger ? '0' : '0.5rem',
			paddingLeft: customTrigger ? '0' : '0.75rem',
			...hoverFocusActiveButtonStyles,
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
		selectedOptionsWrapper: {
			fontSize: { base: 'var(--ghui-sizes-4)', lg: 'var(--ghui-sizes-3\\.5)' },
			fontWeight: 700,
			justifyContent: 'space-between',
			alignItems: 'center',
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
		searchInput: {
			height: '2rem',
			fontSize: '0.875rem',
		},
		clearIcon: {
			color: '#929494',
			cursor: 'pointer',
			_hover: { backgroundColor: '#F4F4F4' },
			borderRadius: '0.25rem',
		},
		options: {
			fontSize: { base: 'var(--ghui-sizes-4)', lg: 'var(--ghui-sizes-3\\.5)' },
			fontWeight: 700,
		},
		selectedOption: {
			...dropdownSharedStyles,
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			whiteSpace: 'nowrap',
			maxWidth: '5rem',
			paddingX: '0.3rem',
		},
		selectedCount: {
			...dropdownSharedStyles,
			paddingX: '0.2rem',
		},
		singleSelectableOption: {
			fontSize: dropdownStyleVariables.fontSize,
			fontWeight: dropdownStyleVariables.fontWeight,
			color: '#1E1E1E',
			maxWidth: '5rem',
			paddingX: '0.3rem',
			backgroundColor: 'transparent',
		},
	} satisfies StylesObject

	const displaySelected = () => {
		if (selectedOptions.length === 0)
			return (
				<Text sx={{ ...styles.options, ...(customStyles?.placeholder ?? {}) }}>
					{placeholder}
				</Text>
			)

		const firstItem = selectedOptions[0].label || ''
		const remainingCount = selectedOptions.length - 1

		if (remainingCount > 0) {
			return (
				<HStack spacing="1">
					<Text sx={styles.selectedOption}>{firstItem}</Text>
					<Text sx={styles.selectedCount}>+{remainingCount}</Text>
				</HStack>
			)
		}

		return (
			<Text
				sx={isSingle ? styles.singleSelectableOption : styles.selectedOption}
			>
				{firstItem}
			</Text>
		)
	}

	const handleSelectionChange = useCallback(
		(value: string, isCleared?: boolean) => {
			const optionAlreadySelected = selectedValues.includes(value)

			if (isSingle && optionAlreadySelected) {
				return
			}

			const updatedValues = isSingle
				? [value]
				: optionAlreadySelected
					? selectedValues.filter(v => v !== value)
					: [...selectedValues, value]

			if (updatedValues.length < minimumSelectedOptions) {
				return
			}

			onSelect(updatedValues)

			if (isSingle) {
				onClose()
			}
		},
		[isSingle, onClose, selectedValues, onSelect, minimumSelectedOptions],
	)

	const renderDropdownList = (
		<DropdownMenuList
			options={options}
			handleSelectionChange={handleSelectionChange}
			showClearIconOnOption={showClearIconOnOption}
			isSingle={isSingle}
			selectedOptions={selectedOptions}
			styles={styles}
			isOpen={isOpen}
			isVirtualized={virtualizationEnabled}
			isSearchable={isSearchable}
			noOptionsSelection={noOptionsSelection}
			allowMultipleEntriesAtOnce={allowMultipleEntriesAtOnce}
			handleMultipleSelectionChange={handleMultipleSelectionChange}
		/>
	)

	return (
		<Menu
			isOpen={isOpen}
			autoSelect={false}
			onClose={() => {
				onClose()
				// onPopoverClose?.()
			}}
			offset={[0, 10]}
			matchWidth={true}
			isLazy={true}
			// Let menu stay open on item selection for multi-select scenarios
			closeOnSelect={false}
		>
			<Tooltip label={tooltip} isDisabled={!tooltip} placement="bottom">
				<MenuButton
					onClick={e => {
						if (isDropdownOpenDisabled) return
						e.stopPropagation()
						onOpen()
					}}
					as={Button}
					isDisabled={disabled}
					sx={{
						...styles.menuButton,
						'& > span': {
							pointerEvents: 'auto',
						},
						...customStyles?.menuButton,
					}}
					rightIcon={showChevron ? <Icon as={ChevronDownIcon} /> : undefined}
				>
					{customTrigger ? (
						customTrigger
					) : (
						<Flex sx={styles.selectedOptionsWrapper}>
							{isLoading ? (
								<Spinner />
							) : (
								<>
									{displaySelected()}
									{selectedOptions.length > 0 && showClearOptions && (
										<Icon
											onClick={e => {
												e.stopPropagation()
												e.preventDefault()
												onClearOptions()
											}}
											boxSize={4}
											as={AsCloseIcon}
											sx={styles.clearIcon}
										/>
									)}
								</>
							)}
						</Flex>
					)}
				</MenuButton>
			</Tooltip>
			{usePortal ? <Portal>{renderDropdownList}</Portal> : renderDropdownList}
		</Menu>
	)
}
