import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../store/store', () => ({
	default: { getState: () => ({ frontendResources: { see: [] } }) },
}))

import { offlineDb, setSyncMeta, SYNC_META_KEYS } from '../offline/db'
import { handleOfflineQuery } from '../offline/localHandlers'
import {
	readOfflineCashBalances,
	rememberCashBalances,
} from '../offline/offlineCashBalances'
import { setWarehouseScopeIds } from '../shared/warehouseScope'

const exchange = (fromAmount: number, exchangeId: string) =>
	handleOfflineQuery({
		url: 'cash-accounts/exchanges',
		method: 'POST',
		body: {
			accountType: 'daily_cash',
			fromCurrencyId: 'eur',
			toCurrencyId: 'usd',
			fromAmount,
			toAmount: fromAmount * 1.08,
			fromExchangeRateToPrimary: 1,
			toExchangeRateToPrimary: 1.08,
			exchangeId,
		},
	})

describe('offline cash exchange', () => {
	beforeEach(async () => {
		await offlineDb.delete()
		await offlineDb.open()
		await setSyncMeta(SYNC_META_KEYS.sessionTenantId, 'tenant-1')
		setWarehouseScopeIds(['w1'])
		await rememberCashBalances({
			accounts: [
				{ type: 'daily_cash', name: 'Daily', balances: { eur: 100, usd: 500 } },
			],
			totals: { eur: 100, usd: 500 },
		})
	})

	it('chains pending exchanges on the local snapshot (no double spend)', async () => {
		expect(await exchange(80, 'ex-1')).toHaveProperty('data')
		expect(await exchange(80, 'ex-2')).toHaveProperty('error')

		const pending = await offlineDb.outbox.toArray()
		expect(pending).toHaveLength(1)
		expect(pending[0]).toMatchObject({
			entity: 'cashExchange',
			payload: { warehouseId: 'w1', exchangeId: 'ex-1', toAmount: 86.4 },
		})

		const balances = await readOfflineCashBalances([])
		expect(balances?.accounts[0].balances).toEqual({ eur: 20, usd: 586.4 })
	})
})
