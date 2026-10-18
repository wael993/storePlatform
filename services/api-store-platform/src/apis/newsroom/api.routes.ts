import express from 'express'

import ProductController from '../api.controller'
import ActivityAuthorization from '../api.authorize'
import { handleError } from '../../middleware/errorHandler'
import logger from '../../shared/logger/logger'
import { logIncomingRequests } from '../../shared/middleware'
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
	private startTime = 0
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

	private startCalc(
		_request: NewsroomHttpRequest,
		_: express.Response,
		next: express.NextFunction,
	) {
		this.startTime = Date.now()
		next()
	}

	private stopCalc(): void {
		logger.info(`(end-to-end): ${Date.now() - this.startTime}ms`)
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
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.listTopics.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.createTopic.bind(this),
			)

		app
			.route(`${topicsRoute}/:id`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.updateTopic.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteTopic.bind(this),
			)

		app
			.route(`${this.baseRoute}/newsroom/unread-count`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.unreadNewsroomCount.bind(this),
			)

		app
			.route(`${this.baseRoute}/newsroom/visit`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.visitNewsroom.bind(this),
			)

		app
			.route(feedRoute)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.listPublicFeed.bind(this),
			)

		app
			.route(`${feedRoute}/:id/pin`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.pinPublicFeedItem.bind(this),
			)

		app
			.route(`${feedRoute}/:id/unpin`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.unpinPublicFeedItem.bind(this),
			)

		app
			.route(`${feedRoute}/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getPublicFeedItem.bind(this),
			)

		app
			.route(notesRoute)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.listReleaseNotes.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.createReleaseNote.bind(this),
			)

		app
			.route(`${notesRoute}/:id/publish`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.publishReleaseNote.bind(this),
			)

		app
			.route(`${notesRoute}/:id/unpublish`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.unpublishReleaseNote.bind(this),
			)

		app
			.route(`${notesRoute}/:id/duplicate`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.duplicateReleaseNote.bind(this),
			)

		app
			.route(`${notesRoute}/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getReleaseNote.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.updateReleaseNote.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
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
		} finally {
			this.stopCalc()
		}
	}
}
