import express from 'express'
import jwt from 'jsonwebtoken'
import ProductController from './api.controller'
import { AuthenticationError } from '../middleware/errorHandler'

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

			next()
		} catch (error) {
			if (error instanceof AuthenticationError) {
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
