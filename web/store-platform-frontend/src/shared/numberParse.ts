// note: last `,` or `.` is the decimal; earlier ones are thousands. Typing `2,511` (thousands, no decimal) becomes `2.511`.
export const toDotDecimal = (value: string): string => {
	const lastComma = value.lastIndexOf(',')
	const lastDot = value.lastIndexOf('.')
	if (lastComma === -1 && lastDot === -1) return value

	const decimalAt = Math.max(lastComma, lastDot)
	const integer = value.slice(0, decimalAt).replace(/[.,]/g, '')
	const fraction = value.slice(decimalAt + 1).replace(/[^\d]/g, '')
	return `${integer}.${fraction}`
}

export const parseNumberValue = (
	value: string,
	maximumDecimals = 2,
): string => {
	value = toDotDecimal(value).replace(/[^\d.]/g, '')

	const dotIndex = value.indexOf('.')
	if (dotIndex !== -1) {
		value =
			value.slice(0, dotIndex + 1) +
			value.slice(dotIndex + 1).replace(/\./g, '')
	}

	const parts = value.split('.')
	if (parts.length > 1) {
		parts[1] = parts[1].slice(0, maximumDecimals)
		value = parts.join('.')
	}

	return value
}
