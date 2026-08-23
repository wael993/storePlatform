import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
import {
	HttpError,
	ReportRequestBody,
	RequestContext,
} from '../../shared/types'
import { ERROR_CODES } from '../../shared/errorCodes'
import ReportController from './api.controller'

type ReportHttpRequest = express.Request & {
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

export default class ReportRoutes {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	public constructor(
		private reportController: ReportController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: ReportHttpRequest,
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
		_request: ReportHttpRequest,
		_: express.Response,
		next: express.NextFunction,
	) {
		this.startTime = Date.now()
		next()
	}

	private stopCalc(): void {
		logger.info(`(end-to-end): ${Date.now() - this.startTime}ms`)
	}

	private getRequestContext(request: ReportHttpRequest): RequestContext {
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
			.route(`${baseRoute}/reports/chat`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postReportChat.bind(this),
			)

		app
			.route(`${baseRoute}/reports`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getReports.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postReport.bind(this),
			)

		app
			.route(`${baseRoute}/reports/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getReport.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchReport.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteReport.bind(this),
			)
	}

	private async getReports(
		request: ReportHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.reportController.getReports(
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getReport(
		request: ReportHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.reportController.getReport(
				request.params.id,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postReport(
		request: ReportHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.reportController.postReport(
				request.body as ReportRequestBody,
				this.getRequestContext(request),
			)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchReport(
		request: ReportHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.reportController.patchReport(
				request.params.id,
				request.body,
				this.getRequestContext(request),
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteReport(
		request: ReportHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.reportController.deleteReport(
				request.params.id,
				this.getRequestContext(request),
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postReportChat(
		request: ReportHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.reportController.postReportChat(
				request.body,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}
}
