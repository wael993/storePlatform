export enum SortOrder {
	ASC = 'asc',
	DESC = 'desc',
}
export enum ProductSortHeaderKey {
	NAME = 'name',
	BARCODE = 'barcode',
	CATEGORY_NAME = 'categoryName',
	BRAND_NAME = 'brandName',
	PRICE_BUY_COST = 'price.buyCost',
	PRICE_SELL = 'price.wholesale',
	DISCOUNT = 'price.discount',
	STOCK_QUANTITY = 'stock.quantity',
	STOCK_MIN_QUANTITY = 'stock.minQuantity',
	SUPPLIER_NAME = 'supplierName',
	LOCATION_WAREHOUSE = 'location',
	LOCATION_SHELF = 'location.shelf',
	START_DATE = 'updatedAt',
	STATUS = 'status',
	COLOR = 'attributes.color',
}

export enum SupplierSortHeaderKey {
	NAME = 'name',
	INTERNAL_CODE = 'internalCode',
	CREATED_AT = 'createdAt',
}
export enum CustomerSortHeaderKey {
	NAME = 'name',
	INTERNAL_CODE = 'internalCode',
	SOLD = 'sold',
	CREATED_AT = 'createdAt',
}
export enum PartnerSortHeaderKey {
	NAME = 'name',
	INTERNAL_CODE = 'internalCode',
	CREATED_AT = 'createdAt',
}

export enum DailyActionSortHeaderKey {
	ENTRY_TYPE = 'entryType',
	PRODUCT_NAME = 'productName',
	SUPPLIER_CUSTOMER = 'supplierName',
	WEIGHT = 'weight',
	UNIT_PRICE = 'singleUnitPrice',
	TOTAL_PRICE = 'totalPrice',
	INVOICE_DATE = 'invoiceDate',
	INVOICE_NUMBER = 'invoiceNumber',
	NOTE = 'note',
}

export enum SimpleEntitySortHeaderKey {
	NAME = 'name',
	INTERNAL_CODE = 'internalCode',
	CREATED_AT = 'createdAt',
}

export enum ActivityState {
	ACTIVE = 'active',
	INACTIVE = 'inactive',
	DISCONTINUED = 'discontinued',
	OUT_OF_STOCK = 'outOfStock',
	READY_FOR_RESTOCK = 'readyForRestock',
	DRAFT = 'draft',
}
