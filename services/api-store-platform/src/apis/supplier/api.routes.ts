import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
import {
	HttpError,
	RequestContext,
	SupplierRequestBody,
} from '../../shared/types'
import { ERROR_CODES } from '../../shared/errorCodes'
import SupplierController from './api.controller'

type SupplierHttpRequest = express.Request & {
	user?: RequestContext['user'] & {
		userId?: string
		tenantId?: string
		tenantName?: string
		role?: RequestContext['role']
	}
	allowedFields?: string[]
	see?: string[]
}

const isHandleableError = (error: unknown): error is HttpError =>
	typeof error === 'object' && error !== null && 'message' in error

export default class SupplierRoutes {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	public constructor(
		private supplierController: SupplierController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: SupplierHttpRequest,
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
		_request: SupplierHttpRequest,
		_: express.Response,
		next: express.NextFunction,
	) {
		this.startTime = Date.now()
		next()
	}

	private stopCalc(): void {
		const duration = Date.now() - this.startTime

		logger.info(`(end-to-end): ${duration}ms`)
	}

	private getRequestContext(request: SupplierHttpRequest): RequestContext {
		return {
			authorization: request.headers.authorization,
			cookie: request.headers.cookie,
			userId: request.user?.userId,
			tenantId: request.user?.tenantId,
			tenantName: request.user?.tenantName,
			role: request.user?.role,
			user: request.user,
			allowedFields: request.allowedFields || [],
			see: request.see || [],
		}
	}

	public setRoutes(app: express.Application): void {
		const baseRoute = this.baseRoute

		app
			.route(`${baseRoute}/suppliers`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getSuppliers.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postSupplier.bind(this),
			)

		app
			.route(`${baseRoute}/suppliers/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getSupplier.bind(this),
			)
	}

	private async getSuppliers(
		request: SupplierHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.supplierController.getSuppliers(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postSupplier(
		request: SupplierHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const requestBody: SupplierRequestBody = request.body

		try {
			const resp = await this.supplierController.postSupplier(
				requestContext,
				requestBody,
			)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getSupplier(
		request: SupplierHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.supplierController.getSupplier(
				request.params.id,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}
}
