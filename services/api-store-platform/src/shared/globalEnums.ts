export enum DailyActionType {
	BUYING_ENTRY = 'BUYING_ENTRY',
	SELLING_ENTRY = 'SELLING_ENTRY',
	PAYMENT_ENTRY = 'PAYMENT_ENTRY',
	RECEIPT_ENTRY = 'RECEIPT_ENTRY',
	EXPENSE_ENTRY = 'EXPENSE_ENTRY',
}

export enum TargetType {
	PARTNER = 'partner',
	SUPPLIER = 'supplier',
	CUSTOMER = 'customer',
	PRODUCT = 'product',
	DAILY_ACTION = 'dailyAction',
}
