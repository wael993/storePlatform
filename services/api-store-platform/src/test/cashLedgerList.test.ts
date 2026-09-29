import { describe, expect, it } from 'vitest'

import {
	buildCashLedgerListFilter,
	clampLedgerLimit,
	clampLedgerPage,
	parseLedgerDateBound,
} from '../shared/cashAccounts/ledgerService'

describe('cash ledger list filters', () => {
	it('returns null when no warehouses are in scope', () => {
		expect(buildCashLedgerListFilter({ warehouseIds: [] })).toBeNull()
		expect(buildCashLedgerListFilter({ warehouseIds: ['  '] })).toBeNull()
	})

	it('builds warehouse + optional filters with inclusive date bounds', () => {
		const filter = buildCashLedgerListFilter({
			warehouseIds: ['wh-1', ' wh-2 '],
			accountType: 'daily_cash',
			movementType: 'TRANSFER',
			dateFrom: '2026-09-01',
			dateTo: '2026-09-28',
		})

		expect(filter).toMatchObject({
			warehouseId: { $in: ['wh-1', 'wh-2'] },
			accountType: 'daily_cash',
			movementType: 'TRANSFER',
		})

		const createdAt = filter?.createdAt as { $gte: Date; $lte: Date }

		expect(createdAt.$gte).toEqual(parseLedgerDateBound('2026-09-01', false))
		expect(createdAt.$lte).toEqual(parseLedgerDateBound('2026-09-28', true))
		expect(createdAt.$gte.getHours()).toBe(0)
		expect(createdAt.$lte.getHours()).toBe(23)
	})

	it('clamps page and limit', () => {
		expect(clampLedgerPage(0)).toBe(1)
		expect(clampLedgerPage('3')).toBe(3)
		expect(clampLedgerLimit(0)).toBe(1)
		expect(clampLedgerLimit(500)).toBe(100)
		expect(clampLedgerLimit(undefined)).toBe(50)
	})
})
