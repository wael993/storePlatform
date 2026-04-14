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
