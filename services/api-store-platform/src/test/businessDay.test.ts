import { describe, expect, it } from 'vitest'

import {
	businessDayEnd,
	businessDayKey,
	businessDayStart,
	isValidTimeZone,
	toBusinessDayKey,
} from '../shared/store-domain'

const AMMAN = 'Asia/Amman'
const BERLIN = 'Europe/Berlin'

describe('business day', () => {
	it('puts 01:30 in Amman on the Amman day, not the UTC day before', () => {
		const savedAtOneThirtyAmman = new Date('2026-11-20T22:30:00.000Z')

		expect(businessDayKey(savedAtOneThirtyAmman, AMMAN)).toBe('2026-11-21')
	})

	it('spans an Amman day from local midnight to the last millisecond', () => {
		expect(businessDayStart('2026-11-21', AMMAN).toISOString()).toBe(
			'2026-11-20T21:00:00.000Z',
		)

		expect(businessDayEnd('2026-11-21', AMMAN).toISOString()).toBe(
			'2026-11-21T20:59:59.999Z',
		)
	})

	it('follows daylight saving days in another configured zone', () => {
		// 23-hour day (clocks forward) and 25-hour day (clocks back)
		expect(businessDayStart('2026-03-29', BERLIN).toISOString()).toBe(
			'2026-03-28T23:00:00.000Z',
		)

		expect(businessDayEnd('2026-03-29', BERLIN).toISOString()).toBe(
			'2026-03-29T21:59:59.999Z',
		)

		expect(businessDayStart('2026-10-25', BERLIN).toISOString()).toBe(
			'2026-10-24T22:00:00.000Z',
		)

		expect(businessDayEnd('2026-10-25', BERLIN).toISOString()).toBe(
			'2026-10-25T22:59:59.999Z',
		)
	})

	it('reads a day key as-is, a full date as its business day, and refuses garbage', () => {
		expect(toBusinessDayKey(' 2026-11-21 ', AMMAN)).toBe('2026-11-21')
		expect(toBusinessDayKey('2026-11-20T22:30:00.000Z', AMMAN)).toBe(
			'2026-11-21',
		)

		expect(toBusinessDayKey('not a date', AMMAN)).toBeUndefined()
		expect(toBusinessDayKey('  ', AMMAN)).toBeUndefined()
		expect(toBusinessDayKey(undefined, AMMAN)).toBeUndefined()
	})

	it('accepts real IANA zones only', () => {
		expect(isValidTimeZone(AMMAN)).toBe(true)
		expect(isValidTimeZone('Amman/Asia')).toBe(false)
	})
})
