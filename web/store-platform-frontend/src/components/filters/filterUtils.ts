export const parsePastedValues = (rawValue: string): string[] => {
	const uniqueValues = new Set<string>()
	rawValue
		.split(/[;,\s\n]+/)
		.map(value => value.trim())
		.filter(Boolean)
		.forEach(value => uniqueValues.add(value))
	return Array.from(uniqueValues)
}
