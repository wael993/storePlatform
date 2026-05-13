import { useSelector } from 'react-redux'
import { RootState } from '../../store/store'
import { UserRole } from '../globalEnums'

export function useUser() {
	const user = useSelector((state: RootState) => state.user.user)
	const userRole: UserRole | null = user?.role ?? null
	const isOwner = userRole === 'owner'
	const isAdmin = userRole === 'admin'
	const isUser = userRole === 'cashier' || userRole === 'employee'
	const isOwnerOrAdmin = isOwner || isAdmin

	return {
		userRole,
		user,
		isOwner,
		isAdmin,
		isUser,
		isOwnerOrAdmin,
	}
}
