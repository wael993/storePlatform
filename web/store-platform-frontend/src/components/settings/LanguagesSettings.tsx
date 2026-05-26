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
	displayLanguage: 'en' | 'de' | 'ar'
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
						<Radio value="en">{t('components.settingsTabs.english')}</Radio>
						<Radio value="de">{t('components.settingsTabs.german')}</Radio>
						<Radio value="ar">{t('components.settingsTabs.arabic')}</Radio>
					</Stack>
				</RadioGroup>
			</FormControl>
		</VStack>
	)
}

export default LanguagesSettings
