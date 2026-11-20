import express from 'express'
import jwt from 'jsonwebtoken'
import ProductController from './api.controller'
import {
	AuthenticationError,
	AuthorizationError,
} from '../middleware/errorHandler'
import { ERROR_CODES } from '../shared/errorCodes'
import {
	getRequiredAccessiblePages,
	isWriteBlockedWhileExpired,
	tenantHasRequiredPageAccess,
} from '../shared/constants/tenantPageAccess'
import { getSeeSet } from '../shared/seePermissions'
import {
	getAllowedWarehouseIds,
	loadTenantWarehouseIds,
} from '../shared/warehouseAccess'

export default class ActivityAuthorization {
	public constructor(private productController: ProductController) {}
	public async authorizationValidator(
		request: any,
		response: express.Response,
		next: express.NextFunction,
	): Promise<void> {
		try {
			const token = request.headers['authorization']?.split(' ')[1]

			if (!token) {
				response.status(401).json({ message: 'Missing token' })

				return
			}

			const user = await this.productController.validateUser(request, token)

			if (!user) {
				response.status(403).json({ message: 'Invalid user' })

				return
			}

			request.user = user
			request.tenantId = user.tenantId
			request.tenantName = user.tenantName
			request.role = user.role
			request.see = [...(await getSeeSet(user.tenantId, user.role))]

			if (
				request.headers['x-warehouse-scope'] !== undefined &&
				getAllowedWarehouseIds(request) === null
			) {
				request.tenantWarehouseIds = await loadTenantWarehouseIds(user.tenantId)
			}

			const requiredPages = getRequiredAccessiblePages(
				request.path,
				request.method,
			)
			const blockedWhileExpired = isWriteBlockedWhileExpired(
				request.path,
				request.method,
			)

			if (requiredPages || blockedWhileExpired) {
				const { accessiblePages, subscriptionExpired, restoreInProgress } =
					await this.productController.getTenantRequestAccess(user.tenantId)

				// every write is blocked while a backup restore replaces tenant data
				if (restoreInProgress && blockedWhileExpired) {
					response.status(423).json({
						message: 'A backup restore is running. Try again in a few minutes.',
						errorCode: ERROR_CODES.BUSINESS_LOGIC.BACKUP_RESTORE_IN_PROGRESS,
					})

					return
				}

				if (subscriptionExpired && blockedWhileExpired) {
					response.status(403).json({
						message: 'Subscription expired. Renew it to make changes.',
						errorCode: ERROR_CODES.AUTHORIZATION.FORBIDDEN,
					})

					return
				}

				if (!tenantHasRequiredPageAccess(accessiblePages, requiredPages)) {
					response.status(403).json({
						message: 'This tenant does not have access to the requested page.',
						errorCode: ERROR_CODES.AUTHORIZATION.FORBIDDEN,
					})

					return
				}

				request.accessiblePages = accessiblePages
			}

			next()
		} catch (error) {
			if (
				error instanceof AuthenticationError ||
				error instanceof AuthorizationError
			) {
				response.status(error.httpStatus).json({
					message: error.message,
					errorCode: error.errorCode,
				})

				return
			}

			if (
				error instanceof jwt.TokenExpiredError ||
				error instanceof jwt.JsonWebTokenError
			) {
				response.status(401).json({
					message: 'Authorization error',
					error: {
						name: error.name,
						message: error.message,
						...(error instanceof jwt.TokenExpiredError && {
							expiredAt: error.expiredAt,
						}),
					},
				})

				return
			}

			response.status(500).json({ message: 'Authorization error', error })
		}
	}
}
