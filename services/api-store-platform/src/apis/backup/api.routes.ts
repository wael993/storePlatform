import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import { logIncomingRequests } from '../../shared/middleware'
import { HttpError, RequestContext } from '../../shared/types'
import { buildRequestContext } from '../../shared/buildRequestContext'
import { ERROR_CODES } from '../../shared/errorCodes'
import BackupController from './api.controller'

type BackupHttpRequest = express.Request & {
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
	typeof error === 'object' &&
	error !== null &&
	'message' in error &&
	'httpStatus' in error &&
	'errorCode' in error

export default class BackupRoutes {
	private readonly baseRoute = '/api/data/backup'

	public constructor(
		private backupController: BackupController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: BackupHttpRequest,
		response: express.Response,
		next: express.NextFunction,
	): Promise<void> {
		try {
			await new ActivityAuthorization(
				this.productController,
			).authorizationValidator(request, response, next)
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
			isHandleableError(error) && error.httpStatus
				? error.httpStatus
				: defaultHttpStatus,
			response,
		)
	}

	/** Authorized JSON endpoint: run `action` with the request context, reply with `status`. */
	private endpoint(
		status: number,
		action: (
			request: BackupHttpRequest,
			context: RequestContext,
		) => unknown | Promise<unknown>,
	): express.RequestHandler[] {
		return [
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
			async (request: BackupHttpRequest, response: express.Response) => {
				try {
					response
						.status(status)
						.json(await action(request, buildRequestContext(request)))
				} catch (error: unknown) {
					this.handleRouteError(error, 500, response)
				}
			},
		]
	}

	public setRoutes(app: express.Application): void {
		const controller = this.backupController
		const base = this.baseRoute

		app
			.route(base)
			.get(...this.endpoint(200, (_, ctx) => controller.getSettings(ctx)))
			.patch(
				...this.endpoint(200, (req, ctx) =>
					controller.updateSettings(req.body ?? {}, ctx),
				),
			)

		app
			.route(`${base}/history`)
			.get(...this.endpoint(200, (_, ctx) => controller.listBackups(ctx)))

		app
			.route(`${base}/run`)
			.post(...this.endpoint(202, (_, ctx) => controller.runBackup(ctx)))

		app
			.route(`${base}/connections/:provider`)
			.post(
				...this.endpoint(200, (req, ctx) =>
					controller.startConnect(req.params.provider, ctx),
				),
			)
			.delete(
				...this.endpoint(200, (req, ctx) =>
					controller.disconnect(req.params.provider, ctx),
				),
			)

		// browser redirect from the provider: no bearer token, tenant comes from the signed state
		app
			.route(`${base}/oauth/callback`)
			.get(async (request: express.Request, response: express.Response) => {
				response.redirect(
					await controller.completeConnect(
						request.query as Record<string, unknown>,
					),
				)
			})

		app
			.route(`${base}/:backupId/restore`)
			.post(
				...this.endpoint(202, (req, ctx) =>
					controller.restore(req.params.backupId, ctx),
				),
			)
	}
}
