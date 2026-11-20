import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import {
	BuyingInvoiceRequestBody,
	BuyingInvoicesQueryParams,
	HttpError,
	RequestContext,
} from '../../shared/types'
import { buildRequestContext } from '../../shared/buildRequestContext'
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
	see?: string[]
}

const isHandleableError = (error: unknown): error is HttpError =>
	typeof error === 'object' && error !== null && 'message' in error

const queryString = (value: unknown): string | undefined =>
	typeof value === 'string' ? value : undefined

export default class BuyingInvoiceRoutes {
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

	private getRequestContext(request: BuyingInvoiceHttpRequest): RequestContext {
		return buildRequestContext(request)
	}

	public setRoutes(app: express.Application): void {
		const baseRoute = this.baseRoute

		app
			.route(`${baseRoute}/buying-invoices`)
			.get(
				this.authorizationValidator.bind(this),
				this.getBuyingInvoices.bind(this),
			)
			.post(
				this.authorizationValidator.bind(this),
				this.postBuyingInvoice.bind(this),
			)

		app
			.route(`${baseRoute}/buying-invoices/extract`)
			.post(
				this.authorizationValidator.bind(this),
				this.extractBuyingInvoice.bind(this),
			)

		app
			.route(`${baseRoute}/buying-invoices/invoice-ai-usage`)
			.get(
				this.authorizationValidator.bind(this),
				this.getInvoiceAiUsage.bind(this),
			)

		app
			.route(`${baseRoute}/buying-invoices/confirm-match`)
			.post(
				this.authorizationValidator.bind(this),
				this.confirmBuyingInvoiceMatch.bind(this),
			)

		app
			.route(`${baseRoute}/buying-invoices/:id`)
			.get(
				this.authorizationValidator.bind(this),
				this.getBuyingInvoice.bind(this),
			)
			.patch(
				this.authorizationValidator.bind(this),
				this.patchBuyingInvoice.bind(this),
			)
			.delete(
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
		}
	}
}
