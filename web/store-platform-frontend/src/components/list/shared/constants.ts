import { ActivityState } from './globalEnums'

export const PROMOTION_LIST_WIDTHS_MAP_IN_REM = {
	CHECKBOX: 2,
	NAME: 9,
	BARCODE: 5,
	BRAND: 6,
	CATEGORY_NAME: 7,
	PRICE_BUY: 8,
	PRICE_SELL: 8,
	STOCK_QUANTITY: 8,
	STOCK_MIN_QUANTITY: 8,
	SUPPLIER_NAME: 8,
	LOCATION_WAREHOUSE: 8,
	LOCATION_SHELF: 8,
	START_DATE: 6.5,
	STATUS: 5,
	STICKY_RIGHT: 15,
	DISCOUNT: 8,
	COLOR: 6,
} as const

export const SUPPLIER_LIST_WIDTHS_MAP_IN_REM = {
	CHECKBOX: 2,
	NAME: 12,
	INTERNAL_CODE: 12,
	CREATED_AT: 10,
	STICKY_RIGHT: 5,
} as const

export const CUSTOMER_LIST_WIDTHS_MAP_IN_REM = {
	CHECKBOX: 2,
	NAME: 12,
	INTERNAL_CODE: 12,
	SOLD: 10,
	CREATED_AT: 10,
	STICKY_RIGHT: 5,
} as const

export const DAILY_ACTION_LIST_WIDTHS_MAP_IN_REM = {
	CHECKBOX: 2,
	ENTRY_TYPE: 9,
	PRODUCT_NAME: 10,
	SUPPLIER_CUSTOMER: 10,
	WEIGHT: 7,
	UNIT_PRICE: 9,
	TOTAL_PRICE: 9,
	INVOICE_DATE: 8,
	INVOICE_NUMBER: 8,
	NOTE: 10,
	STICKY_RIGHT: 5,
} as const
export const SIMPLE_ENTITY_LIST_WIDTHS_MAP_IN_REM = {
	CHECKBOX: 2,
	NAME: 16,
	INTERNAL_CODE: 12,
	CREATED_AT: 12,
	STICKY_RIGHT: 5,
} as const

export const LIST_INTERNAL_ONLY_COLUMNS: string[] = [
	'SUPPLIER',
	'COMBINED_TARGET_CONTRIBUTIONS',
	'LISTING',
]

export const PRODUCT_STATE_CONFIG: ActivityStateMap = {
	[ActivityState.ACTIVE]: {
		translationKey: 'components.product.states.active',
		color: '#36CE4E',
	},
	[ActivityState.INACTIVE]: {
		translationKey: 'components.product.states.inactive',
		color: '#C7C7C7',
	},
	[ActivityState.DISCONTINUED]: {
		translationKey: 'components.product.states.discontinued',
		color: '#5698E6',
	},
	[ActivityState.READY_FOR_RESTOCK]: {
		translationKey: 'components.product.states.readyForRestock',
		color: '#F0BB35',
	},

	[ActivityState.OUT_OF_STOCK]: {
		translationKey: 'components.product.states.outOfStock',
		color: '#E45151',
	},

	[ActivityState.DRAFT]: {
		translationKey: 'components.product.states.draft',
		color: '#FFFFFF',
	},
}
