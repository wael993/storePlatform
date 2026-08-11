import { pdf } from '@react-pdf/renderer'

import { ensureInvoicePdfFonts, InvoicePdfDocument } from './InvoicePdfDocument'
import type { InvoiceDocumentModel } from './invoiceDocumentModel'
import { buildInvoicePdfFilename } from './invoicePdfBrand'

const isLikelyLogoRenderError = (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error)
	return /image|logo|fetch|network|cors|status|ENOENT|failed to load/i.test(
		message,
	)
}

const renderInvoicePdfBlob = async (model: InvoiceDocumentModel) => {
	ensureInvoicePdfFonts()
	try {
		return await pdf(<InvoicePdfDocument model={model} />).toBlob()
	} catch (error) {
		// Bad/CORS logo URLs can fail the whole render — retry without logo only then.
		if (!model.brand.logoUrl || !isLikelyLogoRenderError(error)) {
			throw error
		}
		return pdf(
			<InvoicePdfDocument
				model={{
					...model,
					brand: { ...model.brand, logoUrl: undefined },
				}}
			/>,
		).toBlob()
	}
}

const waitForPrint = (printWindow: Window, url: string) =>
	new Promise<void>((resolve, reject) => {
		let settled = false

		const settle = (fn: () => void) => {
			if (settled) return
			settled = true
			fn()
		}

		const onReady = () => {
			settle(() => {
				try {
					printWindow.focus()
					printWindow.print()
					window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
					resolve()
				} catch (error) {
					URL.revokeObjectURL(url)
					reject(error)
				}
			})
		}

		printWindow.addEventListener('load', onReady)
		// PDF blob URLs often skip the load event in Chromium.
		window.setTimeout(onReady, 800)

		window.setTimeout(() => {
			settle(() => {
				URL.revokeObjectURL(url)
				reject(new Error('Print window timed out'))
			})
		}, 15_000)
	})

/** Open during the click gesture so popup blockers allow print after async work. */
export const openInvoicePrintWindow = () => {
	const printWindow = window.open('about:blank', '_blank')
	if (!printWindow) {
		throw new Error('Popup blocked')
	}
	printWindow.opener = null
	return printWindow
}

export const printInvoiceDocument = async (
	model: InvoiceDocumentModel,
	printWindow: Window,
) => {
	try {
		const blob = await renderInvoicePdfBlob(model)
		const url = URL.createObjectURL(blob)
		printWindow.location.href = url
		await waitForPrint(printWindow, url)
	} catch (error) {
		printWindow.close()
		throw error
	}
}

export const downloadInvoiceDocumentPdf = async (
	model: InvoiceDocumentModel,
) => {
	const blob = await renderInvoicePdfBlob(model)
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = buildInvoicePdfFilename(
		model.brand.displayName,
		model.invoiceNumber,
	)
	document.body.appendChild(link)
	link.click()
	link.remove()
	window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
