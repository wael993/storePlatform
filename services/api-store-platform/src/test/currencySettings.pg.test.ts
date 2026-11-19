import { randomUUID } from 'crypto'
import { afterAll, describe, expect, it, vi } from 'vitest'

import SettingController from '../apis/setting/api.controller'
import { closeDb } from '../db'
import { insertDoc } from '../db/docs'
import { Currency } from '../models/Currency'
import type { RequestContext } from '../shared/types'

vi.mock('../shared/seePermissions', async original => ({
	...(await original<typeof import('../shared/seePermissions')>()),
	ensureSeeIds: vi.fn(),
	ensureSeeForResource: vi.fn(),
}))

const enabled = Boolean(process.env.DATABASE_URL)
const actor = { _id: 'u-1', displayName: 'Ana', createdAt: new Date() }

describe.skipIf(!enabled)('currency settings (Postgres)', () => {
	afterAll(closeDb)

	it('stores each currency once when the same one is listed twice', async () => {
		const tenantId = `t-${randomUUID()}`
		const ctx = { tenantId, role: 'owner', userId: 'u-1' } as RequestContext
		const controller = new SettingController({} as never, {} as never)

		for (const [currencyId, name] of [
			['usd', 'USD'],
			['eur', 'EUR'],
		]) {
			await insertDoc(Currency, {
				_id: `${tenantId}-${currencyId}`,
				tenantId,
				currencyId,
				name,
				createdBy: actor,
			})
		}

		const item = (currencyId: string, name: string) => ({
			currencyId,
			name,
			exchangeRate: 1,
		})
		const saved = await controller.applyCurrencySettingsUpdate(ctx, {
			primaryCurrency: item('usd', 'USD') as never,
			secondaryCurrencies: [
				item('eur', 'EUR'),
				item('usd', 'USD'), // the primary again
				item('eur', 'EUR'), // listed twice
			] as never,
		})

		expect(saved.primaryCurrency?.currencyId).toBe('usd')
		expect(saved.secondaryCurrencies.map(c => c.currencyId)).toEqual(['eur'])
	})
})
