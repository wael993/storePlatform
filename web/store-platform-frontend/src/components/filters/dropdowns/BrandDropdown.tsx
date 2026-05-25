import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FilterSelectOption } from '../FilterModal'
import { Dropdown } from '../../dropdown/Dropdown'
import { Box } from '@chakra-ui/react'
import { dropdownStyles } from './styles'

export type BrandDropdownProps = {
	options: FilterSelectOption[]
	selectedValues: string[]
	onChange: (selectedValues: string[]) => void
}

export const BrandDropdown = memo(
	({ options, selectedValues, onChange }: BrandDropdownProps) => {
		const { t } = useTranslation()

		return (
			<Box sx={dropdownStyles.dropDownContainer}>
				<Dropdown
					placeholder={t('components.filters.brand')}
					dropDownOptions={options}
					selectedValues={selectedValues}
					onSelect={onChange}
				/>
			</Box>
		)
	},
)

BrandDropdown.displayName = 'BrandDropdown'
