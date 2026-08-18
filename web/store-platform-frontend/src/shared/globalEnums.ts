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
}

export enum AllowedActions {
	// PRODUCT
	ADD_PRODUCT = 'addProduct',
	DELETE_PRODUCT = 'deleteProduct',

	// DAILY ACTION
	SEE_DAILY_ACTION = 'seeDailyAction',
	CAN_ADD_DAILY_ACTION = 'addDailyAction',
	CAN_EDIT_DAILY_ACTION = 'editDailyAction',
	CAN_DELETE_DAILY_ACTION = 'deleteDailyAction',

	//BUDGET OVERVIEW
	CAN_SEE_BUDGET_OVERVIEW = 'seeBudgetOverview',

	// STOCK QUANTITY
	SEE_STOCK_QUANTITY = 'seeStockQuantity',
	CAN_EDIT_STOCK_QUANTITY = 'canEditStockQuantity',

	// MIN STOCK QUANTITY
	SEE_MIN_STOCK_QUANTITY = 'seeMinStockQuantity',
	CAN_EDIT_MIN_STOCK_QUANTITY = 'canEditMinStockQuantity',

	// WHOLESALE PRICE
	SEE_WHOLESALE_PRICE = 'seeWholesalePrice',
	CAN_EDIT_WHOLESALE_PRICE = 'canEditWholesalePrice',

	// DISCOUNT
	SEE_DISCOUNT = 'seeDiscount',
	CAN_EDIT_DISCOUNT = 'canEditDiscount',

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
	// LOCATION SHELF
	SEE_LOCATION_SHELF = 'seeLocationShelf',
	CAN_EDIT_LOCATION_SHELF = 'canEditLocationShelf',
	// LOCATION WAREHOUSE
	SEE_LOCATION_WAREHOUSE = 'seeLocationWarehouse',
	CAN_EDIT_LOCATION_WAREHOUSE = 'canEditLocationWarehouse',

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
	PRODUCT = 'PRODUCT', //منتج
	DAILY_ACTION = 'DAILY_ACTION', //إجراء يومي
	// PAYMENT = 'PAYMENT',//دفع
	// RECEIPT = 'RECEIPT',//قبض
}

export enum EntryType {
	BUYING_ENTRY = 'BUYING_ENTRY', //حركة شراء
	SELLING_ENTRY = 'SELLING_ENTRY', //حركة بيع
	PAYMENT_ENTRY = 'PAYMENT_ENTRY', //حركة دفع
	RECEIPT_ENTRY = 'RECEIPT_ENTRY', //حركة قبض
	EXPENSE_ENTRY = 'EXPENSE_ENTRY', //مصروف
}

export enum BreadCrumbItem {
	SETTINGS = 'settings',
	BARCODE = 'barcode',
	PRODUCTS = 'products',
	PRODUCT = 'product',
	ORDERS = 'orders',
	INVOICES = 'invoices',
	DAILY = 'daily',
	USERS = 'users',
	ADD_NEW_TENANT = 'addNewTenant',
	TENANTS_LIST = 'tenantsList',
	ALL_PRODUCTS = 'allProducts',
	CUSTOMERS = 'customers',
	CUSTOMER = 'customer',
	CATEGORIES = 'categories',
	SUPPLIERS = 'suppliers',
	SUPPLIER = 'supplier',
	PARTNERS = 'partners',
	PARTNER = 'partner',
}

export enum FilterAttribute {
	SEARCH_BAR = 'search',
	LOCATIONS = 'locations',
	SHOPS = 'shops',
	CATEGORIES = 'categories',
	SUB_CATEGORIES = 'subCategories',
	SUPPLIERS = 'suppliers',
	BRANDS = 'brands',
	DATE_TO = 'dateTo',
	DATE_FROM = 'dateFrom',
	YEAR = 'year',
	TICKET_STATUSES = 'ticketStatuses',
	PRICE_OFFER_STATUSES = 'priceOfferStatuses',
	TAGS = 'tags',
	ONLY_UPDATED = 'onlyUpdatedTickets',
	CLUSTERS = 'clusters',
	SALES_AREAS = 'salesAreas',
	PRODUCT_DESCRIPTION = 'productDescription',
	GH_NUMBERS = 'ghNumbers',
	LOCATION_CLUSTER = 'locationCluster',
	ZOOM = 'zoom',
	RESET_FILTERS = 'resetFilters',
	RENTAL_STATUS = 'rentalStatus',
	SHOP_TYPE = 'shopTypes',
	FURNITURE = 'furniture',
	USAGE_TYPES = 'usageTypes',
	PRODUCT_CATEGORY = 'productCategories',
	KIND_OF_ADVERTISING_SITE = 'kindOfAdvertisingSites',
	PROMOTION_TYPE = 'promotionTypes',
	TICKET_TYPE = 'ticketTypes',
	FLAGGED_BY_ME = 'flaggedByMe',
	COMPLAINT_CATEGORIES = 'complaintCategories',
}

export enum StepKeys {
	ACTION_TYPE = 1,
	ACTION_DATA = 2,
	ACTION_SUMMARY = 3,
}

export enum ActionTypes {
	buying = 'buying',
	selling = 'selling',
	purchase = 'purchase',
	procurement = 'procurement',
	receipt = 'receipt',
	Payment = 'Payment',
	test = 'test',
}

export enum AddQuickStateEnum {
	PRODUCT = 'product',
	CURRENCY = 'currency',
	SUPPLIER = 'supplier',
	CUSTOMER = 'customer',
	PARTNER = 'partner',
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

export enum InvoiceUiStatus {
	DRAFT = 'draft',
	CANCELLED = 'cancelled',
	PAID = 'paid',
	PARTIAL = 'partial',
	CREDIT = 'credit',
}
