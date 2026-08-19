import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
import { HttpError, RequestContext } from '../../shared/types'
import { ERROR_CODES } from '../../shared/errorCodes'
import NotificationController from './api.controller'

type NotificationHttpRequest = express.Request & {
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

export default class NotificationRoutes {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	public constructor(
		private notificationController: NotificationController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: NotificationHttpRequest,
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
		_request: NotificationHttpRequest,
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

	private getRequestContext(request: NotificationHttpRequest): RequestContext {
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
		app
			.route(`${this.baseRoute}/products/notifications/digest`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getProductNotificationDigest.bind(this),
			)

		app
			.route(`${this.baseRoute}/products/notifications/read`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.markProductNotificationsRead.bind(this),
			)

		app
			.route(`${this.baseRoute}/products/notifications`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getProductNotifications.bind(this),
			)
	}

	private async getProductNotifications(
		request: NotificationHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.notificationController.getProductNotifications(
					requestContext,
				)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 500, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getProductNotificationDigest(
		request: NotificationHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.notificationController.getProductNotificationDigest(
					requestContext,
					typeof request.query.type === 'string'
						? request.query.type
						: undefined,
				)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 500, response)
		} finally {
			this.stopCalc()
		}
	}

	private async markProductNotificationsRead(
		request: NotificationHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.notificationController.markProductNotificationsRead(
				requestContext,
				request.body ?? {},
			)

			response.status(200).json({})
		} catch (error: unknown) {
			this.handleRouteError(error, 500, response)
		} finally {
			this.stopCalc()
		}
	}
}
