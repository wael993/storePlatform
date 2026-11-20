import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import {
	HttpError,
	InvoiceRequestBody,
	RequestContext,
	SellingInvoicesQueryParams,
} from '../../shared/types'
import { buildRequestContext } from '../../shared/buildRequestContext'
import { ERROR_CODES } from '../../shared/errorCodes'
import SellingInvoiceController from './api.controller'

type SellingInvoiceHttpRequest = express.Request & {
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

export default class SellingInvoiceRoutes {
	private readonly baseRoute = '/api/data'

	public constructor(
		private sellingInvoiceController: SellingInvoiceController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: SellingInvoiceHttpRequest,
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

	private getRequestContext(
		request: SellingInvoiceHttpRequest,
	): RequestContext {
		return buildRequestContext(request)
	}

	public setRoutes(app: express.Application): void {
		const baseRoute = this.baseRoute

		app
			.route(`${baseRoute}/selling-invoices`)
			.get(this.authorizationValidator.bind(this), this.getInvoices.bind(this))
			.post(this.authorizationValidator.bind(this), this.postInvoice.bind(this))

		app
			.route(`${baseRoute}/selling-invoices/:id`)
			.get(this.authorizationValidator.bind(this), this.getInvoice.bind(this))
			.patch(
				this.authorizationValidator.bind(this),
				this.patchInvoice.bind(this),
			)
			.delete(
				this.authorizationValidator.bind(this),
				this.deleteInvoice.bind(this),
			)
	}

	private async getInvoices(
		request: SellingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const filters: SellingInvoicesQueryParams = {
			searchText: queryString(request.query.searchText),
			status: queryString(request.query.status),
			issuedDate: queryString(request.query.issuedDate),
			dateFrom: queryString(request.query.dateFrom),
			dateTo: queryString(request.query.dateTo),
			customerId: queryString(request.query.customerId),
			supplierId: queryString(request.query.supplierId),
			summaryOnly: queryString(request.query.summaryOnly) === 'true',
		}

		try {
			const resp = await this.sellingInvoiceController.getInvoices(
				requestContext,
				filters,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async getInvoice(
		request: SellingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.sellingInvoiceController.getInvoice(
				request.params.id,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async postInvoice(
		request: SellingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestBody: InvoiceRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.sellingInvoiceController.postInvoice(
				requestBody,
				requestContext,
			)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async patchInvoice(
		request: SellingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.sellingInvoiceController.patchInvoice(
				request.params.id,
				request.body,
				requestContext,
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async deleteInvoice(
		request: SellingInvoiceHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.sellingInvoiceController.deleteInvoice(
				request.params.id,
				requestContext,
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}
}
