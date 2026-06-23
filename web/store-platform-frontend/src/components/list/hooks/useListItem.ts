import { useTranslation } from 'react-i18next'
import useCustomToast from '../../common/CustomToast'
import { useState } from 'react'
import { useEditProductMutation } from '../../../api/apiStore'

interface PatchProductProgressState {
	isBuyCostInProgress: boolean
	isWholesalePriceInProgress: boolean
	isDiscountInProgress: boolean
}

export const useListItem = <T extends Product>(productData: T) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const [editProduct] = useEditProductMutation()

	const [patchProductProgressState, setPatchProductProgressState] =
		useState<PatchProductProgressState>({
			isBuyCostInProgress: false,
			isWholesalePriceInProgress: false,
			isDiscountInProgress: false,
		})

	const parseNumberInput = (value?: string): number => {
		if (!value?.trim()) {
			throw new Error('NO_VALUE')
		}

		const parsedValue = Number(value.replaceAll(',', '').trim())

		if (Number.isNaN(parsedValue)) {
			throw new Error('INVALID_NUMBER')
		}

		return parsedValue
	}

	const handleProductUpdate = async (
		data: Partial<Omit<Product, 'productId'>>,
	): Promise<void> => {
		try {
			await editProduct({
				id: productData.productId,
				body: data,
			}).unwrap()
		} catch (error) {
			showToastMessage({
				status: 'error',
				description: t(
					'components.activityDetail.topSection.failUpdateMessage',
				),
			})
		}
	}

	const handleEditBuyCost = async (buyCost?: string): Promise<void> => {
		if (!buyCost?.trim()) {
			showToastMessage({
				status: 'error',
				description: t('components.activityDetail.topSection.buyCostNoValue'),
			})

			return
		}

		let formattedBuyCost: number

		try {
			formattedBuyCost = parseNumberInput(buyCost)
		} catch {
			showToastMessage({
				status: 'error',
				description: t('components.activityDetail.topSection.buyCostNoValue'),
			})
			return
		}

		setPatchProductProgressState({
			...patchProductProgressState,
			isBuyCostInProgress: true,
		})

		await handleProductUpdate({
			price: {
				...productData.price,
				purchasePrice: formattedBuyCost,
			},
		})

		setPatchProductProgressState({
			...patchProductProgressState,
			isBuyCostInProgress: false,
		})
	}

	const handleEditSellPrice = async (sellPrice?: string): Promise<void> => {
		let formattedSellPrice: number

		try {
			formattedSellPrice = parseNumberInput(sellPrice)
		} catch {
			showToastMessage({
				status: 'error',
				description: t('common.sellPrice'),
			})
			return
		}

		setPatchProductProgressState({
			...patchProductProgressState,
			isWholesalePriceInProgress: true,
		})

		await handleProductUpdate({
			price: {
				...productData.price,
				retailPrice: formattedSellPrice,
			},
		})

		setPatchProductProgressState({
			...patchProductProgressState,
			isWholesalePriceInProgress: false,
		})
	}

	const handleEditDiscount = async (discount?: string): Promise<void> => {
		let formattedDiscount: number

		try {
			formattedDiscount = parseNumberInput(discount)
		} catch {
			showToastMessage({
				status: 'error',
				description: t('common.discount'),
			})
			return
		}

		setPatchProductProgressState({
			...patchProductProgressState,
			isDiscountInProgress: true,
		})

		await handleProductUpdate({
			price: {
				...productData.price,
				discount: formattedDiscount,
			},
		})

		setPatchProductProgressState({
			...patchProductProgressState,
			isDiscountInProgress: false,
		})
	}

	return {
		handleEditBuyCost,
		handleEditSellPrice,
		handleEditDiscount,
		patchProductProgressState,
	}
}
