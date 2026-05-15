import { AllowedActions } from '../globalEnums'
import { useResources } from './useResources'

export interface AllowedActionsMap {
	canAddProduct: boolean
	canEditProduct: boolean
	canDeleteProduct: boolean
	canAddReport: boolean
	canEditReport: boolean
	canDeleteReport: boolean
}

const useAllowedActions = (overriddenPath?: string): AllowedActionsMap => {
	const { isActionAllowed } = useResources(overriddenPath)
	const allowedActions: AllowedActionsMap = {
		canAddProduct: isActionAllowed(AllowedActions.ADD_PRODUCT),
		canEditProduct: isActionAllowed(AllowedActions.EDIT_PRODUCT),
		canDeleteProduct: isActionAllowed(AllowedActions.DELETE_PRODUCT),
		canAddReport: isActionAllowed(AllowedActions.ADD_REPORT),
		canEditReport: isActionAllowed(AllowedActions.EDIT_REPORT),
		canDeleteReport: isActionAllowed(AllowedActions.DELETE_REPORT),

		//PROMO
	}

	return allowedActions
}

export default useAllowedActions
