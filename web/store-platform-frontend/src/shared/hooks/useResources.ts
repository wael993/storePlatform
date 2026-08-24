import { AllowedActions } from '../globalEnums'
import { SEE } from '../seeFlags'
import { useSee } from './useSee'

const ACTION_SEE: Partial<Record<AllowedActions, string>> = {
	[AllowedActions.ADD_PRODUCT]: SEE.productsAdd,
	[AllowedActions.DELETE_PRODUCT]: SEE.productsDelete,
	[AllowedActions.SEE_NOTIFICATIONS]: SEE.productsNotifications,
	[AllowedActions.SEE_DAILY_ACTION]: SEE.daily,
	[AllowedActions.CAN_ADD_DAILY_ACTION]: SEE.daily,
	[AllowedActions.CAN_EDIT_DAILY_ACTION]: SEE.daily,
	[AllowedActions.CAN_DELETE_DAILY_ACTION]: SEE.daily,
	[AllowedActions.CAN_SEE_BUDGET_OVERVIEW]: SEE.daily,
	[AllowedActions.SEE_WHOLESALE_PRICE]: SEE.productsWholesalePrice,
	[AllowedActions.CAN_EDIT_WHOLESALE_PRICE]: SEE.productsWholesalePrice,
	[AllowedActions.SEE_REPORT]: SEE.reports,
	[AllowedActions.ADD_REPORT]: SEE.reports,
	[AllowedActions.EDIT_REPORT]: SEE.reports,
	[AllowedActions.DELETE_REPORT]: SEE.reports,
	[AllowedActions.SEE_BUY_COST]: SEE.productsBuyingPrice,
	[AllowedActions.CAN_EDIT_BUY_COST]: SEE.productsBuyingPrice,
	[AllowedActions.SEE_SUPPLIER]: SEE.supplier,
	[AllowedActions.CAN_ADD_SUPPLIER]: SEE.suppliersAdd,
	[AllowedActions.CAN_EDIT_SUPPLIER]: SEE.supplier,
	[AllowedActions.CAN_DELETE_SUPPLIER]: SEE.suppliersDelete,
	[AllowedActions.SEE_CUSTOMER]: SEE.customers,
	[AllowedActions.CAN_ADD_CUSTOMER]: SEE.customersAdd,
	[AllowedActions.CAN_EDIT_CUSTOMER]: SEE.customers,
	[AllowedActions.CAN_DELETE_CUSTOMER]: SEE.customersDelete,
	[AllowedActions.SEE_PARTNER]: SEE.partners,
	[AllowedActions.CAN_ADD_PARTNER]: SEE.partnersAdd,
	[AllowedActions.CAN_EDIT_PARTNER]: SEE.partners,
	[AllowedActions.CAN_DELETE_PARTNER]: SEE.partnersDelete,
}

export const isActionAllowed = (
	action: AllowedActions,
	canSee: (id: string) => boolean,
) => {
	const id = ACTION_SEE[action]
	return id ? canSee(id) : false
}

export function useResources(_overriddenPath?: string) {
	const { canSee } = useSee()

	return {
		isActionAllowed: (action: AllowedActions) =>
			isActionAllowed(action, canSee),
	}
}
