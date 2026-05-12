import { useSelector } from 'react-redux'
import { RootState } from '../store/store'

export function useTenant() {
	const tenantName = useSelector(
		(state: RootState) => state.user.user?.tenantName ?? 'Store',
	)

	return {
		tenantName,
	}
}
