import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
import {
	AddTenantRequestBody,
	HttpError,
	InviteTenantUserRequestBody,
	RequestContext,
	UpdateTenantRequestBody,
	UpdateTenantUserRequestBody,
} from '../../shared/types'
import { ERROR_CODES } from '../../shared/errorCodes'
import TenantController from './api.controller'

type TenantHttpRequest = express.Request & {
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

export default class TenantRoutes {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	public constructor(
		private tenantController: TenantController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: TenantHttpRequest,
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
		const httpStatus =
			isHandleableError(error) && error.httpStatus
				? error.httpStatus
				: defaultHttpStatus

		handleError(
			isHandleableError(error)
				? error
				: {
						httpStatus: defaultHttpStatus,
						message: 'Unknown error',
						errorCode: ERROR_CODES.GLOBAL.GLOBAL_UNKNOWN_ERROR,
					},
			httpStatus,
			response,
		)
	}

	private startCalc(
		_request: TenantHttpRequest,
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

	private getRequestContext(request: TenantHttpRequest): RequestContext {
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
			.route(`${baseRoute}/users`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getTenantUsers.bind(this),
			)

		app
			.route(`${baseRoute}/users/invite`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.inviteTenantUser.bind(this),
			)

		app
			.route(`${baseRoute}/users/:id`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchTenantUser.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteTenantUser.bind(this),
			)

		app
			.route(`${baseRoute}/role-permissions/catalog`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getRoleSeeCatalog.bind(this),
			)

		app
			.route(`${baseRoute}/role-permissions/:role`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getRoleSee.bind(this),
			)
			.put(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.putRoleSee.bind(this),
			)

		app
			.route(`${baseRoute}/subscription`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getOwnSubscription.bind(this),
			)

		app
			.route(`${baseRoute}/subscription/payment-info`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getSubscriptionPaymentInfo.bind(this),
			)

		app
			.route(`${baseRoute}/subscription/renewal-requests`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.createOwnRenewalRequest.bind(this),
			)

		app
			.route(`${baseRoute}/tenants/subscription-payment`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getSubscriptionPaymentSettings.bind(this),
			)
			.put(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.saveSubscriptionPaymentSettings.bind(this),
			)

		app
			.route(`${baseRoute}/tenants/renewal-requests`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.listRenewalRequests.bind(this),
			)

		app
			.route(`${baseRoute}/tenants/renewal-requests/:id/approve`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.approveTenantRenewalRequest.bind(this),
			)

		app
			.route(`${baseRoute}/tenants/renewal-requests/:id/reject`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.rejectTenantRenewalRequest.bind(this),
			)

		app
			.route(`${baseRoute}/tenants`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getTenants.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.addTenant.bind(this),
			)

		app
			.route(`${baseRoute}/tenants/:id`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchTenant.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteTenant.bind(this),
			)
	}

	private async getTenantUsers(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.getTenantUsers(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async inviteTenantUser(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestBody: InviteTenantUserRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.inviteTenantUser(
				requestBody,
				requestContext,
			)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchTenantUser(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestBody: UpdateTenantUserRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.patchTenantUser(
				request.params.id,
				requestBody,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteTenantUser(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.tenantController.deleteTenantUser(
				request.params.id,
				requestContext,
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getTenants(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.getTenants(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async addTenant(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestBody: AddTenantRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.addTenant(
				requestBody,
				requestContext,
			)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getOwnSubscription(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.tenantController.getOwnSubscription(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getSubscriptionPaymentInfo(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.tenantController.getSubscriptionPaymentInfo(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async createOwnRenewalRequest(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.tenantController.createOwnRenewalRequest(requestContext)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async listRenewalRequests(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.tenantController.listRenewalRequests(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async approveTenantRenewalRequest(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.approveTenantRenewalRequest(
				request.params.id,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async rejectTenantRenewalRequest(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const reason =
			typeof request.body?.reason === 'string' ? request.body.reason : ''

		try {
			const resp = await this.tenantController.rejectTenantRenewalRequest(
				request.params.id,
				reason,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getSubscriptionPaymentSettings(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.tenantController.getSubscriptionPaymentSettings(
					requestContext,
				)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async saveSubscriptionPaymentSettings(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.saveSubscriptionPaymentSettings(
				request.body,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getRoleSeeCatalog(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.getRoleSeeCatalog(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getRoleSee(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.getRoleSee(
				request.params.role,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async putRoleSee(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.putRoleSee(
				request.params.role,
				request.body?.see,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchTenant(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestBody: UpdateTenantRequestBody = request.body
		const tenantId = request.params.id
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.tenantController.patchTenant(
				tenantId,
				requestBody,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 400, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteTenant(
		request: TenantHttpRequest,
		response: express.Response,
	): Promise<void> {
		const tenantId = request.params.id
		const requestContext = this.getRequestContext(request)

		try {
			await this.tenantController.deleteTenant(tenantId, requestContext)
			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 400, response)
		} finally {
			this.stopCalc()
		}
	}
}
