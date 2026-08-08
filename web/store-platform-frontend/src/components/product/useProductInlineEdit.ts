import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	useEditInventoryMutation,
	useEditProductMutation,
} from '../../api/apiStore'
import useCustomToast from '../common/CustomToast'
import {
	PRODUCT_INLINE_FIELD_CONFIG,
	ProductInlineField,
	buildProductInlinePatch,
} from './productInlineEdit'

type ProgressState = Partial<Record<ProductInlineField, boolean>>

export const useProductInlineEdit = (productData: Product) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const [editProduct] = useEditProductMutation()
	const [editInventory] = useEditInventoryMutation()
	const [progress, setProgress] = useState<ProgressState>({})

	const setFieldProgress = (
		field: ProductInlineField,
		isInProgress: boolean,
	) => {
		setProgress(prev => ({ ...prev, [field]: isInProgress }))
	}

	const editField = async (
		field: ProductInlineField,
		rawValue?: string,
	): Promise<void> => {
		const config = PRODUCT_INLINE_FIELD_CONFIG[field]

		let patch: ReturnType<typeof buildProductInlinePatch>

		try {
			patch = buildProductInlinePatch(productData, field, rawValue)
		} catch {
			showToastMessage({
				status: 'error',
				description: t(config.errorKey),
			})
			return
		}

		setFieldProgress(field, true)

		try {
			if (patch.persist === 'product') {
				await editProduct({
					id: productData.productId,
					body: patch.body,
				}).unwrap()
			} else {
				await editInventory({
					id: patch.productId,
					body: patch.body,
				}).unwrap()
			}
		} catch {
			showToastMessage({
				status: 'error',
				description: t(
					'components.activityDetail.topSection.failUpdateMessage',
				),
			})
		} finally {
			setFieldProgress(field, false)
		}
	}

	const isFieldInProgress = (field: ProductInlineField): boolean =>
		Boolean(progress[field])

	return {
		editField,
		isFieldInProgress,
	}
}
