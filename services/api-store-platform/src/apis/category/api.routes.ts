import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import {
	CategoryRequestBody,
	HttpError,
	RequestContext,
} from '../../shared/types'
import { buildRequestContext } from '../../shared/buildRequestContext'
import { ERROR_CODES } from '../../shared/errorCodes'
import CategoryController from './api.controller'

type CategoryHttpRequest = express.Request & {
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

export default class CategoryRoutes {
	private readonly baseRoute = '/api/data'

	public constructor(
		private categoryController: CategoryController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: CategoryHttpRequest,
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

	private getRequestContext(request: CategoryHttpRequest): RequestContext {
		return buildRequestContext(request)
	}

	public setRoutes(app: express.Application): void {
		const baseRoute = this.baseRoute

		app
			.route(`${baseRoute}/categories`)
			.get(
				this.authorizationValidator.bind(this),
				this.getCategories.bind(this),
			)
			.post(
				this.authorizationValidator.bind(this),
				this.postCategory.bind(this),
			)

		app
			.route(`${baseRoute}/categories/bulk-delete`)
			.post(
				this.authorizationValidator.bind(this),
				this.bulkDeleteCategories.bind(this),
			)

		app
			.route(`${baseRoute}/categories/:id`)
			.get(this.authorizationValidator.bind(this), this.getCategory.bind(this))
			.delete(
				this.authorizationValidator.bind(this),
				this.deleteCategory.bind(this),
			)
	}

	private async getCategories(
		request: CategoryHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.categoryController.getCategories(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async postCategory(
		request: CategoryHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestBody: CategoryRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.categoryController.postCategory(
				requestBody,
				requestContext,
			)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async getCategory(
		request: CategoryHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.categoryController.getCategory(
				request.params.id,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async deleteCategory(
		request: CategoryHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.categoryController.deleteCategory(
				request.params.id,
				requestContext,
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async bulkDeleteCategories(
		request: CategoryHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const categoryIds = Array.isArray(request.body?.categoryIds)
			? request.body.categoryIds.filter(
					(id: unknown): id is string => typeof id === 'string',
				)
			: []

		try {
			const resp = await this.categoryController.bulkDeleteCategories(
				categoryIds,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}
}
