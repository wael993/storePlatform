import { useEffect, useState } from 'react'
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
import WorkModeSettings from '../components/settings/WorkModeSettings'
import CurrenciesSettings from '../components/settings/CurrenciesSettings'
import InvoiceSettings from '../components/settings/InvoiceSettings'
import SettingActions from '../components/settings/SettingActions'
import useCustomToast from '../components/common/CustomToast'
import {
	CurrencySettingItem,
	useGetCurrencySettingsQuery,
	useUpdateCurrencySettingsMutation,
	useGetInvoiceSettingsQuery,
	useUpdateInvoiceSettingsMutation,
	useUpdateUserSettingsMutation,
} from '../api/apiStore'
import { generateId } from '../offline/utils'

enum StepKeys {
	product = 0,
	Language = 1,
	Currencies = 2,
	WorkMode = 3,
	Invoice = 4,
}

const createEmptyPrimary = (): CurrencySettingItem => ({
	currencyId: generateId(),
	name: '',
	internalCode: '',
})

const createEmptySecondary = (): CurrencySettingItem => ({
	currencyId: generateId(),
	name: '',
	internalCode: '',
	exchangeRate: undefined,
})

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
		defaultInvoiceCurrencyId,
		setDefaultInvoiceCurrencyId,
		hasChanges,
		setHasChanges,
	} = useSettings()
	const { data: currencySettingsData } = useGetCurrencySettingsQuery(
		undefined,
		{ refetchOnMountOrArgChange: false },
	)
	const { data: invoiceSettingsData } = useGetInvoiceSettingsQuery(undefined, {
		refetchOnMountOrArgChange: false,
	})
	const [currentTabIndex, setCurrentTabIndex] = useState<number>(0)
	const [primaryCurrency, setPrimaryCurrency] =
		useState<CurrencySettingItem | null>(createEmptyPrimary())
	const [secondaryCurrencies, setSecondaryCurrencies] = useState<
		CurrencySettingItem[]
	>([])
	const [hasCurrencyChanges, setHasCurrencyChanges] = useState(false)
	const [noMergeInvoiceLines, setNoMergeInvoiceLines] = useState(false)
	const [hasInvoiceChanges, setHasInvoiceChanges] = useState(false)
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const navigate = useNavigate()
	const showToastMessage = useCustomToast()
	const [updateUserSettings, { isLoading: isUserSettingsSaveInProgress }] =
		useUpdateUserSettingsMutation()
	const [updateCurrencySettings, { isLoading: isCurrencySaveInProgress }] =
		useUpdateCurrencySettingsMutation()
	const [updateInvoiceSettings, { isLoading: isInvoiceSaveInProgress }] =
		useUpdateInvoiceSettingsMutation()

	useEffect(() => {
		if (!currencySettingsData) {
			return
		}

		setPrimaryCurrency(
			currencySettingsData.primaryCurrency ?? createEmptyPrimary(),
		)
		setSecondaryCurrencies(currencySettingsData.secondaryCurrencies ?? [])
		setHasCurrencyChanges(false)
	}, [currencySettingsData])

	useEffect(() => {
		if (!invoiceSettingsData) {
			return
		}

		setNoMergeInvoiceLines(invoiceSettingsData.noMergeInvoiceLines ?? false)
		setHasInvoiceChanges(false)
	}, [invoiceSettingsData])

	const handleProductsPerPageChange = (value: string) => {
		const numValue = value === 'all' ? 1000 : parseInt(value, 10)
		setProductsPerPage(numValue)
	}

	const handleLanguageChange = (value: string) => {
		const selectedLanguage = value === 'de' || value === 'ar' ? value : 'en'
		setDisplayLanguage(selectedLanguage)
	}

	const handlePrimaryChange = (
		field: 'name' | 'internalCode',
		value: string,
	) => {
		setPrimaryCurrency(current => ({
			...(current ?? createEmptyPrimary()),
			[field]: value,
		}))
		setHasCurrencyChanges(true)
	}

	const handleSecondaryChange = (
		index: number,
		field:
			| 'name'
			| 'internalCode'
			| 'exchangeRate'
			| 'exchangeRateUnitCurrencyId',
		value: string,
	) => {
		setSecondaryCurrencies(current =>
			current.map((item, itemIndex) => {
				if (itemIndex !== index) {
					return item
				}

				if (field === 'exchangeRate') {
					return {
						...item,
						exchangeRate: value === '' ? undefined : Number(value),
					}
				}

				if (field === 'exchangeRateUnitCurrencyId') {
					return {
						...item,
						exchangeRateUnitCurrencyId: value || undefined,
					}
				}

				return { ...item, [field]: value }
			}),
		)
		setHasCurrencyChanges(true)
	}

	const handleAddSecondary = () => {
		setSecondaryCurrencies(current => [...current, createEmptySecondary()])
		setHasCurrencyChanges(true)
	}

	const handleRemoveSecondary = (index: number) => {
		setSecondaryCurrencies(current =>
			current.filter((_, itemIndex) => itemIndex !== index),
		)
		setHasCurrencyChanges(true)
	}

	const handleNoMergeInvoiceLinesChange = (checked: boolean) => {
		setNoMergeInvoiceLines(checked)
		setHasInvoiceChanges(true)
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
			if (hasChanges) {
				await updateUserSettings({
					productsPerPage,
					displayLanguage,
					defaultInvoiceCurrencyId: defaultInvoiceCurrencyId || undefined,
				}).unwrap()

				void i18n.changeLanguage(displayLanguage)
				setHasChanges(false)
			}

			if (hasCurrencyChanges) {
				if (!primaryCurrency?.name?.trim()) {
					showToastMessage({
						status: 'error',
						description: t('components.currenciesSettings.primaryRequired'),
					})
					return
				}

				const invalidSecondary = secondaryCurrencies.some(
					item =>
						item.name.trim() && (!item.exchangeRate || item.exchangeRate <= 0),
				)

				if (invalidSecondary) {
					showToastMessage({
						status: 'error',
						description: t(
							'components.currenciesSettings.exchangeRateRequired',
						),
					})
					return
				}

				await updateCurrencySettings({
					primaryCurrency: {
						...primaryCurrency,
						name: primaryCurrency.name.trim(),
						internalCode: primaryCurrency.internalCode?.trim() || undefined,
					},
					secondaryCurrencies: secondaryCurrencies
						.filter(item => item.name.trim())
						.map(item => ({
							...item,
							name: item.name.trim(),
							internalCode: item.internalCode?.trim() || undefined,
							exchangeRateUnitCurrencyId:
								item.exchangeRateUnitCurrencyId ||
								primaryCurrency.currencyId ||
								undefined,
						})),
				}).unwrap()

				setHasCurrencyChanges(false)
			}

			if (hasInvoiceChanges) {
				await updateInvoiceSettings({ noMergeInvoiceLines }).unwrap()
				setHasInvoiceChanges(false)
			}

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

	const isSaveDisabled =
		!hasChanges && !hasCurrencyChanges && !hasInvoiceChanges
	const isSaveInProgress =
		isUserSettingsSaveInProgress ||
		isCurrencySaveInProgress ||
		isInvoiceSaveInProgress

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
					<Tab sx={getTabStyle(StepKeys.Currencies)}>
						<Text sx={getTabTextStyle(StepKeys.Currencies)}>
							{t('components.settingsTabs.currencies')}
						</Text>
					</Tab>
					<Tab sx={getTabStyle(StepKeys.WorkMode)}>
						<Text sx={getTabTextStyle(StepKeys.WorkMode)}>
							{t('components.settingsTabs.workMode')}
						</Text>
					</Tab>
					<Tab sx={getTabStyle(StepKeys.Invoice)}>
						<Text sx={getTabTextStyle(StepKeys.Invoice)}>
							{t('components.settingsTabs.invoice')}
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

					<TabPanel sx={styles.contentWrapper}>
						<CurrenciesSettings
							primaryCurrency={primaryCurrency}
							secondaryCurrencies={secondaryCurrencies}
							defaultInvoiceCurrencyId={defaultInvoiceCurrencyId}
							onDefaultInvoiceCurrencyChange={setDefaultInvoiceCurrencyId}
							onPrimaryChange={handlePrimaryChange}
							onSecondaryChange={handleSecondaryChange}
							onAddSecondary={handleAddSecondary}
							onRemoveSecondary={handleRemoveSecondary}
						/>
					</TabPanel>

					<TabPanel sx={styles.contentWrapper}>
						<WorkModeSettings />
					</TabPanel>

					<TabPanel sx={styles.contentWrapper}>
						<InvoiceSettings
							noMergeInvoiceLines={noMergeInvoiceLines}
							onNoMergeInvoiceLinesChange={handleNoMergeInvoiceLinesChange}
						/>
					</TabPanel>
				</TabPanels>
			</Tabs>

			<SettingActions
				isSaveDisabled={isSaveDisabled}
				isSaveInProgress={isSaveInProgress}
				onSaveSettings={onSaveSettings}
			/>
		</Flex>
	)
}

export default SettingsPage
