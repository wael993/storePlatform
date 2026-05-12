import { useSelector } from 'react-redux'
import { RootState } from '../store/store'

export function useAuth() {
	const isAuthenticated = useSelector(
		(state: RootState) => state.user.isAuthenticated,
	)

	return {
		isAuthenticated,
	}
}
