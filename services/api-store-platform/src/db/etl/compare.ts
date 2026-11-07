import { isDeepStrictEqual } from 'util'

/** JSON-shaped comparison helpers for `api:diff` and `pg:etl --verify`. */

/** JSON round trip (Dates → ISO, ObjectId → hex), keys sorted, `ignore` keys dropped at any depth. */
export const normalize = (
	value: unknown,
	ignore: ReadonlySet<string> = new Set(),
): unknown => {
	const walk = (item: unknown): unknown => {
		if (Array.isArray(item)) return item.map(walk)

		if (item && typeof item === 'object') {
			return Object.fromEntries(
				Object.entries(item as Record<string, unknown>)
					.filter(([key]) => !ignore.has(key))
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([key, child]) => [key, walk(child)]),
			)
		}

		return item
	}

	return walk(JSON.parse(JSON.stringify(value ?? null)))
}

/** Arrays sorted too: equal here but not in `normalize` = order-only difference. */
export const sortDeep = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value
			.map(sortDeep)
			.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([k, v]) => [
				k,
				sortDeep(v),
			]),
		)
	}

	return value
}

/** First path where a and b differ, for reports. */
export const firstDiff = (a: unknown, b: unknown, at = '$'): string | null => {
	if (isDeepStrictEqual(a, b)) return null

	if (a && b && typeof a === 'object' && typeof b === 'object') {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)])

		for (const key of keys) {
			const found = firstDiff(
				(a as Record<string, unknown>)[key],
				(b as Record<string, unknown>)[key],
				`${at}.${key}`,
			)

			if (found) return found
		}
	}

	return `${at}: ${JSON.stringify(a)?.slice(0, 120)} ≠ ${JSON.stringify(b)?.slice(0, 120)}`
}

/**
 * Numbers to `digits` significant digits: hides double-precision noise (Mongo
 * summed doubles, Postgres sums exactly) without hiding a real money difference.
 */
export const roundFloats = (value: unknown, digits = 12): unknown => {
	if (typeof value === 'number') return Number(value.toPrecision(digits))

	if (Array.isArray(value)) return value.map(item => roundFloats(item, digits))

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([k, v]) => [
				k,
				roundFloats(v, digits),
			]),
		)
	}

	return value
}
