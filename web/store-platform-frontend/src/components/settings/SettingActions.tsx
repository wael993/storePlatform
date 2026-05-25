import { Flex } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { fullPaths } from '../../shared/routes'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'

const styles: StylesObject = {
	actionsWrapper: {
		width: '100%',
		justifyContent: 'end',
		paddingTop: '1rem',
	},
	button: {
		margin: { base: '0 0 1rem 2rem', md: '1rem' },
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		p: { base: '4', md: '1rem 1.5rem 1rem 1.5rem' },
		whiteSpace: 'nowrap',
		borderRadius: '0',
		...hoverFocusActiveButtonStyles,
	},
}

interface SettingActionsProps {
	isSaveDisabled?: boolean
	isCancelDisabled?: boolean
	isSaveInProgress?: boolean
	onSaveSettings?: () => Promise<void>
}

const SettingActions = ({
	isSaveDisabled,
	isCancelDisabled,
	isSaveInProgress,
	onSaveSettings,
}: SettingActionsProps) => {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const onClose = () => {
		if (window.history.state && window.history.length > 1) {
			navigate(-1)
			return
		}

		navigate(fullPaths.PRODUCTS)
	}

	const handleSave = async () => {
		if (onSaveSettings) {
			try {
				await onSaveSettings()
			} catch (error) {
				console.error('Error saving settings:', error)
			}
		}
	}

	return (
		<Flex sx={styles.actionsWrapper}>
			<Button
				sx={{ ...styles.button, backgroundColor: '#EAEAEA', color: '#2B2B2B' }}
				isDisabled={isCancelDisabled || isSaveInProgress}
				onClick={onClose}
			>
				{t('common.cancel')}
			</Button>
			<Button
				variant="primary"
				sx={{ ...styles.button, backgroundColor: '#376288', color: '#FFFFFF' }}
				onClick={handleSave}
				isLoading={isSaveInProgress}
				isDisabled={isSaveInProgress || isSaveDisabled}
			>
				{t('components.settings.saveSettings')}
			</Button>
		</Flex>
	)
}

export default SettingActions
