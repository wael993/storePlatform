import { describe, expect, it, vi } from 'vitest'

import SettingController from '../apis/setting/api.controller'
import { SEE } from '../shared/seeCatalog'
import { ensureSeeIds } from '../shared/seePermissions'
import type { RequestContext } from '../shared/types'

vi.mock('../shared/seePermissions', async original => ({
	...(await original<typeof import('../shared/seePermissions')>()),
	ensureSeeIds: vi.fn(async () => {
		throw new Error('Role cannot see this.')
	}),
}))

// The server must refuse what the UI hides: a cashier without the settings
// tab cannot change rates or "allow oversell" through the API (REST or sync).
describe('settings writes check SEE before writing', () => {
	const ctx = {
		tenantId: 't-1',
		role: 'cashier',
		userId: 'u-1',
	} as RequestContext
	const controller = new SettingController({} as never, {} as never)

	it('currency settings need settings.currencies', async () => {
		await expect(
			controller.applyCurrencySettingsUpdate(ctx, { secondaryCurrencies: [] }),
		).rejects.toThrow('Role cannot see this.')

		expect(ensureSeeIds).toHaveBeenLastCalledWith(ctx, [SEE.settingsCurrencies])
	})

	it('invoice settings need settings.invoice', async () => {
		await expect(
			controller.applyInvoiceSettingsUpdate(ctx, { allowOversell: true }),
		).rejects.toThrow('Role cannot see this.')

		expect(ensureSeeIds).toHaveBeenLastCalledWith(ctx, [SEE.settingsInvoice])
	})
})
