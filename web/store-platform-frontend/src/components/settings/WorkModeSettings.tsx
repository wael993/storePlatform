import {
	Alert,
	AlertDescription,
	AlertIcon,
	FormControl,
	FormLabel,
	Radio,
	RadioGroup,
	Spinner,
	Stack,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

import { useWorkMode } from '../../shared/hooks/useWorkMode'

const WorkModeSettings = () => {
	const { t } = useTranslation()
	const {
		workModePreference,
		offlineEnabled,
		isSwitching,
		switchError,
		syncState,
		switchWorkModePreference,
	} = useWorkMode()

	if (!offlineEnabled) {
		return (
			<Text color="gray.600" fontSize="sm">
				{t('components.workModeSettings.notAvailable')}
			</Text>
		)
	}

	const handleWorkModeChange = async (value: string) => {
		const nextPreference =
			value === 'offline' ? 'offline' : value === 'auto' ? 'auto' : 'online'
		try {
			await switchWorkModePreference(nextPreference)
		} catch {
			// Error shown via switchError
		}
	}

	const statusMessage =
		syncState === 'bootstrapping'
			? t('offline.downloadingData')
			: syncState === 'syncing'
				? t('offline.pushInProgress')
				: null

	return (
		<VStack align="stretch" spacing={4} width="100%">
			<FormControl>
				<FormLabel fontWeight={600} mb={4}>
					{t('components.workModeSettings.title')}
				</FormLabel>
				<Text fontSize="sm" color="gray.600" mb={4}>
					{t('components.workModeSettings.description')}
				</Text>
				<RadioGroup
					value={workModePreference}
					onChange={handleWorkModeChange}
					isDisabled={isSwitching}
				>
					<Stack spacing={3}>
						<Radio value="online">
							{t('components.workModeSettings.online')}
						</Radio>
						<Radio value="offline">
							{t('components.workModeSettings.offline')}
						</Radio>
						<Radio value="auto">{t('components.workModeSettings.auto')}</Radio>
					</Stack>
				</RadioGroup>
			</FormControl>

			{isSwitching && (
				<Stack direction="row" align="center" spacing={2}>
					<Spinner size="sm" />
					<Text fontSize="sm" color="gray.600">
						{statusMessage ?? t('components.workModeSettings.switching')}
					</Text>
				</Stack>
			)}

			{switchError && (
				<Alert status="error" borderRadius="md" variant="left-accent">
					<AlertIcon />
					<AlertDescription fontSize="sm">{switchError}</AlertDescription>
				</Alert>
			)}
		</VStack>
	)
}

export default WorkModeSettings
