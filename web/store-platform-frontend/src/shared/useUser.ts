import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import { UserRole } from './globalEnums'

export function useUser() {
	const user: UserRole | null = useSelector(
		(state: RootState) => state.user.user?.role ?? null,
	)
	const isOwner = user === 'owner'
	const isAdmin = user === 'admin'
	const isUser = user === 'cashier' || user === 'employee'
	const isOwnerOrAdmin = isOwner || isAdmin

	return {
		user,
		isOwner,
		isAdmin,
		isUser,
		isOwnerOrAdmin,
	}
}
