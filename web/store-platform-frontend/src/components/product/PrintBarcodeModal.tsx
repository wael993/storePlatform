import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
	Text,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import JsBarcode from 'jsbarcode'
import useCustomToast from '../common/CustomToast'

interface PrintBarcodeModalProps {
	barcode: string
	isOpen: boolean
	onClose: () => void
}

const BARCODE_OPTIONS = {
	format: 'CODE128B',
	displayValue: false,
	lineColor: '#000000',
	background: '#ffffff',
	margin: 16,
	width: 2,
	height: 64,
} as const

const escapeHtml = (value: string) =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')

const renderBarcodeSvg = (value: string): string => {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
	JsBarcode(svg, value, BARCODE_OPTIONS)
	return svg.outerHTML
}

const PrintBarcodeModal = ({
	barcode,
	isOpen,
	onClose,
}: PrintBarcodeModalProps) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const [svgMarkup, setSvgMarkup] = useState('')
	const printFrameRef = useRef<HTMLIFrameElement | null>(null)

	const removePrintFrame = () => {
		printFrameRef.current?.remove()
		printFrameRef.current = null
	}

	useLayoutEffect(() => {
		if (!isOpen || !barcode) {
			setSvgMarkup('')
			return
		}

		try {
			setSvgMarkup(renderBarcodeSvg(barcode))
		} catch {
			setSvgMarkup('')
			showToastMessage({
				status: 'error',
				description: t(
					'components.activityDetail.topSection.failUpdateMessage',
				),
			})
		}
	}, [barcode, isOpen])

	useEffect(() => {
		if (!isOpen) {
			removePrintFrame()
		}

		return removePrintFrame
	}, [isOpen])

	const print = () => {
		if (!svgMarkup) {
			return
		}

		removePrintFrame()

		const title = escapeHtml(t('components.product.printBarcode'))
		const caption = escapeHtml(
			t('components.product.barcodeCaption', { value: barcode }),
		)

		const iframe = document.createElement('iframe')
		iframe.setAttribute('aria-hidden', 'true')
		iframe.style.position = 'fixed'
		iframe.style.width = '0'
		iframe.style.height = '0'
		iframe.style.border = '0'
		iframe.srcdoc = `<!DOCTYPE html><html><head><title>${title}</title><style>
body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}
svg{width:min(90vw,80mm);height:auto}
p{font-family:sans-serif;font-size:14px;margin-top:8px}
@page{margin:12mm}
</style></head><body>${svgMarkup}<p>${caption}</p></body></html>`

		printFrameRef.current = iframe
		iframe.onload = () => {
			const printWindow = iframe.contentWindow
			if (!printWindow) {
				removePrintFrame()
				return
			}

			printWindow.addEventListener('afterprint', removePrintFrame)
			printWindow.focus()
			printWindow.print()
			window.setTimeout(removePrintFrame, 60_000)
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
						{svgMarkup ? (
							<>
								<Box dangerouslySetInnerHTML={{ __html: svgMarkup }} />
								<Text mt={3} fontWeight={700}>
									{t('components.product.barcodeCaption', {
										value: barcode,
									})}
								</Text>
							</>
						) : null}
					</Flex>
				</ModalBody>
				<ModalFooter>
					<Button onClick={print} isDisabled={!svgMarkup}>
						{t('components.product.print')}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default PrintBarcodeModal
