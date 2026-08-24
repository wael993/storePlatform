import { useEffect, useState } from 'react'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Box,
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
import InvoiceSettings, {
	type InvoiceBrandFormValues,
} from '../components/settings/InvoiceSettings'
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
import { useUser } from '../shared/hooks/useUser'
import { useSee } from '../shared/hooks/useSee'
import { SEE } from '../shared/seeFlags'
import { useWorkMode } from '../shared/hooks/useWorkMode'

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

const emptyInvoiceBrand = (): InvoiceBrandFormValues => ({
	displayName: '',
	address: '',
	phone: '',
	email: '',
	taxNumber: '',
	logoUrl: '',
	qrUrl: '',
	footerNote: '',
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
	const [invoiceBrand, setInvoiceBrand] =
		useState<InvoiceBrandFormValues>(emptyInvoiceBrand())
	const [hasInvoiceChanges, setHasInvoiceChanges] = useState(false)
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { user } = useUser()
	const { canSee } = useSee()
	const { workMode } = useWorkMode()
	const settingsLockedOffline = workMode === 'offline'
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
		setInvoiceBrand({
			// Keep empty when unset — PDF falls back to tenant name at read time.
			displayName: invoiceSettingsData.displayName ?? '',
			address: invoiceSettingsData.address ?? '',
			phone: invoiceSettingsData.phone ?? '',
			email: invoiceSettingsData.email ?? '',
			taxNumber: invoiceSettingsData.taxNumber ?? '',
			logoUrl: invoiceSettingsData.logoUrl ?? '',
			qrUrl: invoiceSettingsData.qrUrl ?? '',
			footerNote: invoiceSettingsData.footerNote ?? '',
		})
		setHasInvoiceChanges(false)
	}, [invoiceSettingsData])

	const handleProductsPerPageChange = (value: string) => {
		setProductsPerPage(parseInt(value, 10))
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
			'name' | 'internalCode' | 'exchangeRate' | 'exchangeRateUnitCurrencyId',
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

	const handleInvoiceBrandChange = (
		field: keyof InvoiceBrandFormValues,
		value: string,
	) => {
		setInvoiceBrand(current => ({ ...current, [field]: value }))
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
		if (settingsLockedOffline) {
			showToastMessage({
				status: 'error',
				description: t('components.workModeSettings.settingsLockedOffline'),
			})
			return
		}

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
				await updateInvoiceSettings({
					noMergeInvoiceLines,
					displayName: invoiceBrand.displayName.trim(),
					address: invoiceBrand.address.trim(),
					phone: invoiceBrand.phone.trim(),
					email: invoiceBrand.email.trim(),
					taxNumber: invoiceBrand.taxNumber.trim(),
					logoUrl: invoiceBrand.logoUrl.trim(),
					qrUrl: invoiceBrand.qrUrl.trim(),
					footerNote: invoiceBrand.footerNote.trim(),
				}).unwrap()
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

	const visibleSettingsTabs = [
		{
			id: SEE.settingsProducts,
			label: t('components.settingsTabs.product'),
		},
		{
			id: SEE.settingsLanguage,
			label: t('components.settingsTabs.language'),
		},
		{
			id: SEE.settingsCurrencies,
			label: t('components.settingsTabs.currencies'),
		},
		{
			id: SEE.settingsWorkMode,
			label: t('components.settingsTabs.workMode'),
		},
		{
			id: SEE.settingsInvoice,
			label: t('components.settingsTabs.invoice'),
		},
	].filter(tab => canSee(tab.id))

	const isSaveDisabled =
		settingsLockedOffline ||
		(!hasChanges && !hasCurrencyChanges && !hasInvoiceChanges)
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

			{settingsLockedOffline && (
				<Alert status="info" borderRadius="md" variant="left-accent" mb={4}>
					<AlertIcon />
					<AlertDescription fontSize="sm">
						{t('components.workModeSettings.settingsLockedOffline')}
					</AlertDescription>
				</Alert>
			)}

			<Tabs
				index={currentTabIndex}
				onChange={handleTabsChange}
				variant="unstyled"
				sx={styles.tabs}
			>
				<TabList sx={styles.tabList}>
					{visibleSettingsTabs.map((tab, index) => (
						<Tab key={tab.id} sx={getTabStyle(index)}>
							<Text sx={getTabTextStyle(index)}>{tab.label}</Text>
						</Tab>
					))}
				</TabList>
				<Divider sx={styles.divider} />

				<TabPanels>
					{visibleSettingsTabs.map(tab => (
						<TabPanel key={tab.id} sx={styles.contentWrapper}>
							{tab.id === SEE.settingsProducts ? (
								<Box
									pointerEvents={settingsLockedOffline ? 'none' : 'auto'}
									opacity={settingsLockedOffline ? 0.55 : 1}
									aria-disabled={settingsLockedOffline}
								>
									<ProductsSettings
										productsPerPage={productsPerPage}
										handleProductsPerPageChange={handleProductsPerPageChange}
									/>
								</Box>
							) : null}
							{tab.id === SEE.settingsLanguage ? (
								<Box
									pointerEvents={settingsLockedOffline ? 'none' : 'auto'}
									opacity={settingsLockedOffline ? 0.55 : 1}
									aria-disabled={settingsLockedOffline}
								>
									<LanguagesSettings
										displayLanguage={displayLanguage}
										handleLanguageChange={handleLanguageChange}
									/>
								</Box>
							) : null}
							{tab.id === SEE.settingsCurrencies ? (
								<Box
									pointerEvents={settingsLockedOffline ? 'none' : 'auto'}
									opacity={settingsLockedOffline ? 0.55 : 1}
									aria-disabled={settingsLockedOffline}
								>
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
								</Box>
							) : null}
							{tab.id === SEE.settingsWorkMode ? <WorkModeSettings /> : null}
							{tab.id === SEE.settingsInvoice ? (
								<Box
									pointerEvents={settingsLockedOffline ? 'none' : 'auto'}
									opacity={settingsLockedOffline ? 0.55 : 1}
									aria-disabled={settingsLockedOffline}
								>
									<InvoiceSettings
										noMergeInvoiceLines={noMergeInvoiceLines}
										brand={invoiceBrand}
										displayNameFallback={user?.tenantName?.trim() || undefined}
										onNoMergeInvoiceLinesChange={
											handleNoMergeInvoiceLinesChange
										}
										onBrandChange={handleInvoiceBrandChange}
									/>
								</Box>
							) : null}
						</TabPanel>
					))}
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
