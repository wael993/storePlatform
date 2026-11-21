import { describe, expect, it } from 'vitest'

import { buildInvoiceIssuedAtIso } from '../shared/dateUtils'
import { filterDailyActionsByParams } from '../offline/dailyActionFilters'
import { DailyActionType } from '../shared/globalEnums'

describe('entry invoiceDate matches invoice issuedAt day', () => {
	it('builds ISO from local wall-clock date+time like invoice issuedAt', () => {
		const iso = buildInvoiceIssuedAtIso('2026-09-19', '01:15')
		const parsed = new Date(iso)

		expect(parsed.getFullYear()).toBe(2026)
		expect(parsed.getMonth()).toBe(8)
		expect(parsed.getDate()).toBe(19)
		expect(parsed.getHours()).toBe(1)
		expect(parsed.getMinutes()).toBe(15)
	})

	it('lists an entry saved at 01:15 Amman time under that Amman day, on any device', () => {
		// 01:15 on 19 Sep in Asia/Amman (UTC+3) is still 18 Sep in UTC.
		const issuedAt = '2026-09-18T22:15:00.000Z'
		const actions: DailyAction[] = [
			{
				actionId: 'e1',
				entryType: DailyActionType.RECEIPT_ENTRY,
				currencyId: 'primary',
				currencyName: 'SYP',
				invoiceDate: issuedAt,
				singleUnitPrice: '10',
			},
		]

		expect(
			filterDailyActionsByParams(actions, {
				invoiceDateFrom: '2026-09-19',
				invoiceDateTo: '2026-09-19',
			}),
		).toHaveLength(1)

		expect(
			filterDailyActionsByParams(actions, {
				invoiceDateFrom: '2026-09-18',
				invoiceDateTo: '2026-09-18',
			}),
		).toHaveLength(0)
	})
})
