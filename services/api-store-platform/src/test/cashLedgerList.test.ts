import { describe, expect, it } from 'vitest'

import {
	clampLedgerLimit,
	clampLedgerPage,
	parseLedgerDateBound,
} from '../shared/cashAccounts/ledgerService'

describe('cash ledger list filters', () => {
	it('makes YYYY-MM-DD bounds inclusive of the whole day', () => {
		const from = parseLedgerDateBound('2026-09-01', false)
		const to = parseLedgerDateBound('2026-09-28', true)

		expect([from?.getHours(), from?.getMinutes()]).toEqual([0, 0])
		expect([to?.getHours(), to?.getMinutes(), to?.getMilliseconds()]).toEqual([
			23, 59, 999,
		])

		expect(parseLedgerDateBound('  ', false)).toBeUndefined()
		expect(parseLedgerDateBound('not a date', true)).toBeUndefined()
	})

	it('clamps page and limit', () => {
		expect(clampLedgerPage(0)).toBe(1)
		expect(clampLedgerPage('3')).toBe(3)
		expect(clampLedgerLimit(0)).toBe(1)
		expect(clampLedgerLimit(500)).toBe(100)
		expect(clampLedgerLimit(undefined)).toBe(50)
	})
})
