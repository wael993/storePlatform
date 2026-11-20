import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import {
	CustomerRequestBody,
	HttpError,
	RequestContext,
} from '../../shared/types'
import { buildRequestContext } from '../../shared/buildRequestContext'
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
	see?: string[]
}

const isHandleableError = (error: unknown): error is HttpError =>
	typeof error === 'object' && error !== null && 'message' in error

export default class CustomerRoutes {
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

	private getRequestContext(request: CustomerHttpRequest): RequestContext {
		return buildRequestContext(request)
	}

	public setRoutes(app: express.Application): void {
		const baseRoute = this.baseRoute

		app
			.route(`${baseRoute}/customers`)
			.get(this.authorizationValidator.bind(this), this.getCustomers.bind(this))
			.post(
				this.authorizationValidator.bind(this),
				this.postCustomer.bind(this),
			)

		app
			.route(`${baseRoute}/customers/bulk-delete`)
			.post(
				this.authorizationValidator.bind(this),
				this.bulkDeleteCustomers.bind(this),
			)

		app
			.route(`${baseRoute}/customers/:id`)
			.get(this.authorizationValidator.bind(this), this.getCustomer.bind(this))
			.patch(
				this.authorizationValidator.bind(this),
				this.patchOpeningBalance.bind(this),
			)
			.delete(
				this.authorizationValidator.bind(this),
				this.deleteCustomer.bind(this),
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
		}
	}

	private async patchOpeningBalance(
		request: CustomerHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.customerController.patchOpeningBalance(
				request.params.id,
				request.body ?? {},
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async deleteCustomer(
		request: CustomerHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.customerController.deleteCustomer(
				request.params.id,
				requestContext,
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async bulkDeleteCustomers(
		request: CustomerHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const customerIds = Array.isArray(request.body?.customerIds)
			? request.body.customerIds.filter(
					(id: unknown): id is string => typeof id === 'string',
				)
			: []

		try {
			const resp = await this.customerController.bulkDeleteCustomers(
				customerIds,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}
}
