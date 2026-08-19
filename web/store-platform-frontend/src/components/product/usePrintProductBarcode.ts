import { useState } from 'react'
import { useDisclosure } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useEditProductMutation } from '../../api/apiStore'
import { enqueueProductWrite } from '../../api/optimisticData'
import useCustomToast from '../common/CustomToast'

export const usePrintProductBarcode = (product: Product) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const preview = useDisclosure()
	const [barcode, setBarcode] = useState('')
	const [editProduct, { isLoading }] = useEditProductMutation()

	const printBarcode = async () => {
		const existing = product.barcode?.trim()

		if (existing) {
			setBarcode(existing)
			preview.onOpen()
			return
		}

		try {
			await enqueueProductWrite(product.productId, () =>
				editProduct({
					id: product.productId,
					body: { barcode: product.productId },
				}).unwrap(),
			)
			setBarcode(product.productId)
			preview.onOpen()
		} catch {
			showToastMessage({
				status: 'error',
				description: t(
					'components.activityDetail.topSection.failUpdateMessage',
				),
			})
		}
	}

	return {
		printBarcode,
		isEnsuringBarcode: isLoading,
		barcode,
		preview,
	}
}
