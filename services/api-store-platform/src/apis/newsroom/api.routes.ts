import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import { HttpError, RequestContext } from '../../shared/types'
import { buildRequestContext } from '../../shared/buildRequestContext'
import { ERROR_CODES } from '../../shared/errorCodes'
import NewsroomController from './api.controller'

type NewsroomHttpRequest = express.Request & {
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

export default class NewsroomRoutes {
	private readonly baseRoute = '/api/data'

	public constructor(
		private newsroomController: NewsroomController,
		private productController: ProductController,
	) {}

	private async authorizationValidator(
		request: NewsroomHttpRequest,
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
			isHandleableError(error) && error.httpStatus
				? error.httpStatus
				: defaultHttpStatus,
			response,
		)
	}

	private getRequestContext(request: NewsroomHttpRequest): RequestContext {
		return buildRequestContext(request)
	}

	public setRoutes(app: express.Application): void {
		const topicsRoute = `${this.baseRoute}/newsroom/topics`
		const notesRoute = `${this.baseRoute}/newsroom/release-notes`
		const feedRoute = `${this.baseRoute}/newsroom/feed`

		app
			.route(topicsRoute)
			.get(this.authorizationValidator.bind(this), this.listTopics.bind(this))
			.post(this.authorizationValidator.bind(this), this.createTopic.bind(this))

		app
			.route(`${topicsRoute}/:id`)
			.patch(
				this.authorizationValidator.bind(this),
				this.updateTopic.bind(this),
			)
			.delete(
				this.authorizationValidator.bind(this),
				this.deleteTopic.bind(this),
			)

		app
			.route(`${this.baseRoute}/newsroom/unread-count`)
			.get(
				this.authorizationValidator.bind(this),
				this.unreadNewsroomCount.bind(this),
			)

		app
			.route(`${this.baseRoute}/newsroom/visit`)
			.post(
				this.authorizationValidator.bind(this),
				this.visitNewsroom.bind(this),
			)

		app
			.route(feedRoute)
			.get(
				this.authorizationValidator.bind(this),
				this.listPublicFeed.bind(this),
			)

		app
			.route(`${feedRoute}/:id/pin`)
			.post(
				this.authorizationValidator.bind(this),
				this.pinPublicFeedItem.bind(this),
			)

		app
			.route(`${feedRoute}/:id/unpin`)
			.post(
				this.authorizationValidator.bind(this),
				this.unpinPublicFeedItem.bind(this),
			)

		app
			.route(`${feedRoute}/:id`)
			.get(
				this.authorizationValidator.bind(this),
				this.getPublicFeedItem.bind(this),
			)

		app
			.route(notesRoute)
			.get(
				this.authorizationValidator.bind(this),
				this.listReleaseNotes.bind(this),
			)
			.post(
				this.authorizationValidator.bind(this),
				this.createReleaseNote.bind(this),
			)

		app
			.route(`${notesRoute}/:id/publish`)
			.post(
				this.authorizationValidator.bind(this),
				this.publishReleaseNote.bind(this),
			)

		app
			.route(`${notesRoute}/:id/unpublish`)
			.post(
				this.authorizationValidator.bind(this),
				this.unpublishReleaseNote.bind(this),
			)

		app
			.route(`${notesRoute}/:id/duplicate`)
			.post(
				this.authorizationValidator.bind(this),
				this.duplicateReleaseNote.bind(this),
			)

		app
			.route(`${notesRoute}/:id`)
			.get(
				this.authorizationValidator.bind(this),
				this.getReleaseNote.bind(this),
			)
			.patch(
				this.authorizationValidator.bind(this),
				this.updateReleaseNote.bind(this),
			)
			.delete(
				this.authorizationValidator.bind(this),
				this.deleteReleaseNote.bind(this),
			)
	}

	private async listTopics(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.listTopics(
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async createTopic(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.createTopic(
				request.body,
				this.getRequestContext(request),
			)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async updateTopic(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.updateTopic(
				request.params.id,
				request.body,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async deleteTopic(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.newsroomController.deleteTopic(
				request.params.id,
				this.getRequestContext(request),
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async listReleaseNotes(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.listReleaseNotes(
				request.query as Record<string, unknown>,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async getReleaseNote(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.getReleaseNote(
				request.params.id,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async createReleaseNote(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.createReleaseNote(
				request.body,
				this.getRequestContext(request),
			)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async updateReleaseNote(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.updateReleaseNote(
				request.params.id,
				request.body,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async publishReleaseNote(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.publishReleaseNote(
				request.params.id,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async unpublishReleaseNote(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.unpublishReleaseNote(
				request.params.id,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async duplicateReleaseNote(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.duplicateReleaseNote(
				request.params.id,
				this.getRequestContext(request),
			)

			response.status(201).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async deleteReleaseNote(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			await this.newsroomController.deleteReleaseNote(
				request.params.id,
				this.getRequestContext(request),
			)

			response.status(204).send()
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async listPublicFeed(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.listPublicFeed(
				request.query as Record<string, unknown>,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async getPublicFeedItem(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.getPublicFeedItem(
				request.params.id,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async pinPublicFeedItem(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.pinPublicFeedItem(
				request.params.id,
				true,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async unpinPublicFeedItem(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.pinPublicFeedItem(
				request.params.id,
				false,
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async visitNewsroom(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.visitNewsroom(
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}

	private async unreadNewsroomCount(
		request: NewsroomHttpRequest,
		response: express.Response,
	): Promise<void> {
		try {
			const resp = await this.newsroomController.unreadNewsroomCount(
				this.getRequestContext(request),
			)

			response.status(200).json(resp)
		} catch (error: unknown) {
			this.handleRouteError(error, 403, response)
		}
	}
}
