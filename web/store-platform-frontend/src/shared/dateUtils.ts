import { format, isValid, parse } from 'date-fns'

export const formatDate = (date: string | Date): string => {
	try {
		return date ? format(new Date(date), 'dd.MM.yyyy') : ''
	} catch (error) {
		return date?.toString()
	}
}

/** Local calendar date for invoice draft fields (yyyy-MM-dd). */
export const formatDateInputValue = (date: Date): string =>
	format(date, 'yyyy-MM-dd')

export const parseDateInputValue = (value: string): Date => {
	const dateOnly = value.split('T')[0]
	const parsed = parse(dateOnly, 'yyyy-MM-dd', new Date())
	if (isValid(parsed)) return parsed

	const [year, month, day] = dateOnly.split('-').map(Number)
	if (year && month && day) return new Date(year, month - 1, day)

	return new Date()
}

export const buildInvoiceIssuedAtIso = (
	invoiceDate: string,
	invoiceTime: string,
): string => {
	const dateOnly = invoiceDate.trim().split('T')[0]
	const timeMatch = invoiceTime.trim().match(/^(\d{1,2}):(\d{2})/)
	const hours = (timeMatch?.[1] ?? '00').padStart(2, '0')
	const minutes = timeMatch?.[2] ?? '00'
	const parsed = parse(
		`${dateOnly} ${hours}:${minutes}`,
		'yyyy-MM-dd HH:mm',
		new Date(),
	)

	if (!isValid(parsed)) {
		throw new Error(
			`Invalid invoice date or time: ${invoiceDate} ${invoiceTime}`,
		)
	}

	return parsed.toISOString()
}

/** Same instant rules as invoice issuedAt: form date + current local time → ISO. */
export const buildEntryInvoiceDateIso = (invoiceDate: string): string => {
	const now = new Date()
	const hours = String(now.getHours()).padStart(2, '0')
	const minutes = String(now.getMinutes()).padStart(2, '0')
	return buildInvoiceIssuedAtIso(invoiceDate, `${hours}:${minutes}`)
}

export const formatDateFromAndDateTo = (
	dateFrom?: string,
	dateTo?: string,
): string => {
	return `${dateFrom ? formatDate(dateFrom) : ''} - ${
		dateTo ? formatDate(dateTo) : ''
	}`
}
