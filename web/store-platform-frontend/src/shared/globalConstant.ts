import {
	AddQuickStateEnum,
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
	InvoiceUiStatus,
} from './globalEnums'

export const ENTRY_TYPE_LABELS_MAP: Record<string, string> = {
	BUYING_ENTRY: 'common.buyingEntry',
	SELLING_ENTRY: 'common.sellingEntry',
	PAYMENT_ENTRY: 'common.paymentEntry',
	RECEIPT_ENTRY: 'common.receiptEntry',
	EXPENSE_ENTRY: 'common.expenseEntry',
}

export const MODAL_CONFIG = {
	[AddQuickStateEnum.PRODUCT]: {
		title: 'components.daily.addQuickProduct',
		label: 'components.daily.productName',
		code: 'components.daily.productCode',
		placeholder: 'components.daily.productName',
		inputType: 'text' as InputType,
		buttonText: 'components.daily.addProduct',
	},
	[AddQuickStateEnum.CURRENCY]: {
		title: 'components.daily.addQuickCurrency',
		label: 'components.daily.currencyName',
		code: 'components.daily.currencyCode',
		placeholder: 'components.daily.currencyName',
		inputType: 'text' as InputType,
		buttonText: 'components.daily.addCurrency',
	},
	[AddQuickStateEnum.SUPPLIER]: {
		title: 'components.daily.addQuickSupplier',
		label: 'components.daily.supplierName',
		code: 'components.daily.supplierCode',
		placeholder: 'components.daily.supplierName',
		inputType: 'text' as InputType,
		buttonText: 'components.daily.addSupplier',
	},
	[AddQuickStateEnum.CUSTOMER]: {
		title: 'components.daily.addQuickCustomer',
		label: 'components.daily.customerName',
		code: 'components.daily.customerCode',
		placeholder: 'components.daily.customerName',
		inputType: 'text' as InputType,
		buttonText: 'components.daily.addCustomer',
	},
	[AddQuickStateEnum.UNIT]: {
		title: 'components.daily.addQuickUnit',
		label: 'components.daily.unitName',
		code: 'components.daily.unitCode',
		placeholder: 'components.daily.unitName',
		inputType: 'text' as InputType,
		buttonText: 'components.daily.addUnit',
	},
	[AddQuickStateEnum.EXPENSE]: {
		title: 'components.daily.addQuickExpense',
		label: 'components.daily.expenseName',
		code: 'components.daily.expenseCode',
		placeholder: 'components.daily.expenseName',
		inputType: 'text' as InputType,
		buttonText: 'components.daily.addExpense',
	},
	[AddQuickStateEnum.PARTNER]: {
		title: 'components.partner.addPartner',
		label: 'components.partner.partnerName',
		code: 'components.partner.partnerCode',
		placeholder: 'components.partner.partnerName',
		inputType: 'text' as InputType,
		buttonText: 'components.partner.addPartner',
	},
	[AddQuickStateEnum.CATEGORY]: {
		title: 'components.quickAdd.addQuickCategory',
		label: 'components.filters.category',
		code: 'components.filters.category',
		placeholder: 'components.filters.category',
		inputType: 'text' as InputType,
		buttonText: 'common.addCategory',
		hideCodeField: true,
	},
	[AddQuickStateEnum.BRAND]: {
		title: 'components.quickAdd.addQuickBrand',
		label: 'components.filters.brand',
		code: 'components.filters.brand',
		placeholder: 'components.filters.brand',
		inputType: 'text' as InputType,
		buttonText: 'components.quickAdd.addBrand',
		hideCodeField: true,
	},
	[AddQuickStateEnum.SHELF]: {
		title: 'components.quickAdd.addQuickShelf',
		label: 'productModal.shelf',
		code: 'components.quickAdd.shelfCode',
		placeholder: 'productModal.shelf',
		inputType: 'text' as InputType,
		buttonText: 'components.quickAdd.addShelf',
	},
	[AddQuickStateEnum.WAREHOUSE]: {
		title: 'components.quickAdd.addQuickWarehouse',
		label: 'productModal.warehouse',
		code: 'components.quickAdd.warehouseCode',
		placeholder: 'productModal.warehouse',
		inputType: 'text' as InputType,
		buttonText: 'components.quickAdd.addWarehouse',
	},
}

export const mapApiInvoiceStatusToUi = (invoice: {
	status?: string
	paymentType?: string
	paymentStatus?: string
}): InvoiceUiStatus => {
	if (invoice.status === InvoiceStatus.DRAFT) return InvoiceUiStatus.DRAFT

	if (invoice.status === InvoiceStatus.CANCELLED) {
		return InvoiceUiStatus.CANCELLED
	}

	if (
		invoice.status === InvoiceStatus.PAID ||
		invoice.paymentStatus === InvoicePaymentStatus.PAID
	) {
		return InvoiceUiStatus.PAID
	}

	if (
		invoice.status === InvoiceStatus.PARTIAL ||
		invoice.paymentStatus === InvoicePaymentStatus.PARTIAL
	) {
		return InvoiceUiStatus.PARTIAL
	}

	if (invoice.paymentType === InvoicePaymentType.CREDIT) {
		return InvoiceUiStatus.CREDIT
	}

	return InvoiceUiStatus.PAID
}
