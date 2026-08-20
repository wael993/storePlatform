import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
import {
	BuyingInvoiceRequestBody,
	BuyingInvoicesQueryParams,
	HttpError,
	RequestContext,
} from '../../shared/types'
import { ERROR_CODES } from '../../shared/errorCodes'
import BuyingInvoiceController from './api.controller'

type BuyingInvoiceHttpRequest = express.Request & {
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

const queryString = (value: unknown): string | undefined =>
	typeof value === 'string' ? value : undefined

export default class BuyingInvoiceRoutes {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	public constructor(
		private buyingInvoiceController: BuyingInvoiceController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: BuyingInvoiceHttpRequest,
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
		_request: BuyingInvoiceHttpRequest,
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

	private getRequestContext(request: BuyingInvoiceHttpRequest): RequestContext {
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
			.route(`${baseRoute}/buying-invoices`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getBuyingInvoices.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postBuyingInvoice.bind(this),
			)

		app
			.route(`${baseRoute}/buying-invoices/extract`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.extractBuyingInvoice.bind(this),
			)

		app
			.route(`${baseRoute}/buying-invoices/invoice-ai-usage`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getInvoiceAiUsage.bind(this),
			)

		app
			.route(`${baseRoute}/buying-invoices/extract-region`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.extractBuyingInvoiceRegion.bind(this),
			)

		app
			.route(`${baseRoute}/buying-invoices/confirm-match`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.confirmBuyingInvoiceMatch.bind(this),
			)

		app
			.route(`${baseRoute}/buying-invoices/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getBuyingInvoice.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchBuyingInvoice.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteBuyingInvoice.bind(this),
			)
	}

	private async getBuyingInvoices(
		request: BuyingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const filters: BuyingInvoicesQueryParams = {
			searchText: queryString(request.query.searchText),
			status: queryString(request.query.status),
			issuedDate: queryString(request.query.issuedDate),
			supplierId: queryString(request.query.supplierId),
		}

		try {
			const resp = await this.buyingInvoiceController.getBuyingInvoices(
				requestContext,
				filters,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getBuyingInvoice(
		request: BuyingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.buyingInvoiceController.getBuyingInvoice(
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

	private async postBuyingInvoice(
		request: BuyingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestBody: BuyingInvoiceRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.buyingInvoiceController.postBuyingInvoice(
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

	private async patchBuyingInvoice(
		request: BuyingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.buyingInvoiceController.patchBuyingInvoice(
				request.params.id,
				request.body,
				requestContext,
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteBuyingInvoice(
		request: BuyingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.buyingInvoiceController.deleteBuyingInvoice(
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

	private async getInvoiceAiUsage(
		request: BuyingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.buyingInvoiceController.getInvoiceAiUsage(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async extractBuyingInvoice(
		request: BuyingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.buyingInvoiceController.extractBuyingInvoice(
				request.body,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async extractBuyingInvoiceRegion(
		request: BuyingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.buyingInvoiceController.extractBuyingInvoiceRegion(
					request.body,
					requestContext,
				)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async confirmBuyingInvoiceMatch(
		request: BuyingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.buyingInvoiceController.confirmBuyingInvoiceMatch(
				request.body,
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
