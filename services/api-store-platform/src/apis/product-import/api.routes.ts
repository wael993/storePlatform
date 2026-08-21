import express from 'express'
import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
import { HttpError, RequestContext } from '../../shared/types'
import { ERROR_CODES } from '../../shared/errorCodes'
import ProductImportController from './api.controller'

type ImportHttpRequest = express.Request & {
	user?: RequestContext['user'] & {
		userId?: string
		tenantId?: string
		tenantName?: string
		role?: RequestContext['role']
	}
	allowedFields?: string[]
}

const isHandleableError = (error: unknown): error is HttpError =>
	typeof error === 'object' && error !== null && 'message' in error

export default class ProductImportRoutes {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	public constructor(
		private productImportController: ProductImportController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: ImportHttpRequest,
		response: express.Response,
		next: express.NextFunction,
	): Promise<void> {
		try {
			const activityAuthorization = new ActivityAuthorization(
				this.productController,
			)

			await activityAuthorization.authorizationValidator(
				request,
				response,
				next,
			)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private handleRouteError(
		error: unknown,
		defaultHttpStatus: number,
		response: express.Response,
	): void {
		handleError(
			isHandleableError(error)
				? error
				: {
						httpStatus: defaultHttpStatus,
						message: 'Unknown error',
						errorCode: ERROR_CODES.GLOBAL.GLOBAL_UNKNOWN_ERROR,
					},
			defaultHttpStatus,
			response,
		)
	}

	private startCalc(
		_request: ImportHttpRequest,
		_: express.Response,
		next: express.NextFunction,
	) {
		this.startTime = Date.now()
		next()
	}

	private stopCalc(): void {
		logger.info(`(end-to-end): ${Date.now() - this.startTime}ms`)
	}

	private getRequestContext(request: ImportHttpRequest): RequestContext {
		return {
			authorization: request.headers.authorization,
			cookie: request.headers.cookie,
			userId: request.user?.userId,
			tenantId: request.user?.tenantId,
			tenantName: request.user?.tenantName,
			role: request.user?.role,
			user: request.user,
			allowedFields: request.allowedFields || [],
		}
	}

	public setRoutes(app: express.Application): void {
		const base = `${this.baseRoute}/product-import`

		app.route(`${base}/status`).get(
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
			this.getStatus.bind(this),
		)

		app.route(`${base}/skip`).post(
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
			this.skip.bind(this),
		)

		app.route(`${base}/parse`).post(
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
			this.parse.bind(this),
		)

		app.route(`${base}/preview`).post(
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
			this.preview.bind(this),
		)

		app.route(`${base}/commit`).post(
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
			this.commit.bind(this),
		)
	}

	private async getStatus(
		request: ImportHttpRequest,
		response: express.Response,
	) {
		try {
			const result = await this.productImportController.getStatus(
				this.getRequestContext(request),
			)

			response.status(200).json(result)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async skip(request: ImportHttpRequest, response: express.Response) {
		try {
			const result = await this.productImportController.skip(
				this.getRequestContext(request),
			)

			response.status(200).json(result)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async parse(request: ImportHttpRequest, response: express.Response) {
		try {
			const files = Array.isArray(request.body?.files) ? request.body.files : []
			const result = await this.productImportController.parse(
				this.getRequestContext(request),
				files,
			)

			response.status(200).json(result)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async preview(
		request: ImportHttpRequest,
		response: express.Response,
	) {
		try {
			const result = await this.productImportController.preview(
				this.getRequestContext(request),
				request.body?.sessionId,
				request.body?.mapping,
			)

			response.status(200).json(result)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async commit(request: ImportHttpRequest, response: express.Response) {
		try {
			const result = await this.productImportController.commit(
				this.getRequestContext(request),
				request.body?.sessionId,
				request.body?.mapping,
				request.body?.offset,
				request.body?.limit,
			)

			response.status(200).json(result)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}
}
