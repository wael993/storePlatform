import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
import {
	HttpError,
	PartnerRequestBody,
	RequestContext,
} from '../../shared/types'
import { ERROR_CODES } from '../../shared/errorCodes'
import PartnerController from './api.controller'

type PartnerHttpRequest = express.Request & {
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

export default class PartnerRoutes {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	public constructor(
		private partnerController: PartnerController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: PartnerHttpRequest,
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
		_request: PartnerHttpRequest,
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

	private getRequestContext(request: PartnerHttpRequest): RequestContext {
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
			.route(`${baseRoute}/partners`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getPartners.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postPartner.bind(this),
			)

		app
			.route(`${baseRoute}/partners/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getPartner.bind(this),
			)
	}

	private async getPartners(
		request: PartnerHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.partnerController.getPartners(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postPartner(
		request: PartnerHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const requestBody: PartnerRequestBody = request.body

		try {
			const resp = await this.partnerController.postPartner(
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

	private async getPartner(
		request: PartnerHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.partnerController.getPartner(
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
