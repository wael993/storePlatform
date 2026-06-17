import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	usePostDailyActionMutation,
	useGetCurrenciesQuery,
	useGetCustomersQuery,
	useGetProductsQuery,
	useGetSuppliersQuery,
	useGetUnitsQuery,
	useGetExpensesQuery,
	useGetPartnersQuery,
	AddDailyActionRequestBody,
} from '../../../../api/apiStore'
import { DailyActionType, StepKeys } from '../../../../shared/globalEnums'
import {
	formatNumberForDb,
	mapFee,
} from '../../../../shared/utils'
import useCustomToast from '../../../common/CustomToast'

export interface DailyActionProductLine {
	id: string
	productId?: string
	productName?: string
	weight?: string
	singleUnitPrice?: string
	totalPrice?: string
	note?: string
}

interface UseDailyActionHandlersOptions {
	shouldLoadOptions?: boolean
}

const createDailyActionProductLine = (): DailyActionProductLine => ({
	id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
})

const getProductLineTotalForDb = (line: DailyActionProductLine) => {
	if (!line.singleUnitPrice || !line.weight) return ''

	return (
		formatNumberForDb(Number(line.singleUnitPrice) * Number(line.weight), 2) ??
		''
	)
}

export const useDailyActionHandlers = ({
	shouldLoadOptions = true,
}: UseDailyActionHandlersOptions = {}) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()

	const [entryType, setEntryType] = useState<DropdownOption[]>([])
	const [formData, setFormData] = useState<Partial<DailyAction>>()
	const [productLines, setProductLines] = useState<DailyActionProductLine[]>([
		createDailyActionProductLine(),
	])
	const [step, setStep] = useState<StepKeys>(StepKeys.ACTION_TYPE)

	const [postDailyAction, { isLoading: isSavingDailyAction }] =
		usePostDailyActionMutation()

	const {
		data: productsResponse = { products: [], totalCount: 0 },
		isLoading: isProductsLoading,
	} = useGetProductsQuery({}, { skip: !shouldLoadOptions })

	const { data: suppliersResponse = [], isLoading: isSuppliersLoading } =
		useGetSuppliersQuery({}, { skip: !shouldLoadOptions })

	const { data: customersResponse = [], isLoading: isCustomersLoading } =
		useGetCustomersQuery({}, { skip: !shouldLoadOptions })

	const { data: currenciesResponse = [], isLoading: isCurrenciesLoading } =
		useGetCurrenciesQuery({}, { skip: !shouldLoadOptions })

	const { data: unitsResponse = [], isLoading: isUnitsLoading } =
		useGetUnitsQuery({}, { skip: !shouldLoadOptions })
	const { data: expensesResponse = [], isLoading: isExpensesLoading } =
		useGetExpensesQuery(undefined, { skip: !shouldLoadOptions })

	const { data: partnersResponse = [], isLoading: isPartnersLoading } =
		useGetPartnersQuery({}, { skip: !shouldLoadOptions })

	const isAllDataLoaded =
		!isProductsLoading &&
		!isSuppliersLoading &&
		!isCustomersLoading &&
		!isCurrenciesLoading &&
		!isUnitsLoading &&
		!isExpensesLoading &&
		!isPartnersLoading

	const products = useMemo(
		() => productsResponse.products ?? [],
		[productsResponse],
	)
	const suppliers = useMemo(() => suppliersResponse ?? [], [suppliersResponse])
	const customers = useMemo(() => customersResponse ?? [], [customersResponse])
	const currency = useMemo(() => currenciesResponse ?? [], [currenciesResponse])
	const unit = useMemo(() => unitsResponse ?? [], [unitsResponse])
	const expenses = useMemo(() => expensesResponse ?? [], [expensesResponse])
	const partners = useMemo(() => partnersResponse ?? [], [partnersResponse])

	const productLinesWithTotals = useMemo(
		() =>
			productLines.map(line => ({
				...line,
				totalPrice: getProductLineTotalForDb(line),
			})),
		[productLines],
	)

	const totalPriceForDb = useMemo(() => {
		const totals = productLinesWithTotals
			.filter(line => line.totalPrice)
			.map(line => Number(line.totalPrice))
			.filter(total => !Number.isNaN(total))

		if (!totals.length) return ''

		return (
			formatNumberForDb(
				totals.reduce((sum, total) => sum + total, 0),
				2,
			) ?? ''
		)
	}, [productLinesWithTotals])

	const totalPrice = useMemo(() => mapFee(totalPriceForDb) ?? '', [totalPriceForDb])

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

	const handleProductLineDropdownChange = (
		lineId: string,
		valueField: keyof DailyActionProductLine,
		labelField: keyof DailyActionProductLine,
		values: string[],
		options: DropdownOption[],
	) => {
		const label = options.find(o => o.value === values[0])?.label ?? ''

		setProductLines(prev =>
			prev.map(line =>
				line.id === lineId
					? {
							...line,
							[valueField]: values[0],
							[labelField]: label,
						}
					: line,
			),
		)
	}

	const handleInputChange = (
		field:
			| 'weight'
			| 'singleUnitPrice'
			| 'invoiceNumber'
			| 'invoiceDate'
			| 'note',
		value: string,
	) => {
		setFormData((prev: any) => ({
			...prev,
			[field]: value,
		}))
	}

	const handleProductLineInputChange = (
		lineId: string,
		field: 'weight' | 'singleUnitPrice' | 'note',
		value: string,
	) => {
		setProductLines(prev =>
			prev.map(line =>
				line.id === lineId
					? {
							...line,
							[field]: value,
						}
					: line,
			),
		)
	}

	const addProductLine = () => {
		setProductLines(prev => [...prev, createDailyActionProductLine()])
	}

	const removeProductLine = (lineId: string) => {
		setProductLines(prev =>
			prev.length === 1 ? prev : prev.filter(line => line.id !== lineId),
		)
	}

	const resetProductLines = () => {
		setProductLines([createDailyActionProductLine()])
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
		if (formData?.entryType) {
			const sharedPayload: AddDailyActionRequestBody = {
				entryType: formData.entryType,
				supplierId: formData.supplierId ?? undefined,
				supplierName: formData.supplierName ?? undefined,
				customerId: formData.customerId ?? undefined,
				customerName: formData.customerName ?? undefined,
				expenseId: formData.expenseId ?? undefined,
				expenseName: formData.expenseName ?? undefined,
				currencyId: formData.currencyId ?? '',
				currencyName: formData.currencyName ?? '',
				unitId: formData.unitId ?? undefined,
				unitName: formData.unitName ?? undefined,
				singleUnitPrice:
					formatNumberForDb(formData.singleUnitPrice ?? '', 2) ?? undefined,
				invoiceNumber: formData.invoiceNumber ?? undefined,
				invoiceDate: formData.invoiceDate ?? '',
			}

			const isProductEntry =
				formData.entryType === DailyActionType.BUYING_ENTRY ||
				formData.entryType === DailyActionType.SELLING_ENTRY

			const payloads: AddDailyActionRequestBody[] = isProductEntry
				? productLinesWithTotals.map(line => ({
						...sharedPayload,
						productId: line.productId ?? undefined,
						productName: line.productName ?? undefined,
						weight: line.weight ?? undefined,
						singleUnitPrice:
							formatNumberForDb(line.singleUnitPrice ?? '', 2) ?? undefined,
						totalPrice: line.totalPrice
							? (formatNumberForDb(line.totalPrice, 2) ?? undefined)
							: undefined,
						note: line.note?.trim() || undefined,
					}))
				: [
						{
							...sharedPayload,
							note: formData.note?.trim() || undefined,
						},
					]

			try {
				await Promise.all(payloads.map(payload => postDailyAction(payload).unwrap()))
				showToastMessage({
					status: 'success',
					description: t('components.daily.actionSavedSuccessfully'),
				})
			} catch (error) {
				console.error('Error saving daily action:', error)
				return
			}

			setFormData(undefined)
			setEntryType([])
			resetProductLines()
			setStep(StepKeys.ACTION_TYPE)
		}
	}

	return {
		handleDropdownChange,
		setStep,
		setFormData,
		setEntryType,
		resetProductLines,
		handleInputChange,
		handleProductLineDropdownChange,
		handleProductLineInputChange,
		addProductLine,
		removeProductLine,
		handleSaveDailyAction,
		isSavingDailyAction,
		step,
		formData,
		productLines: productLinesWithTotals,
		entryType,
		totalPrice,
		bodyHeading,
		unit,
		products,
		isAllDataLoaded,
		suppliers,
		customers,
		expenses,
		partners,
		currency,
		isProductsLoading,
		isSuppliersLoading,
		isCustomersLoading,
		isCurrenciesLoading,
		isUnitsLoading,
		isExpensesLoading,
		isPartnersLoading,
	}
}
