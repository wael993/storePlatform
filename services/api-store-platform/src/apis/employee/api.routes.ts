import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
import { HttpError, RequestContext } from '../../shared/types'
import { ERROR_CODES } from '../../shared/errorCodes'
import EmployeeController from './api.controller'

type EmployeeHttpRequest = express.Request & {
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

export default class EmployeeRoutes {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	public constructor(
		private employeeController: EmployeeController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: EmployeeHttpRequest,
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
		_request: EmployeeHttpRequest,
		_: express.Response,
		next: express.NextFunction,
	) {
		this.startTime = Date.now()
		next()
	}

	private stopCalc(): void {
		logger.info(`(end-to-end): ${Date.now() - this.startTime}ms`)
	}

	private getRequestContext(request: EmployeeHttpRequest): RequestContext {
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

	private send(
		handler: (
			request: EmployeeHttpRequest,
			requestContext: RequestContext,
		) => Promise<{ status: number; body: unknown }>,
	) {
		return async (
			request: EmployeeHttpRequest,
			response: express.Response,
		): Promise<void> => {
			const requestContext = this.getRequestContext(request)

			try {
				const result = await handler(request, requestContext)

				response.status(result.status).json(result.body)
			} catch (error: unknown) {
				this.handleRouteError(error, 409, response)
			} finally {
				this.stopCalc()
			}
		}
	}

	public setRoutes(app: express.Application): void {
		const guard = [
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
		]

		app
			.route(`${this.baseRoute}/employees`)
			.get(
				...guard,
				this.send(async (_request, requestContext) => ({
					status: 200,
					body: await this.employeeController.getEmployees(requestContext),
				})),
			)
			.post(
				...guard,
				this.send(async (request, requestContext) => ({
					status: 201,
					body: await this.employeeController.postEmployee(
						requestContext,
						request.body,
					),
				})),
			)

		app
			.route(`${this.baseRoute}/employees/:id`)
			.get(
				...guard,
				this.send(async (request, requestContext) => ({
					status: 200,
					body: await this.employeeController.getEmployee(
						request.params.id,
						requestContext,
					),
				})),
			)
			.patch(
				...guard,
				this.send(async (request, requestContext) => ({
					status: 200,
					body: await this.employeeController.patchEmployee(
						request.params.id,
						requestContext,
						request.body,
					),
				})),
			)

		app.route(`${this.baseRoute}/employees/:id/salaries`).post(
			...guard,
			this.send(async (request, requestContext) => ({
				status: 201,
				body: await this.employeeController.postSalary(
					request.params.id,
					requestContext,
					request.body,
				),
			})),
		)

		app.route(`${this.baseRoute}/employees/:id/payouts`).post(
			...guard,
			this.send(async (request, requestContext) => ({
				status: 201,
				body: await this.employeeController.postPayout(
					request.params.id,
					requestContext,
					request.body,
				),
			})),
		)

		app
			.route(`${this.baseRoute}/employees/:id/payouts/:payoutId`)
			.patch(
				...guard,
				this.send(async (request, requestContext) => ({
					status: 200,
					body: await this.employeeController.patchPayout(
						request.params.id,
						request.params.payoutId,
						requestContext,
						request.body,
					),
				})),
			)
			.delete(
				...guard,
				this.send(async (request, requestContext) => ({
					status: 200,
					body: await this.employeeController.deletePayout(
						request.params.id,
						request.params.payoutId,
						requestContext,
					),
				})),
			)
	}
}
