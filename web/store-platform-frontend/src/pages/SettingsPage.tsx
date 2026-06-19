import { useState } from 'react'
import {
	Flex,
	Heading,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	Icon,
	Text,
	Divider,
} from '@chakra-ui/react'
import { useSettings } from '../shared/context/SettingsContext'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { BreadCrumbItem } from '../shared/globalEnums'
import { fullPaths, generateBreadcrumbs } from '../shared/routes'
import i18n from '../i18n'
import { useTranslation } from 'react-i18next'
import { AsCloseIcon } from '../components/icons/Close'
import { useNavigate } from 'react-router-dom'
import ProductsSettings from '../components/settings/ProductsSettings'
import LanguagesSettings from '../components/settings/LanguagesSettings'
import SettingActions from '../components/settings/SettingActions'
import useCustomToast from '../components/common/CustomToast'
import { useUpdateUserSettingsMutation } from '../api/apiStore'

enum StepKeys {
	product = 0,
	Language = 1,
	SpaceAndLocation = 2,
}

const styles = {
	wrapper: {
		flexDir: 'column',
	},
	topbarWrapper: {
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	topbarContainer: {
		flexDir: 'column',
	},
	titleHeader: {
		color: '#333333',
		fontSize: '1.25rem',
		fontWeight: '700',
		pt: '0.4rem',
		pb: '1.5rem',
	},
	divider: {
		borderBottom: '2px solid #ECECEC',
		marginRight: '0.5rem',
		width: '100%',
		mb: '1.5rem',
	},
	icon: {
		fontSize: '1.5rem',
		color: '6F6F6F',
	},
	closeButtonWrapper: {
		cursor: 'pointer',
		alignItems: 'center',
	},
	tabs: { width: '100%' },
	tabList: { width: '100%', borderBottom: '2px solid #DADADA' },
	tab: {
		paddingTop: '0.3rem',
		paddingBottom: '0',
		justifyContent: 'left',
		mb: '-2px',
	},
	subHeaderDescription: {
		fontWeight: 700,
		color: '#939596',
		fontSize: '0.875rem',
	},
	contentWrapper: {
		paddingX: '2rem',
		paddingY: '2rem',
		width: '100%',
	},
} satisfies StylesObject

const SettingsPage = () => {
	const {
		productsPerPage,
		setProductsPerPage,
		displayLanguage,
		setDisplayLanguage,
		hasChanges,
		setHasChanges,
	} = useSettings()
	const [currentTabIndex, setCurrentTabIndex] = useState<number>(0)
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const navigate = useNavigate()
	const showToastMessage = useCustomToast()
	const [updateUserSettings, { isLoading: isSaveInProgress }] =
		useUpdateUserSettingsMutation()

	const handleProductsPerPageChange = (value: string) => {
		const numValue = value === 'all' ? 1000 : parseInt(value, 10)
		setProductsPerPage(numValue)
	}

	const handleLanguageChange = (value: string) => {
		const selectedLanguage = value === 'de' || value === 'ar' ? value : 'en'
		setDisplayLanguage(selectedLanguage)
	}

	const handleTabsChange = (index: number) => {
		setCurrentTabIndex(index)
	}

	const onClose = () => {
		if (window.history.state && window.history.length > 1) {
			navigate(-1)
			return
		}

		navigate(fullPaths.PRODUCTS)
	}

	const onSaveSettings = async () => {
		try {
			await updateUserSettings({
				productsPerPage,
				displayLanguage,
			}).unwrap()

			void i18n.changeLanguage(displayLanguage)

			setHasChanges(false)
			showToastMessage({
				status: 'success',
				description: t('settings.updateSuccessMessage'),
			})
		} catch (error) {
			const err = error as { data?: { message?: string } }
			showToastMessage({
				status: 'error',
				description:
					err?.data?.message ||
					t('settings.updateFailedMessage') ||
					'Error saving settings',
			})
		}
	}

	const getTabTextStyle = (tabIndex: number) => {
		return {
			...styles.subHeaderDescription,
			color: `${currentTabIndex === tabIndex ? '#376288' : '#939596'}`,
		}
	}

	const getTabStyle = (tabIndex: number) => {
		return {
			...styles.tab,
			borderBottom: `2px solid ${
				currentTabIndex === tabIndex ? '#376288' : '#DADADA'
			}`,
		}
	}

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.topbarWrapper}>
				<Flex sx={styles.topbarContainer}>
					<CustomBreadcrumb
						marginTop="2rem"
						items={breadCrumbItems[BreadCrumbItem.SETTINGS]}
					/>
					<Heading sx={styles.titleHeader}>
						{t('components.settings.title')}
					</Heading>
				</Flex>
				<Flex sx={styles.closeButtonWrapper}>
					<Icon sx={styles.icon} as={AsCloseIcon} onClick={onClose} />
				</Flex>
			</Flex>

			<Tabs
				index={currentTabIndex}
				onChange={handleTabsChange}
				variant="unstyled"
				sx={styles.tabs}
			>
				<TabList sx={styles.tabList}>
					<Tab sx={getTabStyle(StepKeys.product)}>
						<Text sx={getTabTextStyle(StepKeys.product)}>
							{t('components.settingsTabs.product')}
						</Text>
					</Tab>
					<Tab sx={getTabStyle(StepKeys.Language)}>
						<Text sx={getTabTextStyle(StepKeys.Language)}>
							{t('components.settingsTabs.language')}
						</Text>
					</Tab>
				</TabList>
				<Divider sx={styles.divider} />

				<TabPanels>
					<TabPanel sx={styles.contentWrapper}>
						<ProductsSettings
							productsPerPage={productsPerPage}
							handleProductsPerPageChange={handleProductsPerPageChange}
						/>
					</TabPanel>

					<TabPanel sx={styles.contentWrapper}>
						<LanguagesSettings
							displayLanguage={displayLanguage}
							handleLanguageChange={handleLanguageChange}
						/>
					</TabPanel>
				</TabPanels>
			</Tabs>

			<SettingActions
				isSaveDisabled={!hasChanges}
				isSaveInProgress={isSaveInProgress}
				onSaveSettings={onSaveSettings}
			/>
		</Flex>
	)
}

export default SettingsPage
