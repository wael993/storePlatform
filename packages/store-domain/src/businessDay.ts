/**
 * One calendar day for the whole platform: a `YYYY-MM-DD` key means midnight to midnight
 * in the business time zone, whatever zone the server or the device runs in.
 * Server reads it from BUSINESS_TIME_ZONE, the web app from VITE_BUSINESS_TIME_ZONE.
 */
export const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Amman'

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_SECOND = 1000

export const isValidTimeZone = (timeZone: string): boolean => {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone })
		return true
	} catch {
		return false
	}
}

export const isDayKey = (value: string): boolean => DAY_KEY_PATTERN.test(value)

// Building a formatter is slow (~80 µs); lists call this once per invoice, so reuse one per zone.
const wallClockFormatters = new Map<string, Intl.DateTimeFormat>()

const wallClockFormatter = (timeZone: string): Intl.DateTimeFormat => {
	const cached = wallClockFormatters.get(timeZone)
	if (cached) return cached

	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})
	wallClockFormatters.set(timeZone, formatter)
	return formatter
}

const wallClockParts = (instant: Date, timeZone: string) => {
	const parts = wallClockFormatter(timeZone).formatToParts(instant)
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find(p => p.type === type)?.value)

	return {
		year: part('year'),
		month: part('month'),
		day: part('day'),
		hour: part('hour'),
		minute: part('minute'),
		second: part('second'),
	}
}

const pad2 = (value: number) => String(value).padStart(2, '0')

/** Business calendar day (`YYYY-MM-DD`) that this instant falls on. */
export const businessDayKey = (instant: Date, timeZone: string): string => {
	const { year, month, day } = wallClockParts(instant, timeZone)

	return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Day key as-is, any other parseable date as its business day; otherwise undefined. */
export const toBusinessDayKey = (
	value: string | undefined,
	timeZone: string,
): string | undefined => {
	const trimmed = value?.trim()

	if (!trimmed) return undefined
	if (isDayKey(trimmed)) return trimmed

	const instant = new Date(trimmed)

	return Number.isNaN(instant.getTime())
		? undefined
		: businessDayKey(instant, timeZone)
}

/** How far the zone's wall clock is ahead of UTC at this instant (DST-aware). */
const timeZoneOffsetMs = (instant: Date, timeZone: string): number => {
	const { year, month, day, hour, minute, second } = wallClockParts(
		instant,
		timeZone,
	)
	const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second)
	const instantToTheSecond =
		Math.floor(instant.getTime() / MS_PER_SECOND) * MS_PER_SECOND

	return wallClockAsUtc - instantToTheSecond
}

const dayKeyAsUtcMidnight = (dayKey: string): number => {
	const [year, month, day] = dayKey.split('-').map(Number)

	return Date.UTC(year, month - 1, day)
}

/** First instant of the business day. */
export const businessDayStart = (dayKey: string, timeZone: string): Date => {
	const midnightAsUtc = dayKeyAsUtcMidnight(dayKey)
	// Second pass picks up a DST change between UTC midnight and local midnight.
	const firstGuess =
		midnightAsUtc - timeZoneOffsetMs(new Date(midnightAsUtc), timeZone)

	return new Date(
		midnightAsUtc - timeZoneOffsetMs(new Date(firstGuess), timeZone),
	)
}

/** Last millisecond of the business day (inclusive bound, like the old 23:59:59.999). */
export const businessDayEnd = (dayKey: string, timeZone: string): Date => {
	const nextDay = new Date(
		dayKeyAsUtcMidnight(dayKey) + 24 * 60 * 60 * MS_PER_SECOND,
	)
	const nextDayKey = nextDay.toISOString().slice(0, 10)

	return new Date(businessDayStart(nextDayKey, timeZone).getTime() - 1)
}
