export enum UserRole {
	SUPER_ADMIN = 'super_admin',
	OWNER = 'owner',
	ADMIN = 'admin',
	CASHIER = 'cashier',
	EMPLOYEE = 'employee',
}

export enum AllowedActions {
	// PRODUCT
	ADD_PRODUCT = 'addProduct',
	DELETE_PRODUCT = 'deleteProduct',

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
}
export enum Breakpoints {
	MOBILE = 'mobile',
	TABLET = 'tablet',
	DESKTOP = 'desktop',
	LARGE_DESKTOP = 'large_desktop',
}

export enum ACTIVITY_TYPE {
	PRICE = 'PA',
	PROMOTIONS = 'PO',
	ALL_ACTIVITIES = 'ALL',
	SPACE_AND_LOCATION = 'SL',
	SPACE_AND_LOCATION_LOCATIONS = 'SL_LOCATIONS',
	SPACE_AND_LOCATION_SHOPS = 'SL_SHOPS',
	SPACE_AND_LOCATION_SHOP_DETAILS = 'SL_SHOP_DETAILS',
	SPACE_AND_LOCATION_TICKET_CANCELLATION = 'SL_TICKET_CANCELLATION',
	SPACE_AND_LOCATION_TICKET_ACQUISITION = 'SL_TICKET_ACQUISITION',
	SPACE_AND_LOCATION_SPACES = 'SL_SPACES',
	SPACE_AND_LOCATION_MEDIA_EXCHANGE = 'SL_MEDIA_EXCHANGE',
	COMPLAINTS = 'COMPLAINTS',
}

export enum BreadCrumbItem {
	SETTINGS = 'settings',
	BARCODE = 'barcode',
	PRODUCTS = 'products',
	ORDERS = 'orders',
	INVOICES = 'invoices',
	USERS = 'users',
	ADD_NEW_TENANT = 'addNewTenant',
	TENANTS_LIST = 'tenantsList',
	ALL_PRODUCTS = 'allProducts',
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
