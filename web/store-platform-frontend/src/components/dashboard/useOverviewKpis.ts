import { format } from 'date-fns'
import {
	useGetCurrencySettingsQuery,
	useGetCustomersQuery,
	useGetInventoryQuery,
	useGetProductsQuery,
	useGetSellingInvoicesQuery,
	useGetSuppliersQuery,
} from '../../api/apiStore'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'
import { formatNumber } from '../../shared/utils'
import {
	combineSideStatus,
	countCreatedInRange,
	countPostedInvoices,
	splitPartyBalances,
	sumInventoryCost,
} from './overviewKpis'

export type OverviewKpiStatus =
	'loading' | 'offline' | 'unavailable' | 'error' | 'ready'

type QueryState = {
	isLoading: boolean
	isFetching: boolean
	isError: boolean
	data?: unknown
}

const queryStatus = (
	allowed: boolean,
	query: QueryState,
): OverviewKpiStatus => {
	if (!allowed) return 'unavailable'
	if (query.isLoading || (query.isFetching && query.data == null))
		return 'loading'
	if (query.isError) return 'error'
	if (query.data == null) return 'unavailable'
	return 'ready'
}

export const useOverviewKpis = (dateFrom: Date, dateTo: Date) => {
	const { canSee } = useSee()
	const canProducts = canSee(SEE.products)
	const canCustomers = canSee(SEE.customers)
	const canSuppliers = canSee(SEE.supplier)
	const canReceivable = canSee(SEE.customersTotalReceivable)
	const canPayable = canSee(SEE.suppliersTotalPayable)
	const canCost = canSee(SEE.productsBuyingPrice)
	const canInvoices = canSee(SEE.sellingInvoices)
	const canCustomerBalances = canCustomers && canReceivable
	const canSupplierBalances = canSuppliers && canPayable

	const productsQuery = useGetProductsQuery(
		{ limit: 1 },
		{ skip: !canProducts, refetchOnMountOrArgChange: false },
	)
	const customersQuery = useGetCustomersQuery(undefined, {
		skip: !canCustomers,
		refetchOnMountOrArgChange: false,
	})
	const suppliersQuery = useGetSuppliersQuery(
		{},
		{
			skip: !canSupplierBalances,
			refetchOnMountOrArgChange: false,
		},
	)
	const inventoryQuery = useGetInventoryQuery(undefined, {
		skip: !canCost,
		refetchOnMountOrArgChange: false,
	})
	const todayKey = format(new Date(), 'yyyy-MM-dd')
	const invoicesQuery = useGetSellingInvoicesQuery(
		{ issuedDate: todayKey },
		{ skip: !canInvoices, refetchOnMountOrArgChange: false },
	)
	const { data: currencySettings } = useGetCurrencySettingsQuery(undefined, {
		skip: !canCost && !canCustomerBalances && !canSupplierBalances,
		refetchOnMountOrArgChange: false,
	})

	const customers = customersQuery.data ?? []
	const balances = splitPartyBalances(
		canCustomerBalances ? customers : [],
		canSupplierBalances ? (suppliersQuery.data ?? []) : [],
	)
	const inventoryCost = sumInventoryCost(inventoryQuery.data ?? [])
	const currencyLabel =
		currencySettings?.primaryCurrency?.internalCode ||
		currencySettings?.primaryCurrency?.name ||
		''

	const formatMoney = (amount: number) => {
		const formatted = formatNumber(amount) ?? String(amount)
		return currencyLabel ? `${formatted} ${currencyLabel}` : formatted
	}

	const balanceStatus = combineSideStatus([
		canCustomerBalances ? queryStatus(true, customersQuery) : null,
		canSupplierBalances ? queryStatus(true, suppliersQuery) : null,
	])

	return {
		formatMoney,
		products: {
			status: queryStatus(canProducts, productsQuery),
			amount: productsQuery.data?.totalCount ?? 0,
		},
		registeredCustomers: {
			status: queryStatus(canCustomers, customersQuery),
			amount: customers.length,
		},
		newCustomers: {
			status: queryStatus(canCustomers, customersQuery),
			amount: countCreatedInRange(
				customers.map(customer => customer.createdAt),
				dateFrom,
				dateTo,
			),
		},
		inventoryCost: {
			status: queryStatus(canCost, inventoryQuery),
			amount: inventoryCost.total,
			partial: inventoryCost.partial,
		},
		invoicesToday: {
			status: queryStatus(canInvoices, invoicesQuery),
			amount: countPostedInvoices(
				(invoicesQuery.data?.invoices ?? []).map(invoice => invoice.status),
			),
		},
		owedToUs: { status: balanceStatus, amount: balances.owedToUs },
		weOwe: { status: balanceStatus, amount: balances.weOwe },
	}
}
