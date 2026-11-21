import { describe, expect, it } from 'vitest'
import {
	ACTIVITY_CARD_IDS,
	DASHBOARD_SECTIONS,
	getDashboardDefaultDateRange,
	INVENTORY_CARD_IDS,
	OVERVIEW_KPI_IDS,
	resolveDashboardShellStatus,
	SALES_PROFIT_CHART_IDS,
} from '../shared/dashboardShell'

describe('dashboardShell', () => {
	it('keeps the four dashboard sections in order', () => {
		expect([...DASHBOARD_SECTIONS]).toEqual([
			'overview',
			'salesProfit',
			'inventory',
			'activity',
		])
	})

	it('keeps the overview KPIs in order', () => {
		expect([...OVERVIEW_KPI_IDS]).toEqual([
			'products',
			'registeredCustomers',
			'newCustomers',
			'inventoryCost',
			'invoicesToday',
			'salesToday',
			'profit',
			'totalReceivable',
			'totalPayable',
			'cashBalance',
		])
	})

	it('keeps the three DASH-005 sales/profit charts in order', () => {
		expect([...SALES_PROFIT_CHART_IDS]).toEqual([
			'salesByCategory',
			'salesByMonth',
			'salesProfit7Days',
		])
	})

	it('keeps the three DASH-006 inventory cards in order', () => {
		expect([...INVENTORY_CARD_IDS]).toEqual([
			'inventoryWarnings',
			'bestProfitProducts',
			'bestSellerProducts',
		])
	})

	it('keeps the two DASH-008 activity cards in order', () => {
		expect([...ACTIVITY_CARD_IDS]).toEqual(['recentActivity', 'teamActivity'])
	})

	it('resolves shell status without inventing business data', () => {
		expect(resolveDashboardShellStatus()).toBe('ready')
	})

	it('defaults date range to first of the Amman month through Amman today', () => {
		// 25 Sep 12:00 in Asia/Amman (UTC+3)
		const { dateFrom, dateTo } = getDashboardDefaultDateRange(
			new Date('2026-09-25T09:00:00.000Z'),
		)
		expect(dateFrom).toEqual(new Date(2026, 8, 1))
		expect(dateTo).toEqual(new Date(2026, 8, 25))
	})

	it('starts the new month at Amman midnight, even when UTC is still in the old one', () => {
		// 00:30 on 1 Dec in Amman is 21:30 on 30 Nov in UTC
		const { dateFrom, dateTo } = getDashboardDefaultDateRange(
			new Date('2026-11-30T21:30:00.000Z'),
		)
		expect(dateFrom).toEqual(new Date(2026, 11, 1))
		expect(dateTo).toEqual(new Date(2026, 11, 1))
	})
})
