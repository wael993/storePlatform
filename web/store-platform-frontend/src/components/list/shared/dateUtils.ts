import { startOfDay } from 'date-fns'

/**
 * Get disabled dates for date picker.
 *
 * @param maxDate - The maximum date to consider (Date)
 * @param minDate - Optional, the minimum date to consider (Date)
 * @param filterFn - Optional function to determine if a date should be disabled (date: Date) => boolean
 * @returns Set of number
 */
export const generateDisabledDates = ({
	maxDate,
	minDate,
	filterFn,
}: {
	maxDate: Date
	minDate?: Date
	filterFn?: (date: Date) => boolean
}): Set<number> => {
	if (!filterFn) return new Set()

	const result = new Set<number>()

	const today = new Date()
	const end = maxDate

	const current = minDate
		? new Date(minDate.getFullYear(), minDate.getMonth(), 1)
		: new Date(today.getFullYear(), today.getMonth(), 1)

	while (current <= end) {
		const currentDay = new Date(current)
		if (filterFn(currentDay)) {
			result.add(startOfDay(currentDay).getTime())
		}
		current.setDate(current.getDate() + 1)
	}

	return result
}
