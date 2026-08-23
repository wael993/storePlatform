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
	tenantHasRequiredPageAccess,
} from '../shared/constants/tenantPageAccess'
import { getSeeSet } from '../shared/seePermissions'

export default class ActivityAuthorization {
	public constructor(private productController: ProductController) {}
	public async authorizationValidator(
		request: any,
		response: express.Response,
		next: express.NextFunction,
	): Promise<void> {
		const startTime = Date.now()

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

			const requiredPages = getRequiredAccessiblePages(
				request.path,
				request.method,
			)

			if (requiredPages) {
				const accessiblePages =
					await this.productController.getTenantAccessiblePagesForRequest(
						user.tenantId,
					)

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
		} finally {
			const endTime = Date.now()

			console.log(`Authorization took ${endTime - startTime}ms`)
		}
	}
}
