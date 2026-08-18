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

export enum InvoiceStatus {
	DRAFT = 'draft',
	CONFIRMED = 'confirmed',
	PARTIAL = 'partial',
	PAID = 'paid',
	CANCELLED = 'cancelled',
	VOID = 'void',
	PENDING = 'pending',
}

export enum InvoicePaymentStatus {
	UNPAID = 'unpaid',
	PARTIAL = 'partial',
	PAID = 'paid',
}

export enum InvoicePaymentType {
	CASH = 'cash',
	CREDIT = 'credit',
	CARD = 'card',
}

export enum InvoiceUiStatus {
	DRAFT = 'draft',
	CANCELLED = 'cancelled',
	PAID = 'paid',
	PARTIAL = 'partial',
	CREDIT = 'credit',
}
