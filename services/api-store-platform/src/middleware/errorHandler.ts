import { Request, Response, NextFunction } from 'express'
import express from 'express'
import { ERROR_CODES, ErrorCodes } from '../shared/errorCodes'
import { HttpError, RequestError } from '../shared/types'

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

export class BusinessLogicError extends HttpErrorHandler {
	constructor(errorCode: ErrorCodes, message: string, hint?: string) {
		super(errorCode, 422, message, hint)
	}
}
export class AuthenticationError extends HttpErrorHandler {
	constructor(errorCode: ErrorCodes, message: string, hint?: string) {
		super(errorCode, 401, message, hint)
	}
}
export class AuthorizationError extends HttpErrorHandler {
	constructor(errorCode: ErrorCodes, message: string, hint?: string) {
		super(errorCode, 403, message, hint)
	}
}
// Custom error handler middleware
export const sendErrorResponse = (
	res: Response,
	statusCode: number,
	message: string,
) => {
	res.status(statusCode).json({ success: false, message })
}

// General error handling middleware
export const errorHandler = (
	err: Error,
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	console.error('Unhandled error:', err)

	// You can customize these error codes and messages depending on your needs
	res.status(500).json({
		success: false,
		message: 'Something went wrong. Please try again later.',
	})
}

export const handleError = (
	error: HttpError,
	defaultHttpStatusCode: number,
	response: express.Response,
) => {
	const defaultErrorCode = ERROR_CODES.GLOBAL.GLOBAL_UNKNOWN_ERROR

	const errorCode: ErrorCodes = error.errorCode || defaultErrorCode
	const httpStatusCode = error.httpStatus || defaultHttpStatusCode
	const message = error.message
	const hint = error.hint

	const errorPayload: RequestError = {
		errorCode: errorCode,
		message: message,
		hint: hint,
	}

	console.error(`${error}`, { errorCode })
	response.status(httpStatusCode).json(errorPayload)
}
