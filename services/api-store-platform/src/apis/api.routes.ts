import express from 'express'
import ProductController from './api.controller'
import { PlatformValidator } from './api.validator'
import logger from '../shared/logger/logger'
import { logIncomingRequests } from '../shared/middleware'
import ActivityAuthorization from './api.authorize'
import { handleError } from '../middleware/errorHandler'
import {
	AddTenantRequestBody,
	InviteTenantUserRequestBody,
	InventoryRequestBody,
	InvoiceRequestBody,
	BuyingInvoiceRequestBody,
	OrderRequestBody,
	ProductRequestBody,
	ReportRequestBody,
	RequestContext,
	UpdateTenantRequestBody,
	UpdateTenantUserRequestBody,
	CurrencyRequestBody,
	ExpenseRequestBody,
	UnitRequestBody,
	PartnerRequestBody,
	BrandRequestBody,
	ShelfRequestBody,
	WarehouseRequestBody,
} from '../shared/types'
import { DailyActionRequestBody, LoginData } from '../shared/types/api'
import { config } from '../config/config'
import { format } from 'date-fns'
import { TargetType } from '../shared/globalEnums'
// import { loginRateLimiter, refreshRateLimiter } from '../middleware/rateLimiter'

type ProductFilterQuery = {
	searchText?: string
	supplier?: string[]
	brand?: string[]
	state?: string[]
	category?: string[]
}

type DailyActionFilterQuery = {
	searchText?: string
	entryType?: string[]
	productName?: string[]
	supplier?: string[]
	customer?: string[]
	invoiceDateFrom?: string
	invoiceDateTo?: string
}

type ProductPaginationQuery = {
	limit?: number
	offset?: number
}

const parseArrayQueryParam = (value: unknown): string[] | undefined => {
	if (typeof value !== 'string') {
		return undefined
	}

	const values = value
		.split(',')
		.map(item => item.trim())
		.filter(Boolean)

	return values.length > 0 ? values : undefined
}

const parseNumberQueryParam = (value: unknown): number | undefined => {
	if (typeof value !== 'string') {
		return undefined
	}

	const num = parseInt(value, 10)

	return isNaN(num) ? undefined : num
}

