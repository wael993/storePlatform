import express, { NextFunction } from 'express'
import { Application } from 'express'
import ProductController from './api.controller'
import { PlatformValidator } from './api.validator'
import logger from '../shared/logger/logger'
import { logIncomingRequests } from '../shared/middleware'
import ActivityAuthorization from './api.authorize'
import { handleError } from '../middleware/errorHandler'
import {
	InviteTenantUserRequestBody,
	InventoryRequestBody,
	InvoiceRequestBody,
	OrderRequestBody,
	ProductRequestBody,
	ReportRequestBody,
	RequestContext,
	UpdateTenantUserRequestBody,
} from '../shared/types'
import { LoginData } from '../shared/types/api'
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
			tenantId: request.user?.tenantId,
			tenantName: request.user?.tenantName,
			role: request.user?.role,
			user: request.user,
			userVendorId: request.userVendorId,
			activityId: request.activityId,
			activityVendorId: request.activityVendorId,
			allowedFields: request.allowedFields || [],
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

		app
			.route(`${baseRoute}/product`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postProduct.bind(this),
			)

		app.route(`${baseRoute}/products/:id`).get(
			this.startCalc.bind(this),
			logIncomingRequests.bind(this),
			this.authorizationValidator.bind(this),
			//  this.validateGetProducts.bind(this),
			this.getProduct.bind(this),
		)

		app
			.route(`${baseRoute}/products/:id`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchProduct.bind(this),
			)

		app
			.route(`${baseRoute}/products/:id`)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteProduct.bind(this),
			)

		app
			.route(`${baseRoute}/orders`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getOrders.bind(this),
			)

		app
			.route(`${baseRoute}/orders`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postOrder.bind(this),
			)

		app
			.route(`${baseRoute}/orders/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getOrder.bind(this),
			)

		app
			.route(`${baseRoute}/orders/:id`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchOrder.bind(this),
			)

		app
			.route(`${baseRoute}/orders/:id`)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteOrder.bind(this),
			)

		app
			.route(`${baseRoute}/invoices`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getInvoices.bind(this),
			)

		app
			.route(`${baseRoute}/invoices`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postInvoice.bind(this),
			)

		app
			.route(`${baseRoute}/invoices/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getInvoice.bind(this),
			)

		app
			.route(`${baseRoute}/invoices/:id`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchInvoice.bind(this),
			)

		app
			.route(`${baseRoute}/invoices/:id`)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteInvoice.bind(this),
			)

		app
			.route(`${baseRoute}/inventory`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getInventory.bind(this),
			)

		app
			.route(`${baseRoute}/inventory`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postInventory.bind(this),
			)

		app
			.route(`${baseRoute}/inventory/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getInventoryItem.bind(this),
			)

		app
			.route(`${baseRoute}/inventory/:id`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchInventory.bind(this),
			)

		app
			.route(`${baseRoute}/inventory/:id`)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteInventory.bind(this),
			)

		app
			.route(`${baseRoute}/reports`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getReports.bind(this),
			)

		app
			.route(`${baseRoute}/reports`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postReport.bind(this),
			)

		app
			.route(`${baseRoute}/reports/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getReport.bind(this),
			)

		app
			.route(`${baseRoute}/reports/:id`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchReport.bind(this),
			)

		app
			.route(`${baseRoute}/reports/:id`)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteReport.bind(this),
			)

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

		app
			.route(`${baseRoute}/users/:id`)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteTenantUser.bind(this),
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

		app
			.route(`${baseRoute}/logout`)
			.post(this.startCalc.bind(this), this.logout.bind(this))

		app
			.route(`${baseRoute}/logout-all`)
			.post(this.startCalc.bind(this), this.logoutAll.bind(this))

		app.get('/test', (req, res) => {
			res.send('OK')
		})
	}

	private setRefreshTokenCookie(
		response: express.Response,
		refreshToken: string,
	): void {
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
			const { refreshToken, ...responseData } =
				await this.productController.login(requestBody, request)

			this.setRefreshTokenCookie(response, refreshToken)

			response.status(200).json(responseData)
			console.log('🚀 ~ StoreRoutes ~ login ~ responseData:', responseData)
		} catch (error: any) {
			handleError(error, error.httpStatus || 400, response)
		} finally {
			this.stopCalc()
		}
	}

	private async refreshToken(
		request: any,
		response: express.Response,
	): Promise<void> {
		try {
			const { refreshToken, ...responseData } =
				await this.productController.refresh(request)

			this.setRefreshTokenCookie(response, refreshToken)

			response.status(200).json(responseData)
		} catch (error: any) {
			this.clearRefreshTokenCookie(response)
			handleError(error, 401, response)
		} finally {
			this.stopCalc()
		}
	}

	private async logout(
		request: any,
		response: express.Response,
	): Promise<void> {
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

	private async logoutAll(
		request: any,
		response: express.Response,
	): Promise<void> {
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

	private async deleteProduct(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.deleteProduct(
				request.params.id,
				requestContext,
			)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getOrders(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getOrders(requestContext)
			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getOrder(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getOrder(
				request.params.id,
				requestContext,
			)
			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postOrder(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: OrderRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.postOrder(
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

	private async patchOrder(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.patchOrder(
				request.params.id,
				request.body,
				requestContext,
			)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteOrder(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.deleteOrder(
				request.params.id,
				requestContext,
			)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getInvoices(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getInvoices(requestContext)
			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getInvoice(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getInvoice(
				request.params.id,
				requestContext,
			)
			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postInvoice(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: InvoiceRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.postInvoice(
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

	private async patchInvoice(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.patchInvoice(
				request.params.id,
				request.body,
				requestContext,
			)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteInvoice(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.deleteInvoice(
				request.params.id,
				requestContext,
			)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getInventory(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getInventory(requestContext)
			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getInventoryItem(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getInventoryItem(
				request.params.id,
				requestContext,
			)
			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postInventory(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: InventoryRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.postInventory(
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

	private async patchInventory(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.patchInventory(
				request.params.id,
				request.body,
				requestContext,
			)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteInventory(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.deleteInventory(
				request.params.id,
				requestContext,
			)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getReports(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getReports(requestContext)
			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getReport(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getReport(
				request.params.id,
				requestContext,
			)
			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postReport(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: ReportRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.postReport(
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

	private async patchReport(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.patchReport(
				request.params.id,
				request.body,
				requestContext,
			)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteReport(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.deleteReport(
				request.params.id,
				requestContext,
			)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getTenantUsers(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getTenantUsers(requestContext)
			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async inviteTenantUser(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: InviteTenantUserRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.inviteTenantUser(
				requestBody,
				requestContext,
			)
			response.status(201).json(resp)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchTenantUser(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: UpdateTenantUserRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.patchTenantUser(
				request.params.id,
				requestBody,
				requestContext,
			)
			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteTenantUser(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.deleteTenantUser(
				request.params.id,
				requestContext,
			)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}
}
