export enum SortOrder {
	ASC = 'asc',
	DESC = 'desc',
}
export enum ProductSortHeaderKey {
	NAME = 'name',
	LATIN_NAME = 'latinName',
	BARCODE = 'barcode',
	INTERNAL_CODE = 'internalCode',
	PRODUCT_FACTORY_CODE = 'productFactoryCode',
	CATEGORY_NAME = 'categoryName',
	BRAND_NAME = 'brandName',
	UNIT_NAME = 'unitName',
	PRICE_BUY_COST = 'price.buyCost',
	PRICE_SELL = 'price.wholesale',
	PRICE_WHOLESALE = 'price.wholesalePrice',
	PRICE_SEMI_WHOLESALE = 'price.semiWholesalePrice',
	CURRENCY = 'price.currency',
	TAX_RATE = 'taxRate',
	DISCOUNT = 'price.discount',
	STOCK_QUANTITY = 'stock.quantity',
	STOCK_MIN_QUANTITY = 'stock.minQuantity',
	SUPPLIER_NAME = 'supplierName',
	LOCATION_WAREHOUSE = 'location',
	LOCATION_SHELF = 'location.shelf',
	START_DATE = 'updatedAt',
	EXPIRY_DATE = 'attributes.expiryDate',
	STATUS = 'status',
	COLOR = 'attributes.color',
	SIZE = 'attributes.size',
	WEIGHT = 'attributes.weight',
	LENGTH = 'attributes.length',
	WIDTH = 'attributes.width',
	HEIGHT = 'attributes.height',
	FLAVOR = 'attributes.flavor',
	DESCRIPTION = 'description',
}

export enum SupplierSortHeaderKey {
	NAME = 'name',
	INTERNAL_CODE = 'internalCode',
	TOTAL_PAYABLE = 'totalPayable',
}
export enum CustomerSortHeaderKey {
	NAME = 'name',
	INTERNAL_CODE = 'internalCode',
	SOLD = 'sold',
	TOTAL_RECEIVABLE = 'totalReceivable',
}
export enum PartnerSortHeaderKey {
	NAME = 'name',
	INTERNAL_CODE = 'internalCode',
	CREATED_AT = 'createdAt',
}
export enum CategorySortHeaderKey {
	NAME = 'name',
	DESCRIPTION = 'description',
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
