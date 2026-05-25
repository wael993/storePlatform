import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FilterSelectOption } from '../FilterModal'
import { Dropdown } from '../../dropdown/Dropdown'
import { Box } from '@chakra-ui/icons'
import { dropdownStyles } from './styles'

export type SupplierDropdownProps = {
	options: FilterSelectOption[]
	selectedValues: string[]
	onChange: (selectedValues: string[]) => void
	isDisabled?: boolean
}

export const SupplierDropdown = memo(
	({
		options,
		selectedValues,
		onChange,
		isDisabled,
	}: SupplierDropdownProps) => {
		const { t } = useTranslation()

		return (
			<Box sx={dropdownStyles.dropDownContainer}>
				<Dropdown
					placeholder={t('components.filters.supplier')}
					dropDownOptions={options}
					selectedValues={selectedValues}
					onSelect={onChange}
					disabled={isDisabled}
				/>
			</Box>
		)
	},
)

SupplierDropdown.displayName = 'SupplierDropdown'
