export enum UserRole {
	SUPER_ADMIN = 'super_admin',
	OWNER = 'owner',
	ADMIN = 'admin',
	CASHIER = 'cashier',
	EMPLOYEE = 'employee',
}

export enum DailyActionType {
	BUYING_ENTRY = 'BUYING_ENTRY',
	SELLING_ENTRY = 'SELLING_ENTRY',
	PAYMENT_ENTRY = 'PAYMENT_ENTRY',
	RECEIPT_ENTRY = 'RECEIPT_ENTRY',
	EXPENSE_ENTRY = 'EXPENSE_ENTRY',
	EMPLOYEE_COST = 'EMPLOYEE_COST',
	OTHER_COST = 'OTHER_COST',
}

export enum AllowedActions {
	// PRODUCT
	ADD_PRODUCT = 'addProduct',
	DELETE_PRODUCT = 'deleteProduct',

	SEE_NOTIFICATIONS = 'seeNotifications',

	// WHOLESALE PRICE
	SEE_WHOLESALE_PRICE = 'seeWholesalePrice',
	CAN_EDIT_WHOLESALE_PRICE = 'canEditWholesalePrice',

	// REPORT
	SEE_REPORT = 'seeReport',
	ADD_REPORT = 'addReport',
	EDIT_REPORT = 'editReport',
	DELETE_REPORT = 'deleteReport',

	// BUY COST
	SEE_BUY_COST = 'seeBuyCost',
	CAN_EDIT_BUY_COST = 'canEditBuyCost',

	// SUPPLIER
	SEE_SUPPLIER = 'seeSupplier',
	CAN_ADD_SUPPLIER = 'canAddSupplier',
	CAN_EDIT_SUPPLIER = 'canEditSupplier',
	CAN_DELETE_SUPPLIER = 'canDeleteSupplier',
	// CUSTOMER
	SEE_CUSTOMER = 'seeCustomer',
	CAN_ADD_CUSTOMER = 'canAddCustomer',
	CAN_EDIT_CUSTOMER = 'canEditCustomer',
	CAN_DELETE_CUSTOMER = 'canDeleteCustomer',

	// PARTNER
	SEE_PARTNER = 'seePartner',
	CAN_ADD_PARTNER = 'canAddPartner',
	CAN_EDIT_PARTNER = 'canEditPartner',
	CAN_DELETE_PARTNER = 'canDeletePartner',
}
export enum Breakpoints {
	MOBILE = 'mobile',
	TABLET = 'tablet',
	DESKTOP = 'desktop',
	LARGE_DESKTOP = 'large_desktop',
}

export enum TargetType {
	CUSTOMER = 'CUSTOMER', //زبون
	CATEGORY = 'CATEGORY', //فئة
	SUPPLIER = 'SUPPLIER', //مورد
	PARTNER = 'PARTNER', //شريك
	PROJECT = 'PROJECT',
	PRODUCT = 'PRODUCT', //منتج
}

export enum BreadCrumbItem {
	SETTINGS = 'settings',
	PRODUCTS = 'products',
	PRODUCT = 'product',
	PROJECTS = 'projects',
	PROJECT = 'project',
	SELLING_INVOICES = 'sellingInvoices',
	USERS = 'users',
	ADD_NEW_TENANT = 'addNewTenant',
	TENANTS_LIST = 'tenantsList',
	RENEWAL_REQUESTS = 'renewalRequests',
	NEWSROOM = 'newsroom',
	NEWSROOM_RELEASE_NOTES = 'newsroomReleaseNotes',
	NEWSROOM_RELEASE_NOTE_EDITOR = 'newsroomReleaseNoteEditor',
	NEWSROOM_SETTINGS = 'newsroomSettings',
	CUSTOMERS = 'customers',
	CUSTOMER = 'customer',
	CATEGORIES = 'categories',
	SUPPLIERS = 'suppliers',
	SUPPLIER = 'supplier',
	PARTNERS = 'partners',
	PARTNER = 'partner',
	EMPLOYEES = 'employees',
	EMPLOYEE = 'employee',
	REPORTS = 'reports',
	DASHBOARD = 'dashboard',
	CASH_ACCOUNT_HISTORY = 'cashAccountHistory',
}

export enum AddQuickStateEnum {
	PRODUCT = 'product',
	CURRENCY = 'currency',
	SUPPLIER = 'supplier',
	CUSTOMER = 'customer',
	PARTNER = 'partner',
	PROJECT = 'project',
	UNIT = 'unit',
	EXPENSE = 'expense',
	CATEGORY = 'category',
	BRAND = 'brand',
	SHELF = 'shelf',
	WAREHOUSE = 'warehouse',
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

export enum PricingLabelsType {
	RETAIL_PRICE = 'retailPrice',
	WHOLESALE_PRICE = 'wholesalePrice',
	SEMI_WHOLESALE_PRICE = 'semiWholesalePrice',
}
export enum InvoiceUiStatus {
	DRAFT = 'draft',
	CANCELLED = 'cancelled',
	PAID = 'paid',
	PARTIAL = 'partial',
	CREDIT = 'credit',
}
