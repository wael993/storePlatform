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
	// const { user, isUser } = useUser()
	const currentPath = overriddenPath ?? pathname

	const frontendResourcesState = useSelector((state: RootState) => {
		// console.log('🚀 ~ useResources ~ state:', state)
		return state.frontendResources
	})
	// console.log(
	// 	'🚀 ~ useResources ~ frontendResourcesState:',
	// 	frontendResourcesState,
	// )

	const frontendResources: FrontendResources[] =
		frontendResourcesState.frontendResources
	// const isLoading: boolean = frontendResourcesState.isLoading
	// const isUninitialized: boolean = frontendResourcesState.isUninitialized

	// const isHasAccessReady = !isLoading && !isUninitialized

	// const hasAccessOnPath = (path: string | undefined): boolean => {
	// 	if (!path) return false

	// 	if (!frontendResources || frontendResources.length === 0) return false

	// 1. Exact match takes highest priority
	// const exactMatch = frontendResources.find(
	// 	resource => resource.path === path,
	// )
	// if (exactMatch) return exactMatch.access

	// 2. Wildcard matches — find the most specific one (longest path wins)
	// const wildcardMatches = frontendResources.filter(resource =>
	// 	matchesResourcePath(resource.path, path),
	// )

	// if (!wildcardMatches.length) return false

	// Longer path = more specific
	// const mostSpecific = wildcardMatches.sort(
	// 	(a, b) => b.path.length - a.path.length,
	// )[0]
	// const resource = mostSpecific

	// const isSLPath = path.includes(SLPath)

	// 	if (isSLPath && isSupplierUser) {
	// 		switch (SLAccessValue) {
	// 			case SL_ACCESS_VALUES.LIGHT_ACCESS:
	// 				return SLAllowedPaths.some(allowedPath => path.includes(allowedPath))
	// 			case SL_ACCESS_VALUES.FULL_ACCESS:
	// 				break
	// 			case SL_ACCESS_VALUES.NO_ACCESS:
	// 				return false

	// 			default:
	// 				return false
	// 		}
	// 	}

	// 	return resource.access ?? false
	// }

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

	// const useSLLightAccess = !allowedActionsForPath(SLPath).includes(
	// 	AllowedActions.SL_FULL_ACCESS,
	// )

	// const isSLLightRole =
	// 	useSLLightAccess ||
	// 	(isSupplierUser
	// 		? SLAccessValue
	// 			? SLAccessValue === SL_ACCESS_VALUES.LIGHT_ACCESS
	// 			: true
	// 		: false) ||
	// 	false

	// const hasAccess = hasAccessOnPath(currentPath)
	const allowedActions = allowedActionsForPath()

	const isActionAllowed = (action: AllowedActions) => {
		return allowedActions.includes(action)
	}

	// const areAnyActionsAllowed = (actions: AllowedActions[]) => {
	// 	return actions.some(action => allowedActions.includes(action))
	// }

	// const pathAccess = {
	// 	allActivities: hasAccessOnPath(allActivitiesPath),
	// 	promotion: hasAccessOnPath(promotionPath),
	// 	price: hasAccessOnPath(pricePath),
	// 	spaceAndLocation: hasAccessOnPath(SLPath),
	// 	SLLocations: hasAccessOnPath(SLLocationsPath),
	// 	SLTickets:
	// 		hasAccessOnPath(SLTicketBoardPath) || hasAccessOnPath(SLTicketListPath),
	// 	SLSpaces: hasAccessOnPath(SLSpacesPath),
	// 	complaints: hasAccessOnPath(complaintsPathBoard),
	// 	mediaExchange: hasAccessOnPath(mediaExchangePath),
	// }

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
