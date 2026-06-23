import { skipToken } from '@reduxjs/toolkit/query/react'
import { useLocation } from 'react-router-dom'
import { useGetUserFrontendResourcesQuery } from '../../api/apiStore'
import { AllowedActions } from '../globalEnums'
import { useUser } from './useUser'

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
	const { userId } = useUser()

	const currentPath = overriddenPath ?? pathname

	const { data: frontendResources = [] } = useGetUserFrontendResourcesQuery(
		userId ?? skipToken,
	)

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
