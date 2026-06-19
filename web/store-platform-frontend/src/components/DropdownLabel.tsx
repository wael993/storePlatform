import { SystemStyleObject, VStack, Text } from '@chakra-ui/react'
import { Dropdown } from './dropdown/Dropdown'

type DropdownStylesKeys =
	| 'labelText'
	| 'dropdownContainer'
	| 'dropdownMenu'
	| 'dropdownPlaceholder'
type DropdownStylesObject = {
	[key in DropdownStylesKeys]?: SystemStyleObject
}
interface DropdownLabelProps {
	label: string
	placeholder?: string
	options: DropdownOption[]
	selectedOptions: DropdownOption[]
	onSelect: (value: string[]) => void
	isSingle?: boolean
	isDisabled?: boolean
	isSearchable?: boolean
	disabledTooltip?: string
	isLoading?: boolean
	noOptionsSelection?: DropdownOption
	customStyles?: DropdownStylesObject
}

const DropdownLabel = ({
	label,
	placeholder = '',
	options,
	selectedOptions,
	onSelect,
	isSingle = false,
	isDisabled = false,
	isSearchable = false,
	disabledTooltip,
	isLoading = false,
	noOptionsSelection,
	customStyles,
}: DropdownLabelProps) => {
	const dropdownStyles = {
		dropdownContainer: {
			alignItems: 'flex-start',
			gap: '0.5rem',
			width: '100%',
			...customStyles?.dropdownContainer,
		},
		dropdownMenu: {
			backgroundColor: '#F4F4F4',
			padding: '0.5rem',
			border: '1px solid #EAEAEA',
			...customStyles?.dropdownMenu,
		},
		labelText: {
			fontWeight: 700,
			fontSize: '0.75rem',
			color: '#929494',
			...customStyles?.labelText,
		},
		dropdownPlaceholder: {
			fontSize: '0.875rem',
			fontWeight: 500,
			color: '#929494',
			...customStyles?.dropdownPlaceholder,
		},
	}

	return (
		<VStack sx={dropdownStyles.dropdownContainer}>
			<Text sx={dropdownStyles.labelText}>{label}</Text>
			<Dropdown
				dropDownOptions={options}
				onSelect={onSelect}
				isSingle={isSingle}
				isSearchable={isSearchable}
				selectedValues={selectedOptions.map(option => option.value)}
				showClearOptions={false}
				disabled={isDisabled}
				customStyles={{
					menuButton: dropdownStyles.dropdownMenu,
					placeholder: dropdownStyles.dropdownPlaceholder,
				}}
				placeholder={placeholder}
				tooltip={isDisabled ? disabledTooltip : undefined}
				isLoading={isLoading}
				noOptionsSelection={noOptionsSelection}
			/>
		</VStack>
	)
}

export default DropdownLabel
