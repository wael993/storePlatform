interface APIResponse<T> {
	totalCount: number
	data: T[]
}

interface LoginData {
	email: string
	password: string
}
export interface LoginRequestBody {
	body: LoginData
}

interface UserAPIFormat {
	_id: string
	displayName: string
	businessPartnerId?: string
	isInternal?: boolean
	avatarColorId?: number
}
