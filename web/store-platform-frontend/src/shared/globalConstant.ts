import { AddQuickStateEnum } from './globalEnums'

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
}
