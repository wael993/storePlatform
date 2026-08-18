import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
import { CustomerRequestBody, HttpError, RequestContext } from '../../shared/types'
import { ERROR_CODES } from '../../shared/errorCodes'
import CustomerController from './api.controller'

type CustomerHttpRequest = express.Request & {
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

export default class CustomerRoutes {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	public constructor(
		private customerController: CustomerController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: CustomerHttpRequest,
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
		_request: CustomerHttpRequest,
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

	private getRequestContext(request: CustomerHttpRequest): RequestContext {
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
		const baseRoute = this.baseRoute

		app
			.route(`${baseRoute}/customers`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getCustomers.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postCustomer.bind(this),
			)

		app
			.route(`${baseRoute}/customers/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getCustomer.bind(this),
			)
	}

	private async getCustomers(
		request: CustomerHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.customerController.getCustomers(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postCustomer(
		request: CustomerHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const requestBody: CustomerRequestBody = request.body

		try {
			const resp = await this.customerController.postCustomer(
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

	private async getCustomer(
		request: CustomerHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.customerController.getCustomer(
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
