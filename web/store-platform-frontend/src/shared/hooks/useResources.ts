import { useSelector } from 'react-redux'
import { RootState } from '../../store/store'
import { useLocation } from 'react-router-dom'
import { AllowedActions } from '../globalEnums'

// import { useUser } from '../useUser'

// import { config } from '../../config'

// const allActivitiesPath =
// 	'/services/marketing_platform/activities/all-activities'
// const promotionPath = '/services/marketing_platform/activities/promotion'
// const pricePath = '/services/marketing_platform/activities/price'
// const SLPath = '/services/marketing_platform/space-and-location'
// const SLTicketBoardPath =
// 	'/services/marketing_platform/space-and-location/board'
// const SLTicketListPath = '/services/marketing_platform/space-and-location/list'
// const SLLocationsPath =
// 	'/services/marketing_platform/space-and-location/locations'
// const SLSpacesPath = '/services/marketing_platform/space-and-location/spaces'
// const complaintsPathBoard = '/services/marketing_platform/complaints/board'
export const SLAcquisitionTicketPath =
	'/services/marketing_platform/space-and-location/*/acquisition/*'
export const mediaExchangePath =
	'/services/marketing_platform/space-and-location/media-exchange'

const matchesResourcePath = (
	resourcePath: string,
	inputPath: string,
): boolean => {
	const segments = resourcePath.split('/')
	const pattern = segments
		.map(segment => {
			if (segment !== '*') return segment
			return '[^/]+'
		})
		.join('/')
	const regex = new RegExp(`^${pattern}(/.*)?$`)
	return regex.test(inputPath)
}

export function useResources(overriddenPath?: string) {
	const { pathname } = useLocation()

	const currentPath = overriddenPath ?? pathname

	const frontendResourcesState = useSelector((state: RootState) => {
		return state.frontendResources
	})

	const frontendResources: FrontendResources[] =
		frontendResourcesState.frontendResources

	const allowedActionsForPath = (pathInput: string = currentPath): string[] => {
		if (!pathInput) return []

		if (!frontendResources || frontendResources.length === 0) return []

		const resources = frontendResources.filter(resource => {
			return matchesResourcePath(resource.path, pathInput)
		})

		const allowedActions = resources
			.flatMap(resource => resource.allowedActions)
			.filter((action, index, array) => array.indexOf(action) === index)
			.filter((action): action is string => action !== undefined)

		return allowedActions
	}

	const allowedActions = allowedActionsForPath()

	const isActionAllowed = (action: AllowedActions) => {
		console.log('🚀 ~ isActionAllowed ~ allowedActions:', allowedActions)
		return allowedActions.includes(action)
	}

	return {
		// hasAccess,
		// hasAccessOnPath,
		// allowedActions,
		// pathAccess,
		isActionAllowed,
		// areAnyActionsAllowed,
		// isSLLightRole,
		// isHasAccessReady,
	}
}
