import { LIST_INTERNAL_ONLY_COLUMNS } from './constants'
import { SortOrder } from './globalEnums'

export const compareDatesForSorting = (
	firstDate?: string,
	secondDate?: string,
	order?: SortOrder | null,
) => {
	if (!firstDate && !secondDate) return 0
	if (!firstDate) return 1
	if (!secondDate) return -1

	return order === SortOrder.ASC
		? new Date(firstDate).getTime() - new Date(secondDate).getTime()
		: new Date(secondDate).getTime() - new Date(firstDate).getTime()
}

export const compareNumbersForSorting = (
	firstNumber?: number,
	secondNumber?: number,
	order?: SortOrder | null,
) => {
	if (!firstNumber && !secondNumber) return 0
	if (typeof firstNumber !== 'number') return 1
	if (typeof secondNumber !== 'number') return -1

	return order === SortOrder.ASC
		? firstNumber - secondNumber
		: secondNumber - firstNumber
}

export const compareStringsForSorting = (
	firstString?: string,
	secondString?: string,
	order?: SortOrder | null,
) => {
	if (!firstString && !secondString) return 0
	if (!firstString) return 1
	if (!secondString) return -1

	const result = firstString.localeCompare(secondString, undefined, {
		sensitivity: 'base',
	})

	return order === SortOrder.ASC ? result : -result
}

/**
 * Returns the width of the table
 *
 * @param widthMap - The width map of the table
 * @param isInternalUser - Whether the user is an internal user
 * @param stickyRightWidth - The width of the sticky right column (default 0)
 * @param additionalPadding - The additional padding of the table (default 0)
 * @returns The width of the table
 */
export const getTableWidth = (
	widthMap: Record<string, number>,
	isInternalUser: boolean,
	stickyRightWidth: number = 0,
	additionalPadding: number = 0,
): string => {
	const width = Object.entries(widthMap)
		.filter(
			([key]) => isInternalUser || !LIST_INTERNAL_ONLY_COLUMNS.includes(key),
		)
		.reduce((total, [, value]) => total + value, 0)
	return `${width + stickyRightWidth + additionalPadding}rem`
}

export const safelyParseJSON = (
	json: unknown,
): Record<string, unknown> | undefined => {
	try {
		return JSON.parse(json as string)
	} catch (err) {
		return
	}
}

export const parseNumberForSorting = (
	value: string | number | undefined,
): number | undefined => {
	if (typeof value === 'number') return value
	if (typeof value === 'string') {
		const parsed = parseFloat(value.replaceAll(',', ''))
		return isNaN(parsed) ? undefined : parsed
	}
	return undefined
}
type Falsy = false | 0 | '' | null | undefined

export const isTruthy = <T>(argument: T | Falsy): argument is T => {
	return !!argument
}
