import {
	CustomerDocument,
	PartnerDocument,
	ProductAPI,
	SupplierDocument,
	TenantSummary,
} from '../../shared/types'
import { DailyActionType } from '../../shared/globalEnums'
import {
	Customer,
	CustomerDailyAction,
	CustomerResponse,
	DailyAction,
	EntryType,
	Partner,
	PartnerDailyAction,
	ProductDailyAction,
	Supplier,
} from '../../shared/types/api'
import { ITenant } from '../../models/Tenant'
import { resolveTenantAccessiblePages } from '../../shared/constants/tenantAccessiblePages'
import { getTenantPermissions } from '../../shared/Permissions'
import { toView } from '../../shared/subscription/persist'

export const filterProductRelatedActions = (
	actions: DailyAction[],
	product: Pick<ProductAPI, 'productId' | 'internalCode' | 'barcode' | 'name'>,
): DailyAction[] =>
	actions.filter(
		action =>
			action.entryType !== DailyActionType.EXPENSE_ENTRY &&
			action.entryType !== DailyActionType.PAYMENT_ENTRY &&
			action.entryType !== DailyActionType.RECEIPT_ENTRY &&
			(action.productId === product.productId ||
				action.productId === product.internalCode ||
				action.productId === product.barcode ||
				action.productName === product.name),
	)

export const groupInvoicesByPartyId = (
	invoices: unknown[],
	field: 'customerId' | 'supplierId',
): Map<string, Array<Record<string, unknown>>> => {
	const grouped = new Map<string, Array<Record<string, unknown>>>()

	for (const invoice of invoices) {
		if (!invoice || typeof invoice !== 'object' || Array.isArray(invoice)) {
			continue
		}

		const record = invoice as Record<string, unknown>
		const partyId = String(record[field] ?? '')

		if (!partyId) continue

		const existing = grouped.get(partyId)

		if (existing) {
			existing.push(record)
		} else {
			grouped.set(partyId, [record])
		}
	}

	return grouped
}

const samePartyId = (
	value: string | undefined,
	partyId: string,
	internalCode?: string,
) => value === partyId || (!!internalCode && value === internalCode)

/** Receipt and payment rows for one party. A payment to a customer is stored on supplierId; a receipt from a supplier is stored on customerId. */
export const partyEntryQuery = (
	ids: string[],
	fields: Array<'customerId' | 'supplierId' | 'partnerId'>,
) => ({
	entryType: {
		$in: [DailyActionType.RECEIPT_ENTRY, DailyActionType.PAYMENT_ENTRY],
	},
	$or: fields.map(field => ({ [field]: { $in: ids } })),
})

export const filterCustomerRelatedActions = (
	actions: CustomerDailyAction[],
	customer: Pick<CustomerDocument, 'customerId' | 'internalCode'>,
): CustomerDailyAction[] =>
	actions.filter(
		action =>
			action.entryType !== DailyActionType.BUYING_ENTRY &&
			(samePartyId(
				action.customerId,
				customer.customerId,
				customer.internalCode,
			) ||
				(action.entryType === DailyActionType.PAYMENT_ENTRY &&
					samePartyId(
						action.supplierId,
						customer.customerId,
						customer.internalCode,
					))),
	)

export const filterSupplierRelatedActions = (
	actions: DailyAction[],
	supplier: Pick<SupplierDocument, 'supplierId' | 'internalCode'>,
): DailyAction[] =>
	actions.filter(
		action =>
			samePartyId(
				action.supplierId,
				supplier.supplierId,
				supplier.internalCode,
			) ||
			(action.entryType === DailyActionType.RECEIPT_ENTRY &&
				samePartyId(
					action.customerId,
					supplier.supplierId,
					supplier.internalCode,
				)),
	)

export const filterPartnerRelatedActions = (
	actions: PartnerDailyAction[],
	partner: Pick<PartnerDocument, 'partnerId' | 'internalCode' | 'name'>,
): PartnerDailyAction[] =>
	actions.filter(
		action =>
			action.entryType !== DailyActionType.BUYING_ENTRY &&
			action.entryType !== DailyActionType.SELLING_ENTRY &&
			action.entryType !== DailyActionType.EXPENSE_ENTRY &&
			(action.partnerId === partner.partnerId ||
				action.partnerName === partner.name ||
				action.partnerId === partner.internalCode),
	)

export const mapProductAction = (action: DailyAction): ProductDailyAction => ({
	actionId: action.actionId,
	entryType: action.entryType,
	productId: action.productId,
	invoiceNumber: action.invoiceNumber,
	invoiceDate: action.invoiceDate,
	productName: action.productName,
	supplierId: action.supplierId,
	supplierName: action.supplierName,
	customerId: action.customerId,
	customerName: action.customerName,
	currencyId: action.currencyId,
	currencyName: action.currencyName,
	unitId: action.unitId,
	unitName: action.unitName,
	weight: action.weight,
	singleUnitPrice: action.singleUnitPrice,
	totalPrice: action.totalPrice,
	note: action.note,
})

export const mapPartners = (partners: Partner[]) => {
	const mappedPartners = partners.map(partner => {
		const actions = partner.partnerEntries ?? []

		return {
			partnerId: partner.partnerId,
			name: partner.name,
			internalCode: partner.internalCode,
			createdAt: partner.createdAt,
			updatedAt: partner.updatedAt,
			createdBy: partner.createdBy,
			updatedBy: partner.updatedBy,
			partnerEntries: actions.map(action => ({
				actionId: action.actionId,
				entryType: action.entryType as Partial<
					EntryType | 'PAYMENT_ENTRY' | 'RECEIPT_ENTRY'
				>,
				invoiceNumber: action.invoiceNumber,
				invoiceDate: action.invoiceDate,
				partnerId: action.partnerId,
				partnerName: action.partnerName,
				currencyId: action.currencyId,
				currencyName: action.currencyName,
				singleUnitPrice: action.singleUnitPrice,
				totalPrice: action.totalPrice,
				note: action.note,
			})),
		}
	})

	return mappedPartners
}

