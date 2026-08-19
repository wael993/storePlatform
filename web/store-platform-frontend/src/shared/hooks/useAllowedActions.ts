import { AllowedActions } from '../globalEnums'
import { useResources } from './useResources'

interface AllowedActionsMap {
	// PRODUCT
	canAddProduct: boolean
	canDeleteProduct: boolean

	// STOCK QUANTITY
	seeStockQuantity: boolean
	canEditStockQuantity: boolean
	seeNotifications: boolean

	// MIN STOCK QUANTITY
	seeMinStockQuantity: boolean
	canEditMinStockQuantity: boolean

	// WHOLESALE PRICE
	seeWholesalePrice: boolean
	canEditWholesalePrice: boolean

	// DISCOUNT
	seeDiscount: boolean
	canEditDiscount: boolean

	// REPORT
	seeReport: boolean
	canAddReport: boolean
	canEditReport: boolean
	canDeleteReport: boolean

	// BUY COST
	seeBuyCost: boolean
	canEditBuyCost: boolean

	// SUPPLIER
	seeSupplier: boolean
	canAddSupplier: boolean
	canEditSupplier: boolean
	canDeleteSupplier: boolean
	// LOCATION SHELF
	seeLocationShelf: boolean
	canEditLocationShelf: boolean
	// LOCATION WAREHOUSE
	seeLocationWarehouse: boolean
	canEditLocationWarehouse: boolean
}
const useAllowedActions = (overriddenPath?: string): AllowedActionsMap => {
	const { isActionAllowed } = useResources(overriddenPath)

	const allowedActions: AllowedActionsMap = {
		// PRODUCT
		canAddProduct: isActionAllowed(AllowedActions.ADD_PRODUCT),
		canDeleteProduct: isActionAllowed(AllowedActions.DELETE_PRODUCT),

		// STOCK QUANTITY
		seeStockQuantity: isActionAllowed(AllowedActions.SEE_STOCK_QUANTITY),
		canEditStockQuantity: isActionAllowed(
			AllowedActions.CAN_EDIT_STOCK_QUANTITY,
		),
		seeNotifications: isActionAllowed(AllowedActions.SEE_NOTIFICATIONS),

		// MIN STOCK QUANTITY
		seeMinStockQuantity: isActionAllowed(AllowedActions.SEE_MIN_STOCK_QUANTITY),
		canEditMinStockQuantity: isActionAllowed(
			AllowedActions.CAN_EDIT_MIN_STOCK_QUANTITY,
		),

		// WHOLESALE PRICE
		seeWholesalePrice: isActionAllowed(AllowedActions.SEE_WHOLESALE_PRICE),
		canEditWholesalePrice: isActionAllowed(
			AllowedActions.CAN_EDIT_WHOLESALE_PRICE,
		),

		// DISCOUNT
		seeDiscount: isActionAllowed(AllowedActions.SEE_DISCOUNT),
		canEditDiscount: isActionAllowed(AllowedActions.CAN_EDIT_DISCOUNT),

		// REPORT
		seeReport: isActionAllowed(AllowedActions.SEE_REPORT),
		canAddReport: isActionAllowed(AllowedActions.ADD_REPORT),
		canEditReport: isActionAllowed(AllowedActions.EDIT_REPORT),
		canDeleteReport: isActionAllowed(AllowedActions.DELETE_REPORT),

		// BUY COST
		seeBuyCost: isActionAllowed(AllowedActions.SEE_BUY_COST),
		canEditBuyCost: isActionAllowed(AllowedActions.CAN_EDIT_BUY_COST),

		// SUPPLIER
		seeSupplier: isActionAllowed(AllowedActions.SEE_SUPPLIER),
		canAddSupplier: isActionAllowed(AllowedActions.CAN_ADD_SUPPLIER),
		canEditSupplier: isActionAllowed(AllowedActions.CAN_EDIT_SUPPLIER),
		canDeleteSupplier: isActionAllowed(AllowedActions.CAN_DELETE_SUPPLIER),
		// LOCATION SHELF
		seeLocationShelf: isActionAllowed(AllowedActions.SEE_LOCATION_SHELF),
		canEditLocationShelf: isActionAllowed(
			AllowedActions.CAN_EDIT_LOCATION_SHELF,
		),
		// LOCATION WAREHOUSE
		seeLocationWarehouse: isActionAllowed(
			AllowedActions.SEE_LOCATION_WAREHOUSE,
		),
		canEditLocationWarehouse: isActionAllowed(
			AllowedActions.CAN_EDIT_LOCATION_WAREHOUSE,
		),
	}

	return allowedActions
}

export default useAllowedActions
