import { describe, expect, it } from 'vitest'

import { isOfflineCapableEndpoint } from '../offline/localHandlers'

describe('isOfflineCapableEndpoint', () => {
	it('serves cash balances and transfers offline and keeps the ledger online', () => {
		expect(isOfflineCapableEndpoint('cash-accounts/balances')).toBe(true)
		expect(isOfflineCapableEndpoint('cash-accounts/transfers')).toBe(true)
		expect(isOfflineCapableEndpoint('cash-accounts/ledger?page=1')).toBe(false)
		expect(isOfflineCapableEndpoint('daily-actions')).toBe(true)
	})
})