export const mapCustomerAction = (
	action: CustomerDailyAction,
): CustomerDailyAction => ({
	actionId: action.actionId,
	entryType: action.entryType,
	productId: action.productId,
	invoiceNumber: action.invoiceNumber,
	invoiceDate: action.invoiceDate,
	productName: action.productName,
	supplierId: action.supplierId,
	supplierName: action.supplierName,
	customerId: action.customerId,
	customerName: action.customerName,
	currencyId: action.currencyId,
	currencyName: action.currencyName,
	unitId: action.unitId,
	unitName: action.unitName,
	weight: action.weight,
	singleUnitPrice: action.singleUnitPrice,
	totalPrice: action.totalPrice,
	note: action.note,
})

export const mapCustomers = (customers: Customer[]): CustomerResponse[] =>
	customers.map(customer => ({
		customerId: customer.customerId,
		name: customer.name,
		internalCode: customer.internalCode,
		createdAt: customer.createdAt,
		updatedAt: customer.updatedAt,
		totalReceivable: customer.totalReceivable ?? 0,
		createdBy: customer.createdBy,
		updatedBy: customer.updatedBy,
		customerEntries: (customer.customerEntries ?? []).map(mapCustomerAction),
	}))

export const mapCustomer = (
	customer: CustomerDocument,
	customerEntries: CustomerDailyAction[] = [],
	totalReceivable = 0,
): CustomerResponse => ({
	customerId: customer.customerId,
	name: customer.name,
	internalCode: customer.internalCode,
	createdAt: customer.createdAt?.toISOString(),
	updatedAt: customer.updatedAt?.toISOString(),
	totalReceivable,
	createdBy: customer.createdBy
		? {
				_id: customer.createdBy._id,
				displayName: customer.createdBy.displayName,
				createdAt: customer.createdAt?.toISOString() ?? '',
			}
		: undefined,
	updatedBy: customer.updatedBy
		? {
				_id: customer.updatedBy._id,
				displayName: customer.updatedBy.displayName,
				updatedAt: customer.updatedBy.updatedAt?.toISOString(),
			}
		: undefined,
	customerEntries: customerEntries.map(mapCustomerAction),
})

export const mapSuppliers = (suppliers: Supplier[]) => {
	const mappedSuppliers = suppliers.map(supplier => {
		const actions = supplier.actions ?? []

		return {
			supplierId: supplier.supplierId,
			name: supplier.name,
			internalCode: supplier.internalCode,
			createdAt: supplier.createdAt,
			updatedAt: supplier.updatedAt,
			totalPayable: supplier.totalPayable ?? 0,
			createdBy: supplier.createdBy,
			updatedBy: supplier.updatedBy,
			supplierEntries: actions.map(action => ({
				actionId: action.actionId,
				entryType: action.entryType,
				productId: action.productId,
				invoiceNumber: action.invoiceNumber,
				invoiceDate: action.invoiceDate,
				productName: action.productName,
				supplierId: action.supplierId,
				supplierName: action.supplierName,
				customerId: action.customerId,
				customerName: action.customerName,
				currencyId: action.currencyId,
				currencyName: action.currencyName,
				unitId: action.unitId,
				unitName: action.unitName,
				weight: action.weight,
				singleUnitPrice: action.singleUnitPrice,
				totalPrice: action.totalPrice,
				note: action.note,
			})),
		}
	})

	return mappedSuppliers
}

export const mapDailyAction = (dailyAction: DailyAction) => {
	return {
		actionId: dailyAction.actionId,
		entryType: dailyAction.entryType,
		productId: dailyAction.productId,
		invoiceNumber: dailyAction.invoiceNumber,
		invoiceDate: dailyAction.invoiceDate,
		productName: dailyAction.productName,
		supplierId: dailyAction.supplierId,
		supplierName: dailyAction.supplierName,
		partnerId: dailyAction.partnerId,
		partnerName: dailyAction.partnerName,
		customerId: dailyAction.customerId,
		customerName: dailyAction.customerName,
		expenseId: dailyAction.expenseId,
		expenseName: dailyAction.expenseName,
		currencyId: dailyAction.currencyId,
		currencyName: dailyAction.currencyName,
		exchangeRateToPrimary: dailyAction.exchangeRateToPrimary,
		cashAccountType: dailyAction.cashAccountType,
		unitId: dailyAction.unitId,
		unitName: dailyAction.unitName,
		weight: dailyAction.weight,
		singleUnitPrice: dailyAction.singleUnitPrice,
		totalPrice: dailyAction.totalPrice,
		note: dailyAction.note,
	}
}

export const mapTenantSummary = (tenant: ITenant): TenantSummary => {
	return {
		tenantId: tenant.tenantId,
		name: tenant.name,
		domain: tenant.domain,
		status: tenant.status,
		accessiblePages: resolveTenantAccessiblePages(tenant),
		offlineEnabled: tenant.offlineEnabled !== false,
		invoiceAiMonthlyLimit: tenant.invoiceAi?.monthlyLimit ?? null,
		subscription: tenant.subscription ? toView(tenant.subscription) : null,
		createdAt: tenant.createdAt,
		updatedAt: tenant.updatedAt,
		permissions: getTenantPermissions(tenant),
	}
}
