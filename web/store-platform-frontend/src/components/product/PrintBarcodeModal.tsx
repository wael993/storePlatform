import { useEffect, useLayoutEffect, useRef } from 'react'
import {
	Box,
	Button,
	Flex,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Spinner,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import LabelPreview from './LabelPreview'
import {
	useGetInvoiceSettingsQuery,
	useGetLabelTemplatesQuery,
} from '../../api/apiStore'
import {
	pickDefaultTemplate,
	resolveLabelValues,
} from '../../shared/labelTemplate'
import { RootState } from '../../store/store'

interface PrintBarcodeModalProps {
	product: Product
	barcode: string
	isOpen: boolean
	onClose: () => void
}

const escapeHtml = (value: string) =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')

const PrintBarcodeModal = ({
	product,
	barcode,
	isOpen,
	onClose,
}: PrintBarcodeModalProps) => {
	const { t } = useTranslation()
	const tenantName = useSelector(
		(state: RootState) => state.user.user?.tenantName ?? '',
	)
	const { data: invoiceSettings, isFetching: isInvoiceFetching } =
		useGetInvoiceSettingsQuery(undefined, {
			skip: !isOpen,
		})
	const { data: templatesData, isFetching } = useGetLabelTemplatesQuery(
		undefined,
		{ skip: !isOpen },
	)
	const printFrameRef = useRef<HTMLIFrameElement | null>(null)
	const printTimeoutRef = useRef<number | null>(null)
	const previewRef = useRef<HTMLDivElement | null>(null)

	const template = pickDefaultTemplate(templatesData?.templates ?? [])
	const values = resolveLabelValues({
		product,
		barcode,
		storeName: invoiceSettings?.displayName?.trim() || tenantName,
		storeLogo: invoiceSettings?.logoUrl ?? '',
	})

	const removePrintFrame = () => {
		if (printTimeoutRef.current !== null) {
			window.clearTimeout(printTimeoutRef.current)
			printTimeoutRef.current = null
		}

		printFrameRef.current?.remove()
		printFrameRef.current = null
	}

	useLayoutEffect(() => {
		if (!isOpen) {
			removePrintFrame()
		}
	}, [isOpen])

	useEffect(() => removePrintFrame, [])

	const print = () => {
		const markup = previewRef.current?.innerHTML
		const widthMm = Number(template.layout.width)
		const heightMm = Number(template.layout.height)
		if (
			!markup ||
			!Number.isFinite(widthMm) ||
			!Number.isFinite(heightMm) ||
			widthMm <= 0 ||
			heightMm <= 0
		) {
			return
		}

		removePrintFrame()

		const title = escapeHtml(t('components.product.printBarcode'))
		const iframe = document.createElement('iframe')
		iframe.setAttribute('aria-hidden', 'true')
		iframe.style.position = 'fixed'
		iframe.style.width = '0'
		iframe.style.height = '0'
		iframe.style.border = '0'
		iframe.srcdoc = `<!DOCTYPE html><html><head><title>${title}</title><style>
html,body{margin:0;width:${widthMm}mm;height:${heightMm}mm}
svg{width:100%;height:100%;display:block}
@page{size:${widthMm}mm ${heightMm}mm;margin:0}
</style></head><body>${markup}</body></html>`

		printFrameRef.current = iframe
		iframe.onload = () => {
			const printWindow = iframe.contentWindow
			if (!printWindow) {
				removePrintFrame()
				return
			}

			printTimeoutRef.current = window.setTimeout(removePrintFrame, 60_000)
			printWindow.addEventListener('afterprint', removePrintFrame)
			printWindow.focus()
			printWindow.print()
		}

		document.body.appendChild(iframe)
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered>
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>{t('components.product.printBarcode')}</ModalHeader>
				<ModalCloseButton />
				<ModalBody>
					<Flex direction="column" align="center" py={4}>
						{isFetching && !templatesData ? (
							<Spinner />
						) : (
							<Box ref={previewRef}>
								<LabelPreview layout={template.layout} values={values} />
							</Box>
						)}
					</Flex>
				</ModalBody>
				<ModalFooter>
					<Button
						onClick={print}
						isDisabled={
							!barcode ||
							(isFetching && !templatesData) ||
							(isInvoiceFetching && !invoiceSettings)
						}
					>
						{t('components.product.print')}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default PrintBarcodeModal
