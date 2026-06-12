import { format } from 'date-fns'

export const formatDate = (date: string | Date): string => {
	try {
		return date ? format(new Date(date), 'dd.MM.yyyy') : ''
	} catch (error) {
		return date?.toString()
	}
}

export const formatDateFromAndDateTo = (
	dateFrom?: string,
	dateTo?: string,
): string => {
	return `${dateFrom ? formatDate(dateFrom) : ''} - ${
		dateTo ? formatDate(dateTo) : ''
	}`
}
