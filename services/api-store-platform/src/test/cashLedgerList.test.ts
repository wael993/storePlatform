import { describe, expect, it } from 'vitest'

import {
	clampLedgerLimit,
	clampLedgerPage,
	parseLedgerDateBound,
} from '../shared/cashAccounts/ledgerService'

describe('cash ledger list filters', () => {
	it('makes YYYY-MM-DD bounds inclusive of the whole business day (Asia/Amman)', () => {
		const from = parseLedgerDateBound('2026-09-01', false)
		const to = parseLedgerDateBound('2026-09-28', true)

		expect(from?.toISOString()).toBe('2026-08-31T21:00:00.000Z')
		expect(to?.toISOString()).toBe('2026-09-28T20:59:59.999Z')

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