const parseStringQueryParam = (value: unknown): string | undefined => {
	if (typeof value !== 'string') {
		return undefined
	}

	return value.trim() || undefined
}

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
			.route(`${baseRoute}/products/catalog`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getProductCatalog.bind(this),
			)

		app
			.route(`${baseRoute}/filter-values`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getFilterValues.bind(this),
			)

		app
			.route(`${baseRoute}/product`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postProduct.bind(this),
			)

		app
			.route(`${baseRoute}/products/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				//  this.validateGetProducts.bind(this),
				this.getProduct.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchProduct.bind(this),
			)
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
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchOrder.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteOrder.bind(this),
			)

		app
			.route(`${baseRoute}/selling-invoices`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getInvoices.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postInvoice.bind(this),
			)

		app
			.route(`${baseRoute}/selling-invoices/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getInvoice.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchInvoice.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteInvoice.bind(this),
			)

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

		app
			.route(`${baseRoute}/inventory`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getInventory.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postInventory.bind(this),
			)

		app
			.route(`${baseRoute}/inventory/by-product/:productId`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchInventoryByProduct.bind(this),
			)

		app
			.route(`${baseRoute}/inventory/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getInventoryItem.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchInventory.bind(this),
			)
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
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchReport.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteReport.bind(this),
			)

		app
			.route(`${baseRoute}/daily-actions`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getDailyActions.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.validatePostDailyAction.bind(this),
				this.postDailyAction.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.validateDeleteDailyAction.bind(this),
				this.deleteDailyAction.bind(this),
			)

		app
			.route(`${baseRoute}/daily-actions/filter-values`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getDailyActionFilterValues.bind(this),
			)

		app
			.route(`${baseRoute}/daily-actions/excel`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getDailyActionsExcel.bind(this),
			)

		app
			.route(`${baseRoute}/daily-actions/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getDailyAction.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchDailyAction.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.validateDeleteDailyAction.bind(this),
				this.deleteDailyAction.bind(this),
			)

		app
			.route(`${baseRoute}/user/:id/frontend-resources`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getUserFrontendResources.bind(this),
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
			.route(`${baseRoute}/users/me/password`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.changePassword.bind(this),
			)

		app
			.route(`${baseRoute}/users/:id`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchTenantUser.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteTenantUser.bind(this),
			)

		app
			.route(`${baseRoute}/tenants`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getTenants.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.addTenant.bind(this),
			)

		app
			.route(`${baseRoute}/tenants/:id`)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchTenant.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteTenant.bind(this),
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
			.route(`${baseRoute}/sync/bootstrap`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getSyncBootstrap.bind(this),
			)

		app
			.route(`${baseRoute}/sync/changes`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getSyncChanges.bind(this),
			)

		app
			.route(`${baseRoute}/sync/push`)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.pushSyncChanges.bind(this),
			)

		app.get('/test', (req, res) => {
			res.send('OK')
		})

		app
			.route(`${baseRoute}/partners`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getPartners.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postPartner.bind(this),
			)

		app
			.route(`${baseRoute}/partners/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getPartner.bind(this),
			)

		app
			.route(`${baseRoute}/expenses`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getExpenses.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postExpense.bind(this),
			)

		app
			.route(`${baseRoute}/expenses/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getExpense.bind(this),
			)
			.patch(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.patchExpense.bind(this),
			)
			.delete(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.deleteExpense.bind(this),
			)

		app
			.route(`${baseRoute}/budget-overview/:entityType/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.validateBudgetOverview.bind(this),
				this.getBudgetOverview.bind(this),
			)

		app
			.route(`${baseRoute}/currencies`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getCurrencies.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postCurrency.bind(this),
			)

		app
			.route(`${baseRoute}/units`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getUnits.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postUnit.bind(this),
			)

		app
			.route(`${baseRoute}/brands`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getBrands.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postBrand.bind(this),
			)

		app
			.route(`${baseRoute}/brands/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getBrand.bind(this),
			)

		app
			.route(`${baseRoute}/shelves`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getShelves.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postShelf.bind(this),
			)

		app
			.route(`${baseRoute}/shelves/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getShelf.bind(this),
			)

		app
			.route(`${baseRoute}/warehouses`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getWarehouses.bind(this),
			)
			.post(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.postWarehouse.bind(this),
			)

		app
			.route(`${baseRoute}/warehouses/:id`)
			.get(
				this.startCalc.bind(this),
				logIncomingRequests.bind(this),
				this.authorizationValidator.bind(this),
				this.getWarehouse.bind(this),
			)
	}

	private async getDailyActionsExcel(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const dailyActionFilterQuery: DailyActionFilterQuery = {
			searchText: parseStringQueryParam(request.query.searchText),
			entryType: parseArrayQueryParam(request.query.entryType),
			productName: parseArrayQueryParam(request.query.productName),
			supplier: parseArrayQueryParam(request.query.supplier),
			customer: parseArrayQueryParam(request.query.customer),
			invoiceDateFrom: parseStringQueryParam(request.query.invoiceDateFrom),
			invoiceDateTo: parseStringQueryParam(request.query.invoiceDateTo),
		}

		try {
			const workbook = await this.productController.getDailyActionsExcel(
				requestContext,
				dailyActionFilterQuery,
			)

			const today = new Date()
			const filename = `${format(today, 'yyyy.MM.dd')}_daily_actions.xlsx`

			const workbookBuffer = await workbook.xlsx.writeBuffer({
				useStyles: true,
				useSharedStrings: true,
				filename: filename,
			})

			response.attachment(filename).send(workbookBuffer)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private setRefreshTokenCookie(
		response: express.Response,
		refreshToken: string,
	): void {
		response.cookie('refreshToken', refreshToken, {
			httpOnly: true,
			secure: config.nodeEnv === 'production',
			sameSite: config.nodeEnv === 'production' ? 'none' : 'strict',
			path: this.baseRoute,
			maxAge: config.refreshTokenTTLDays * 24 * 60 * 60 * 1000,
		})
	}

	private clearRefreshTokenCookie(response: express.Response): void {
		response.clearCookie('refreshToken', {
			httpOnly: true,
			secure: config.nodeEnv === 'production',
			sameSite: config.nodeEnv === 'production' ? 'none' : 'strict',
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

	private async getTenants(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getTenants(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, error.httpStatus || 403, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchTenant(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: UpdateTenantRequestBody = request.body
		const tenantId = request.params.id
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.patchTenant(
				tenantId,
				requestBody,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, error.httpStatus || 400, response)
		} finally {
			this.stopCalc()
		}
	}

	private async deleteTenant(
		request: any,
		response: express.Response,
	): Promise<void> {
		const tenantId = request.params.id
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.deleteTenant(tenantId, requestContext)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, error.httpStatus || 400, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getProducts(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const productFilterQuery: ProductFilterQuery = {
			searchText:
				typeof request.query.searchText === 'string'
					? request.query.searchText.trim() || undefined
					: undefined,
			supplier: parseArrayQueryParam(request.query.supplier),
			brand: parseArrayQueryParam(request.query.brand),
			state: parseArrayQueryParam(request.query.state),
			category: parseArrayQueryParam(request.query.category),
		}

		const paginationQuery: ProductPaginationQuery = {
			limit: parseNumberQueryParam(request.query.limit) || 20,
			offset: parseNumberQueryParam(request.query.offset) || 0,
		}

		try {
			const resp = await this.productController.getProducts(
				requestContext,
				productFilterQuery,
				paginationQuery,
			)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getProductCatalog(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.productController.getProductCatalog(requestContext)

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

	private async getFilterValues(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.productController.getProductFilterValues(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getPartners(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getPartners(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postPartner(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const requestBody: PartnerRequestBody = request.body

		try {
			const resp = await this.productController.postPartner(
				requestContext,
				requestBody,
			)

			response.status(201).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}
	private async getPartner(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getPartner(
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

	private async getExpenses(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getExpenses(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postExpense(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const requestBody: ExpenseRequestBody = request.body

		try {
			const resp = await this.productController.postExpense(
				requestContext,
				requestBody,
			)

			response.status(201).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getExpense(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getExpense(
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

	private async patchExpense(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.patchExpense(
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

	private async deleteExpense(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.deleteExpense(
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

	private async getBudgetOverview(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const targetType = request.params.entityType
		const targetId = request.params.id

		try {
			const resp = await this.productController.getBudgetOverview(
				targetType as TargetType,
				targetId,
				requestContext,
			)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getCurrencies(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getCurrencies(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postCurrency(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const requestBody: CurrencyRequestBody = request.body

		try {
			const resp = await this.productController.postCurrency(
				requestContext,
				requestBody,
			)

			response.status(201).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getUnits(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getUnits(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postUnit(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const requestBody: UnitRequestBody = request.body

		try {
			const resp = await this.productController.postUnit(
				requestContext,
				requestBody,
			)

			response.status(201).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async postBrand(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: BrandRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.postBrand(
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

	private async getBrands(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getBrands(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getBrand(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getBrand(
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

	private async postShelf(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: ShelfRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.postShelf(
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

	private async postWarehouse(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: WarehouseRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.postWarehouse(
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

	private async getShelves(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getShelves(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getShelf(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getShelf(
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

	private async getWarehouses(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getWarehouses(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getWarehouse(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getWarehouse(
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
				request.params._id,
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
			const resp = await this.productController.getInvoices(requestContext, {
				searchText: request.query.searchText,
				status: request.query.status,
				issuedDate: request.query.issuedDate,
				dateFrom: request.query.dateFrom,
				dateTo: request.query.dateTo,
				customerId: request.query.customerId,
			})

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

	private async getBuyingInvoices(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getBuyingInvoices(
				requestContext,
				{
					searchText: request.query.searchText,
					status: request.query.status,
					issuedDate: request.query.issuedDate,
					supplierId: request.query.supplierId,
				},
			)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getBuyingInvoice(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getBuyingInvoice(
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

	private async postBuyingInvoice(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: BuyingInvoiceRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.postBuyingInvoice(
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

	private async patchBuyingInvoice(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.patchBuyingInvoice(
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

	private async deleteBuyingInvoice(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.deleteBuyingInvoice(
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

	private async patchInventoryByProduct(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.patchInventoryByProductId(
				request.params.productId,
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

	private async getDailyActions(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const dailyActionFilterQuery: DailyActionFilterQuery = {
			searchText:
				typeof request.query.searchText === 'string'
					? request.query.searchText.trim() || undefined
					: undefined,
			entryType: parseArrayQueryParam(request.query.entryType),
			productName: parseArrayQueryParam(request.query.productName),
			supplier: parseArrayQueryParam(request.query.supplier),
			customer: parseArrayQueryParam(request.query.customer),
			invoiceDateFrom: parseStringQueryParam(request.query.invoiceDateFrom),
			invoiceDateTo: parseStringQueryParam(request.query.invoiceDateTo),
		}

		try {
			const resp = await this.productController.getDailyActions(
				requestContext,
				dailyActionFilterQuery,
			)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getDailyActionFilterValues(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp =
				await this.productController.getDailyActionFilterValues(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getDailyAction(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getDailyAction(
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

	private async postDailyAction(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: DailyActionRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.postDailyAction(
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

	private async patchDailyAction(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.patchDailyAction(
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

	private async deleteDailyAction(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const actionIds = Array.isArray(request.body?.actionIds)
			? request.body.actionIds
			: [request.params.id]

		try {
			await this.productController.deleteDailyAction(actionIds, requestContext)
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

	private async getUserFrontendResources(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getUserFrontendResources(
				request.params.id,
				requestContext,
			)

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

	private async changePassword(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			await this.productController.changePassword(requestBody, requestContext)
			response.status(204).send()
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async addTenant(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestBody: AddTenantRequestBody = request.body
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.addTenant(
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

	private async getUserSettings(
		request: any,
		response: express.Response,
	): Promise<void> {
		try {
			await this.productController.getUserSettings(request, response)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchUserSettings(
		request: any,
		response: express.Response,
	): Promise<void> {
		try {
			await this.productController.patchUserSettings(request, response)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getCurrencySettings(
		request: any,
		response: express.Response,
	): Promise<void> {
		try {
			await this.productController.getCurrencySettings(request, response)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchCurrencySettings(
		request: any,
		response: express.Response,
	): Promise<void> {
		try {
			await this.productController.patchCurrencySettings(request, response)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getInvoiceSettings(
		request: any,
		response: express.Response,
	): Promise<void> {
		try {
			await this.productController.getInvoiceSettings(request, response)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async patchInvoiceSettings(
		request: any,
		response: express.Response,
	): Promise<void> {
		try {
			await this.productController.patchInvoiceSettings(request, response)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getSyncBootstrap(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.getSyncBootstrap(requestContext)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async getSyncChanges(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)
		const sinceParam = parseStringQueryParam(request.query.since)

		try {
			if (!sinceParam) {
				response
					.status(400)
					.json({ message: 'since query parameter is required' })

				return
			}

			const since = new Date(sinceParam)

			if (Number.isNaN(since.getTime())) {
				response.status(400).json({ message: 'Invalid since date' })

				return
			}

			const resp = await this.productController.getSyncChanges(
				requestContext,
				since,
			)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}

	private async pushSyncChanges(
		request: any,
		response: express.Response,
	): Promise<void> {
		const requestContext = this.getRequestContext(request)

		try {
			const resp = await this.productController.pushSyncChanges(
				requestContext,
				request.body,
			)

			response.status(200).json(resp)
		} catch (error: any) {
			handleError(error, error.httpStatus || 409, response)
		} finally {
			this.stopCalc()
		}
	}
}
