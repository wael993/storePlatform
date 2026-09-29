import { describe, expect, it } from 'vitest'

import { isOfflineCapableEndpoint } from '../offline/localHandlers'

describe('isOfflineCapableEndpoint', () => {
	it('marks cash-accounts as online-only', () => {
		expect(isOfflineCapableEndpoint('cash-accounts/balances')).toBe(false)
		expect(isOfflineCapableEndpoint('cash-accounts/transfers')).toBe(false)
		expect(isOfflineCapableEndpoint('cash-accounts/ledger?page=1')).toBe(
			false,
		)
		expect(isOfflineCapableEndpoint('daily-actions')).toBe(true)
	})
})
