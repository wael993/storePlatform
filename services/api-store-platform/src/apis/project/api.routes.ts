import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import {
	HttpError,
	ProjectRequestBody,
	RequestContext,
} from '../../shared/types'
import { buildRequestContext } from '../../shared/buildRequestContext'
import { ERROR_CODES } from '../../shared/errorCodes'
import ProjectController from './api.controller'

type ProjectHttpRequest = express.Request & {
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

export default class ProjectRoutes {
	private readonly baseRoute = '/api/data'

	public constructor(
		private projectController: ProjectController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: ProjectHttpRequest,
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

	private getRequestContext(request: ProjectHttpRequest): RequestContext {
		return buildRequestContext(request)
	}

	public setRoutes(app: express.Application): void {
		const baseRoute = this.baseRoute

		app
			.route(`${baseRoute}/projects`)
			.get(this.authorizationValidator.bind(this), this.getProjects.bind(this))
			.post(this.authorizationValidator.bind(this), this.postProject.bind(this))

		app
			.route(`${baseRoute}/projects/bulk-delete`)
			.post(
				this.authorizationValidator.bind(this),
				this.bulkDeleteProjects.bind(this),
			)

		app
			.route(`${baseRoute}/projects/:id`)
			.get(this.authorizationValidator.bind(this), this.getProject.bind(this))
			.patch(
				this.authorizationValidator.bind(this),
				this.patchProject.bind(this),
			)
			.delete(
				this.authorizationValidator.bind(this),
				this.deleteProject.bind(this),
			)
	}

	private async getProjects(
		request: ProjectHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.projectController.getProjects(requestContext)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async postProject(
		request: ProjectHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const requestBody: ProjectRequestBody = request.body

		try {
			const resp = await this.projectController.postProject(
				requestContext,
				requestBody,
			)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async getProject(
		request: ProjectHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.projectController.getProject(
				request.params.id,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async patchProject(
		request: ProjectHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.projectController.patchProject(
				request.params.id,
				request.body,
				requestContext,
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async bulkDeleteProjects(
		request: ProjectHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const projectIds = Array.isArray(request.body?.projectIds)
			? request.body.projectIds.filter(
					(id: unknown): id is string => typeof id === 'string',
				)
			: []

		try {
			const resp = await this.projectController.bulkDeleteProjects(
				projectIds,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}

	private async deleteProject(
		request: ProjectHttpRequest,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.projectController.deleteProject(
				request.params.id,
				requestContext,
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 409, response)
		}
	}
}
