import { useRef, useState } from 'react'
import { useDisclosure } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useGenerateProductBarcodeMutation } from '../../api/apiStore'
import { enqueueProductWrite } from '../../api/optimisticData'
import { getIsOnline } from '../../offline/connectivity'
import { displayProductBarcode } from '../../shared/productBarcode'
import useCustomToast from '../common/CustomToast'

export const usePrintProductBarcode = (product: Product) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const preview = useDisclosure()
	const [barcode, setBarcode] = useState('')
	const [generateBarcode, { isLoading }] = useGenerateProductBarcodeMutation()
	const inFlight = useRef(false)

	const printBarcode = async () => {
		if (inFlight.current || isLoading) {
			return
		}

		const existing = displayProductBarcode(product)

		if (existing) {
			setBarcode(existing)
			preview.onOpen()
			return
		}

		if (!getIsOnline()) {
			showToastMessage({
				status: 'error',
				description: t('components.product.printBarcodeOffline'),
			})
			return
		}

		inFlight.current = true

		try {
			const result = await enqueueProductWrite(product.productId, () =>
				generateBarcode(product.productId).unwrap(),
			)
			setBarcode(result.barcode)
			preview.onOpen()
		} catch {
			showToastMessage({
				status: 'error',
				description: t(
					'components.activityDetail.topSection.failUpdateMessage',
				),
			})
		} finally {
			inFlight.current = false
		}
	}

	return {
		printBarcode,
		isEnsuringBarcode: isLoading,
		barcode,
		preview,
	}
}
