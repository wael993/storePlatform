import {
	CustomerDocument,
	PartnerDocument,
	ProductAPI,
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

export const filterCustomerRelatedActions = (
	actions: CustomerDailyAction[],
	customer: Pick<CustomerDocument, 'customerId' | 'internalCode' | 'name'>,
): CustomerDailyAction[] =>
	actions.filter(
		action =>
			action.entryType !== DailyActionType.BUYING_ENTRY &&
			(action.customerId === customer.customerId ||
				action.customerId === customer.internalCode ||
				action.customerName === customer.name),
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
				action.partnerId === partner.internalCode ||
				action.partnerName === partner.name),
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
		const actions = partner.relatedActions ?? []

		return {
			partnerId: partner.partnerId,
			name: partner.name,
			internalCode: partner.internalCode,
			createdAt: partner.createdAt,
			updatedAt: partner.updatedAt,
			createdBy: partner.createdBy,
			updatedBy: partner.updatedBy,
			relatedActions: actions.map(action => ({
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
		customerId: customer.customerId ?? customer.internalCode ?? '',
		name: customer.name,
		internalCode: customer.internalCode,
		createdAt: customer.createdAt,
		updatedAt: customer.updatedAt,
		totalReceivable: customer.totalReceivable ?? 0,
		createdBy: customer.createdBy,
		updatedBy: customer.updatedBy,
		relatedActions: (customer.relatedActions ?? []).map(mapCustomerAction),
	}))

export const mapCustomer = (
	customer: CustomerDocument,
	relatedActions: CustomerDailyAction[] = [],
	totalReceivable = 0,
): CustomerResponse => ({
	customerId: customer.customerId ?? customer.internalCode ?? '',
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
	relatedActions: relatedActions.map(mapCustomerAction),
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
			relatedActions: actions.map(action => ({
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
		createdAt: tenant.createdAt,
		updatedAt: tenant.updatedAt,
		permissions: getTenantPermissions(tenant),
	}
}
