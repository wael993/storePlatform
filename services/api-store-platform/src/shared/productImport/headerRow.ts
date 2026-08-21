const uniqueNonEmpty = (texts: string[]): string[] => [
	...new Set(texts.map(text => text.trim()).filter(Boolean)),
]

export const isTitleRow = (texts: string[]): boolean =>
	uniqueNonEmpty(texts).length <= 1

export const findHeaderRowIndex = (rows: string[][]): number => {
	const headerIndex = rows.findIndex(row => uniqueNonEmpty(row).length >= 2)

	if (headerIndex >= 0) return headerIndex

	return rows.findIndex(row => uniqueNonEmpty(row).length === 1)
}
