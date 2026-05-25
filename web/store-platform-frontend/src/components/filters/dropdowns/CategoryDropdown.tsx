import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FilterSelectOption } from '../FilterModal'
import { Box } from '@chakra-ui/icons'
import { Dropdown } from '../../dropdown/Dropdown'
import { dropdownStyles } from './styles'

export type CategoryDropdownProps = {
	options: FilterSelectOption[]
	selectedValues: string[]
	onChange: (selectedValues: string[]) => void
	isDisabled?: boolean
}

export const CategoryDropdown = memo(
	({
		options,
		selectedValues,
		onChange,
		isDisabled,
	}: CategoryDropdownProps) => {
		const { t } = useTranslation()

		return (
			<Box sx={dropdownStyles.dropDownContainer}>
				<Dropdown
					placeholder={t('components.filters.category')}
					dropDownOptions={options}
					selectedValues={selectedValues}
					onSelect={onChange}
					disabled={isDisabled}
				/>
			</Box>
		)
	},
)

CategoryDropdown.displayName = 'CategoryDropdown'
