import dayjs from 'dayjs'

const escapeHtml = (value: string) =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')

export const buildWarehouseTransferHtml = (
	detail: WarehouseTransferAction,
	title: string,
) => {
	const safeTitle = escapeHtml(title)
	const rows = detail.items
		.map(
			item =>
				`<tr><td>${escapeHtml(item.productName)}</td><td>${item.quantity}</td><td>${escapeHtml(item.unitName ?? '')}</td></tr>`,
		)
		.join('')

	return `<!doctype html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
<style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}h1{font-size:18px}</style>
</head><body>
<h1>${safeTitle}</h1>
<p><strong>From:</strong> ${escapeHtml(detail.fromWarehouseName)}</p>
<p><strong>To:</strong> ${escapeHtml(detail.toWarehouseName)}</p>
<p><strong>Date:</strong> ${dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm')}</p>
<p><strong>User:</strong> ${escapeHtml(detail.createdByName ?? '—')}</p>
<table><thead><tr><th>Product</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`
}

/**
 * `printWindow` must be opened during the click gesture (see
 * `openInvoicePrintWindow`), otherwise popup blockers reject it after the fetch.
 */
export const printWarehouseTransfer = (
	detail: WarehouseTransferAction,
	title: string,
	printWindow: Window,
) => {
	printWindow.document.write(buildWarehouseTransferHtml(detail, title))
	printWindow.document.close()
	printWindow.focus()
	printWindow.print()
}

export const downloadWarehouseTransfer = (
	detail: WarehouseTransferAction,
	title: string,
) => {
	const html = buildWarehouseTransferHtml(detail, title)
	const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = `warehouse-transfer-${detail.referenceId}.html`
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	// Safari and Firefox cancel the download if the URL dies in the same task.
	window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
