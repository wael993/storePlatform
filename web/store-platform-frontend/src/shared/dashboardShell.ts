import { startOfDay, startOfMonth } from 'date-fns'

/** Shell section ids for Tenant Dashboard (DASH-001). No KPI data here. */
export const DASHBOARD_SECTIONS = [
	'overview',
	'salesProfit',
	'inventory',
	'activity',
] as const

/** DASH-004 Overview cards — Coming Soon titles only, no values. */
export const OVERVIEW_KPI_IDS = [
	'products',
	'registeredCustomers',
	'newCustomers',
	'inventoryCost',
	'invoicesToday',
	'salesToday',
	'profit',
	'totalReceivable',
	'cashBalance',
] as const

export type OverviewKpiId = (typeof OVERVIEW_KPI_IDS)[number]

/** DASH-005 Sales & Profit charts — Coming Soon mocks via ECharts. */
export const SALES_PROFIT_CHART_IDS = [
	'salesByCategory',
	'salesByMonth',
	'salesProfit7Days',
] as const

export type SalesProfitChartId = (typeof SALES_PROFIT_CHART_IDS)[number]

/** DASH-006 Product & Inventory list cards — Coming Soon mocks. */
export const INVENTORY_CARD_IDS = [
	'inventoryWarnings',
	'bestProfitProducts',
	'bestSellerProducts',
] as const

export type InventoryCardId = (typeof INVENTORY_CARD_IDS)[number]

/** DASH-008 Activity cards — Coming Soon mocks. */
export const ACTIVITY_CARD_IDS = ['recentActivity', 'teamActivity'] as const

export type ActivityCardId = (typeof ACTIVITY_CARD_IDS)[number]

export type DashboardShellStatus = 'loading' | 'empty' | 'error' | 'ready'

/** Shell has no data source yet — always ready with empty KPI slots. */
export const resolveDashboardShellStatus = (): DashboardShellStatus => 'ready'

/** DASH-002 date defaults: first day of current month → today. */
export const getDashboardDefaultDateRange = (now = new Date()) => ({
	dateFrom: startOfMonth(now),
	dateTo: startOfDay(now),
})
