import express from 'express'
import ProductController from './api.controller'

export default class ActivityAuthorization {
	public constructor(private productController: ProductController) {}
	public async authorizationValidator(
		request: any,
		response: express.Response,
		next: express.NextFunction,
	): Promise<void> {
		const startTime = Date.now()

		try {
			// 1. Get token (example: Authorization header)
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

			next()
		} catch (error) {
			response.status(500).json({ message: 'Authorization error', error })
		} finally {
			const endTime = Date.now()
			console.log(`Authorization took ${endTime - startTime}ms`)
		}
	}
}
