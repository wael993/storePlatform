import { skipToken } from '@reduxjs/toolkit/query/react'
import { useCallback, useMemo } from 'react'
import { useGetUserFrontendResourcesQuery } from '../../api/apiStore'
import { SEE } from '../seeFlags'
import { useUser } from './useUser'

export function useSee() {
	const { user, userId } = useUser()
	const { data } = useGetUserFrontendResourcesQuery(userId ?? skipToken, {
		refetchOnMountOrArgChange: false,
	})

	const ids = useMemo(() => {
		if (data?.see?.length) return data.see
		return user?.see ?? []
	}, [data?.see, user?.see])

	const set = useMemo(() => new Set(ids), [ids])

	const canSee = useCallback(
		(id: string) =>
			set.has(id) ||
			(id === SEE.projects && set.has('orders')) ||
			((id === SEE.projectsAdd || id === SEE.projectsDelete) &&
				(set.has(SEE.projects) || set.has('orders'))),
		[set],
	)

	const canSeeAny = useCallback(
		(next: string[]) => next.some(id => set.has(id)),
		[set],
	)

	return { canSee, canSeeAny, see: ids }
}
