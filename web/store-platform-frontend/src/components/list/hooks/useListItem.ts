import { useTranslation } from 'react-i18next'
import useCustomToast from '../../common/CustomToast'
import { useState } from 'react'
import { useEditProductMutation } from '../../../api/apiStore'

interface PatchActivityProgressState {
	isPromoterCountInProgress: boolean
	isPromoterFeeInProgress: boolean
	isRentalFeeInProgress: boolean
	isSupplierFocusInProgress: boolean
}

export const useListItem = <T extends Product>(productData: T) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const [editProduct] = useEditProductMutation()

	const [patchActivityProgressState, setPatchActivityProgressState] =
		useState<PatchActivityProgressState>({
			isPromoterCountInProgress: false,
			isPromoterFeeInProgress: false,
			isRentalFeeInProgress: false,
			isSupplierFocusInProgress: false,
		})

	const handleEditBuyCost = async (buyCost?: string): Promise<void> => {
		if (!buyCost?.trim()) {
			showToastMessage({
				status: 'error',
				description: t('components.activityDetail.topSection.buyCostNoValue'),
			})

			return
		}

		setPatchActivityProgressState({
			...patchActivityProgressState,
			isPromoterFeeInProgress: true,
		})

		const handleFeeSectionUpdate = async (
			data: Partial<Omit<Product, 'id'>>,
		) => {
			try {
				await editProduct({
					id: productData.id,
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

		const formattedBuyCost = Number(buyCost)

		await handleFeeSectionUpdate({
			price: {
				...productData.price,
				buyCost: formattedBuyCost,
			},
		})
		setPatchActivityProgressState({
			...patchActivityProgressState,
			isPromoterFeeInProgress: false,
		})
	}
	return {
		handleEditBuyCost,
		patchActivityProgressState,
	}
}
