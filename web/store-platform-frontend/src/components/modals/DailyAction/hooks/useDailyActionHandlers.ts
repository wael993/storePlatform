import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	usePostDailyActionMutation,
	useGetCurrenciesQuery,
	useGetCustomersQuery,
	useGetProductsQuery,
	useGetSuppliersQuery,
	useGetUnitsQuery,
	AddDailyActionRequestBody,
} from '../../../../api/apiStore'
import { StepKeys } from '../../../../shared/globalEnums'
import { mapFee } from '../../../../shared/utils'
import useCustomToast from '../../../common/CustomToast'

export const useDailyActionHandlers = () => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()

	const [entryType, setEntryType] = useState<DropdownOption[]>([])
	const [formData, setFormData] = useState<Partial<DailyAction>>()
	const [step, setStep] = useState<StepKeys>(StepKeys.ACTION_TYPE)

	const [postDailyAction, { isLoading: isSavingDailyAction }] =
		usePostDailyActionMutation()
	const { data: productsData, isLoading: isProductsLoading } =
		useGetProductsQuery({})
	const { data: suppliersData, isLoading: isSuppliersLoading } =
		useGetSuppliersQuery()
	const { data: customersData, isLoading: isCustomersLoading } =
		useGetCustomersQuery()
	const { data: currenciesData, isLoading: isCurrenciesLoading } =
		useGetCurrenciesQuery()
	const { data: unitsData, isLoading: isUnitsLoading } = useGetUnitsQuery()
	const isAllDataLoaded =
		!isProductsLoading &&
		!isSuppliersLoading &&
		!isCustomersLoading &&
		!isCurrenciesLoading &&
		!isUnitsLoading

	const productOptions = useMemo(() => productsData ?? [], [productsData])
	const supplierOptions = useMemo(() => suppliersData ?? [], [suppliersData])
	const customerOptions = useMemo(() => customersData ?? [], [customersData])
	const currencyOptions = useMemo(() => currenciesData ?? [], [currenciesData])
	const unitOptions = useMemo(() => unitsData ?? [], [unitsData])

	const totalPrice = useMemo(() => {
		if (!formData?.singleUnitPrice || !formData?.weight) return ''

		return mapFee(
			(Number(formData.singleUnitPrice) * Number(formData.weight))?.toString(),
		)
	}, [formData?.singleUnitPrice, formData?.weight])

	useEffect(() => {
		setFormData(prev => ({
			...prev,
			totalPrice: totalPrice || undefined,
		}))
	}, [totalPrice])

	const handleDropdownChange = (
		valueField: keyof DailyAction,
		labelField: keyof DailyAction,
		values: string[],
		options: DropdownOption[],
	) => {
		const label = options.find(o => o.value === values[0])?.label ?? ''
		setFormData(prev => ({
			...prev,
			[valueField]: values[0],
			[labelField]: label,
		}))
	}

	const handleInputChange = (
		field: 'weight' | 'singleUnitPrice',
		value: string,
	) => {
		setFormData((prev: any) => ({
			...prev,
			[field]: value,
		}))
	}

	const bodyHeading = useMemo(() => {
		if (step === StepKeys.ACTION_TYPE) {
			return t('components.daily.actionType')
		}
		if (step === StepKeys.ACTION_DATA) {
			return t('components.daily.actionDate')
		}
		if (step === StepKeys.ACTION_SUMMARY) {
			return t('components.daily.actionSummary')
		}
		return ''
	}, [step, t])

	const handleSaveDailyAction = async () => {
		if (formData) {
			const payload: AddDailyActionRequestBody = {
				entryType: formData.entryType,
				productId: formData.productId ?? '',
				productName: formData.productName ?? '',
				supplierId: formData.supplierId ?? undefined,
				supplierName: formData.supplierName ?? undefined,
				customerId: formData.customerId ?? undefined,
				customerName: formData.customerName ?? undefined,
				currencyId: formData.currencyId ?? '',
				currencyName: formData.currencyName ?? '',
				unitId: formData.unitId ?? '',
				unitName: formData.unitName ?? '',
				weight: formData.weight ?? '',
				singleUnitPrice: formData.singleUnitPrice ?? undefined,
				totalPrice: formData.totalPrice ?? undefined,
			}
			try {
				await postDailyAction(payload)
					.unwrap()
					.then(() => {
						showToastMessage({
							status: 'success',
							description: t('components.daily.actionSavedSuccessfully'),
						})
					})
			} catch (error) {
				console.error('Error saving daily action:', error)
				// Here you could set an error state to display an error message to the user
				return
			}
			// Here you would typically send formData to your backend API to save the daily action
			console.log('Saving Daily Action:', payload)
			// Reset form after saving

			setFormData(undefined)
			setEntryType([])
			setStep(StepKeys.ACTION_TYPE)
		}
	}

	return {
		handleDropdownChange,
		setStep,
		setFormData,
		setEntryType,
		handleInputChange,
		handleSaveDailyAction,
		isSavingDailyAction,
		step,
		formData,
		entryType,
		totalPrice,
		bodyHeading,
		unitOptions,
		productOptions,
		isAllDataLoaded,
		supplierOptions,
		customerOptions,
		currencyOptions,
	}
}
