import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
import { HttpError, RequestContext } from '../../shared/types'
import { ERROR_CODES } from '../../shared/errorCodes'
import SettingController from './api.controller'

type SettingHttpRequest = express.Request & {
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

export default class SettingRoutes {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	public constructor(
		private settingController: SettingController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: SettingHttpRequest,
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
		_request: SettingHttpRequest,
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

	public setRoutes(app: express.Application): void {
		const baseRoute = this.baseRoute

		app
			.route(`${baseRoute}/user-settings`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getUserSettings.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchUserSettings.bind(this),
			)

		app
			.route(`${baseRoute}/currency-settings`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getCurrencySettings.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchCurrencySettings.bind(this),
			)

		app
			.route(`${baseRoute}/invoice-settings`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getInvoiceSettings.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchInvoiceSettings.bind(this),
			)

		app
			.route(`${baseRoute}/label-templates`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getLabelTemplates.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.createLabelTemplate.bind(this),
			)

		app
			.route(`${baseRoute}/label-templates/:templateId/duplicate`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.duplicateLabelTemplate.bind(this),
			)

		app
			.route(`${baseRoute}/label-templates/:templateId/default`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.setDefaultLabelTemplate.bind(this),
			)

		app
			.route(`${baseRoute}/label-templates/:templateId`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchLabelTemplate.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteLabelTemplate.bind(this),
			)
	}

	private async getUserSettings(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.getUserSettings(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchUserSettings(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.patchUserSettings(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getCurrencySettings(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.getCurrencySettings(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchCurrencySettings(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.patchCurrencySettings(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getInvoiceSettings(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.getInvoiceSettings(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchInvoiceSettings(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.patchInvoiceSettings(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getLabelTemplates(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.getLabelTemplates(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async createLabelTemplate(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.createLabelTemplate(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchLabelTemplate(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.patchLabelTemplate(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteLabelTemplate(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.deleteLabelTemplate(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async duplicateLabelTemplate(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.duplicateLabelTemplate(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async setDefaultLabelTemplate(
		request: SettingHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.settingController.setDefaultLabelTemplate(request, response)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}
}
