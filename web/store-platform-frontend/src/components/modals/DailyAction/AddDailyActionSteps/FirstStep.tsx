import React from 'react'
import DropdownLabel from '../../../DropdownLabel'
import { useTranslation } from 'react-i18next'

interface FirstStepProps {
	actionEntryTypesOptions: DropdownOption[]
	entryType: DropdownOption[]
	setEntryType: (values: DropdownOption[]) => void
}

const FirstStep = ({
	actionEntryTypesOptions,
	entryType,
	setEntryType,
}: FirstStepProps) => {
	const { t } = useTranslation()
	return (
		<DropdownLabel
			isSearchable={true}
			isSingle={true}
			label={t('components.daily.selectEntryType')}
			placeholder={t('components.daily.selectEntryType')}
			options={actionEntryTypesOptions}
			selectedOptions={entryType ? entryType : ([] as DropdownOption[])}
			onSelect={(values: string[]) => {
				const selectedOptions = actionEntryTypesOptions.filter(option =>
					values.includes(option.value),
				)

				setEntryType(selectedOptions)
			}}
		/>
	)
}

export default FirstStep
