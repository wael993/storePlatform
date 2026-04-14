import { ErrorCodes } from './errorCodes'

export class HttpErrorHandler extends Error {
	public hint?: string
	public httpStatus: number
	public errorCode: ErrorCodes
	public message: string

	constructor(
		errorCode: ErrorCodes,
		httpStatus: number,
		message: string,
		hint?: string,
	) {
		super()
		this.name = this.constructor.name
		this.errorCode = errorCode
		this.httpStatus = httpStatus
		this.hint = hint
		this.message = message
	}
}

export class RequiredParameterMissingError extends HttpErrorHandler {
	constructor(errorCode: ErrorCodes, message: string, hint?: string) {
		super(errorCode, 400, message, hint)
	}
}

export class InvalidParameterError extends HttpErrorHandler {
	constructor(errorCode: ErrorCodes, message: string, hint?: string) {
		super(errorCode, 400, message, hint)
	}
}

export class DocumentError extends HttpErrorHandler {
	constructor(errorCode: ErrorCodes, message: string, hint?: string) {
		super(errorCode, 404, message, hint)
	}
}
