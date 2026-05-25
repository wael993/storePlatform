import React from 'react'
import { useTranslation } from 'react-i18next'
import {
	FormControl,
	FormLabel,
	Radio,
	RadioGroup,
	Stack,
	VStack,
} from '@chakra-ui/react'

interface LanguagesSettingsProps {
	displayLanguage: 'en' | 'de'
	handleLanguageChange?: (value: string) => void
}

const LanguagesSettings = ({
	displayLanguage,
	handleLanguageChange,
}: LanguagesSettingsProps) => {
	const { t } = useTranslation()

	return (
		<VStack align="stretch" spacing={6} width="100%">
			<FormControl>
				<FormLabel fontWeight={600} mb={4}>
					{t('components.settingsTabs.displayLanguage')}
				</FormLabel>
				<RadioGroup value={displayLanguage} onChange={handleLanguageChange}>
					<Stack spacing={3}>
						<Radio value="en">English</Radio>
						<Radio value="de">German (Deutsch)</Radio>
					</Stack>
				</RadioGroup>
			</FormControl>
		</VStack>
	)
}

export default LanguagesSettings
