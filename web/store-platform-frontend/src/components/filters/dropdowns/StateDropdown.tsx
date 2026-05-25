import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FilterSelectOption } from '../FilterModal'
import { Box } from '@chakra-ui/icons'
import { Dropdown } from '../../dropdown/Dropdown'
import { dropdownStyles } from './styles'

export type StateDropdownProps = {
	options: FilterSelectOption[]
	selectedValues: string[]
	onChange: (selectedValues: string[]) => void
	isDisabled?: boolean
}

export const StateDropdown = memo(
	({ options, selectedValues, onChange, isDisabled }: StateDropdownProps) => {
		const { t } = useTranslation()

		return (
			<Box sx={dropdownStyles.dropDownContainer}>
				<Dropdown
					placeholder={t('components.filters.state')}
					dropDownOptions={options}
					selectedValues={selectedValues}
					onSelect={onChange}
					disabled={isDisabled}
				/>
			</Box>
		)
	},
)

StateDropdown.displayName = 'StateDropdown'
