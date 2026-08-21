import { UserRole } from '../tenant'

interface DocumentReadOperationResponse {
	id?: string[]
	documents: any[]
	error?: RequestError
}

interface RequestError {
	message: string
	errorCode: string
	hint?: string
}
interface AuthContext {
	username: string
	password: string
}

interface UserAPIFormat {
	_id: string
	displayName: string
	avatarColorId?: number
	role: UserRole
}
