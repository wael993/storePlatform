import express, { NextFunction } from 'express'
import { Application } from 'express'
import ProductController from './api.controller'
import { PlatformValidator } from './api.validator'
import logger from '../shared/logger/logger'
import { logIncomingRequests } from '../shared/middleware'
import ActivityAuthorization from './api.authorize'
import { handleError } from '../middleware/errorHandler'
import { ProductRequestBody, RequestContext } from '../shared/types'
import { LoginData, LoginRequestBody } from '../shared/types/api'
import { config } from '../config/config'
// import { loginRateLimiter, refreshRateLimiter } from '../middleware/rateLimiter'

export default class StoreRoutes extends PlatformValidator {
	private startTime = 0
	private readonly baseRoute = '/api/data'

	private async authorizationValidator(
		request: any,
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
		} catch (error: any) {
			handleError(error, 403, response)
		}
	}

	private startCalc(
		_request: any,
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

	private getRequestContext(request: any): RequestContext {
		const requestContext: RequestContext = {
			authorization: request.headers.authorization,
			cookie: request.headers.cookie,
			userId: request.user?.userId,
			user: request.user,
			userVendorId: request.userVendorId,
			activityId: request.activityId,
			activityVendorId: request.activityVendorId,
			allowedFields: request.allowedFields,
		}

		return requestContext
	}

	public constructor(private productController: ProductController) {
		super()
	}

	public setRoutes(app: express.Application): void {
		const baseRoute = this.baseRoute

		app.route(`${baseRoute}/products`).get(
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
			// this.validateGetProducts.bind(this),
			this.getProducts.bind(this),
		)

		app.route(`${baseRoute}/product`).post(
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
			// this.validateGetProducts.bind(this),
			this.postProduct.bind(this),
		)

		app.route(`${baseRoute}/products/:id`).get(
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
			//  this.validateGetProducts.bind(this),
			this.getProduct.bind(this),
		)
		app.route(`${baseRoute}/login`).post(
			// loginRateLimiter,
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.login.bind(this),
		)

		app.route(`${baseRoute}/refresh`).post(
			// refreshRateLimiter,
			this.startCalc.bind(this),
			this.refreshToken.bind(this),
		)

		app.route(`${baseRoute}/logout`).post(
			this.startCalc.bind(this),
			this.logout.bind(this),
		)

		app.route(`${baseRoute}/logout-all`).post(
			this.startCalc.bind(this),
			this.logoutAll.bind(this),
		)

		app.get('/test', (req, res) => {
			res.send('OK')
		})
	}

	private setRefreshTokenCookie(response: express.Response, refreshToken: string): void {
		response.cookie('refreshToken', refreshToken, {
			httpOnly: true,
			secure: config.nodeEnv === 'production',
			sameSite: 'strict',
			path: this.baseRoute,
			maxAge: config.refreshTokenTTLDays * 24 * 60 * 60 * 1000,
		})
	}

	private clearRefreshTokenCookie(response: express.Response): void {
		response.clearCookie('refreshToken', {
			httpOnly: true,
			secure: config.nodeEnv === 'production',
			sameSite: 'strict',
			path: this.baseRoute,
		})
	}

	private async login(request: any, response: express.Response): Promise<void> {
		const requestBody: LoginData = request.body

		try {
			const { refreshToken, ...responseData } = await this.productController.login(requestBody, request)

			this.setRefreshTokenCookie(response, refreshToken)

			response.status(200).json(responseData)
		} catch (error: any) {
			handleError(error, error.httpStatus || 400, response)
		} finally {
			this.stopCalc()
		}
	}

	private async refreshToken(request: any, response: express.Response): Promise<void> {
		try {
			const { refreshToken, ...responseData } = await this.productController.refresh(request)

			this.setRefreshTokenCookie(response, refreshToken)

			response.status(200).json(responseData)
		} catch (error: any) {
			this.clearRefreshTokenCookie(response)
			handleError(error, 401, response)
		} finally {
			this.stopCalc()
		}
	}

	private async logout(request: any, response: express.Response): Promise<void> {
		try {
			await this.productController.logout(request)
			this.clearRefreshTokenCookie(response)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, 500, response)
		} finally {
			this.stopCalc()
		}
	}

	private async logoutAll(request: any, response: express.Response): Promise<void> {
		try {
			const result = await this.productController.logoutAll(request)
			this.clearRefreshTokenCookie(response)
			response.status(200).json(result)
		} catch (error: any) {
			handleError(error, error.httpStatus || 401, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getProducts(
		request: any,
		response: express.Response,
	): Promise<void> {
		const user = request.user

		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getProducts(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postProduct(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: ProductRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.postProduct(
				requestBody,
				requestContext,
			)

			response.status(201).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getProduct(
		request: any,
		response: express.Response,
	): Promise<void> {
		const productId = request.params.id

		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getProduct(
				productId,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchProduct(
		request: any,
		response: express.Response,
	): Promise<void> {
		const productId = request.params.id
		const requestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.patchProduct(
				productId,
				requestBody,
				requestContext,
			)

			response.status(204).send()
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}
}
