import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { config } from '../config/config'
import express, { NextFunction, request } from 'express'

import {
	BusinessLogicError,
	AuthorizationError,
	AuthenticationError,
} from '../middleware/errorHandler'
import { Product } from '../models/Products'
import User from '../models/User'
import RefreshToken from '../models/RefreshToken'
import { COLLECTION_NAMES } from '../shared/constants.ts/general'
import { ERROR_CODES } from '../shared/errorCodes'
import logger from '../shared/logger/logger'
import MongodbController from '../shared/mongodb/mongodbController'
import {
	CreateProductResponse,
	ProductDocument,
	ProductRequestBody,
	RequestContext,
} from '../shared/types'
import { ObjectId, Sort, type Filter } from 'mongodb'
import { LoginData, LoginRequestBody } from '../shared/types/api'
import { v4 as uuidv4 } from 'uuid'
import ProductsMapper from './mappings/ProductsMapper'
import { validateEmail, validatePasswordStrength } from '../utils/authValidation'

interface UserAPIFormat {
	_id: string
	displayName: string
	businessPartnerId?: string
	isInternal?: boolean
	avatarColorId?: number
}

interface APIResponse<T> {
	totalCount: number
	data: T[]
}
interface ProductResponse extends APIResponse<Comment> { }

export default class ProductController {
	constructor(
		private productsMapper: ProductsMapper,
		private mongoDbClient: MongodbController,
	) { }

	public async getProducts(requestContext: RequestContext) {
		const filter: Filter<ProductDocument> = {}

		try {
			const data = await Product.find().sort({ name: 1 }).lean()

			return data
		} catch (error) {
			logger.error('Error fetching products:', error)
			throw error
		}
	}
	private hashToken(token: string): string {
		return crypto.createHash('sha256').update(token).digest('hex')
	}

	private getClientInfo(req: express.Request): { ip: string; userAgent: string } {
		const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
			|| req.socket.remoteAddress
			|| 'unknown'
		const userAgent = req.headers['user-agent'] || 'unknown'
		return { ip, userAgent }
	}

	private generateAccessToken(user: { _id: any; role: string; tokenVersion: number }): string {
		return jwt.sign(
			{ userId: user._id, role: user.role, tokenVersion: user.tokenVersion },
			config.jwtSecure as string,
			{ expiresIn: '15m' },
		)
	}

	private async createAndStoreRefreshToken(
		userId: string,
		ip: string,
		userAgent: string,
	): Promise<string> {
		const rawToken = crypto.randomBytes(64).toString('hex')
		const tokenHash = this.hashToken(rawToken)
		const expiresAt = new Date(Date.now() + config.refreshTokenTTLDays * 24 * 60 * 60 * 1000)

		await RefreshToken.create({ userId, tokenHash, ip, userAgent, expiresAt })

		return rawToken
	}

	public async validateUser(request: any, token: string) {
		const decoded = jwt.verify(token, config.jwtSecure) as jwt.JwtPayload

		const user = await User.findById(decoded.userId).lean()
		if (!user) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
				'User not found',
			)
		}

		if (decoded.tokenVersion !== user.tokenVersion) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.TOKEN_EXPIRED,
				'Token has been revoked. Please log in again.',
			)
		}

		request.user = decoded
		return decoded
	}

	public async login(requestBody: LoginData, req: express.Request) {
		const { email: loginEmail, password: loginPassword } = requestBody
		const { ip, userAgent } = this.getClientInfo(req)

		// --- Input validation ---
		if (!loginEmail || !loginPassword) {
			logger.warn('Login attempt with missing fields', { ip })
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
				'Email and password are required.',
			)
		}

		const emailError = validateEmail(loginEmail)
		if (emailError) {
			logger.warn('Login attempt with invalid email format', { ip, email: loginEmail })
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.INVALID_EMAIL_FORMAT,
				emailError,
			)
		}

		const passwordError = validatePasswordStrength(loginPassword)
		if (passwordError) {
			logger.warn('Login attempt with weak password', { ip })
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.WEAK_PASSWORD,
				passwordError,
			)
		}

		// --- Authentication ---
		const user = await User.findOne({ email: loginEmail }).lean()

		if (!user) {
			logger.warn('Failed login: user not found', { ip, email: loginEmail })
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
				'Invalid email or password.',
			)
		}

		const isValid = await bcrypt.compare(loginPassword, user.password)

		if (!isValid) {
			logger.warn('Failed login: wrong password', { ip, userId: user._id })
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
				'Invalid email or password.',
			)
		}

		if (!config.jwtSecure || !config.refreshSecret) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.NO_BEARER_TOKEN,
				'Server configuration error.',
			)
		}

		// --- Token generation ---
		const accessToken = this.generateAccessToken(user)
		const refreshToken = await this.createAndStoreRefreshToken(
			user._id.toString(),
			ip,
			userAgent,
		)

		logger.info('Successful login', {
			userId: user._id,
			ip,
			userAgent,
		})

		return {
			accessToken,
			refreshToken,
			userId: user._id,
			email: user.email,
			role: user.role,
			firstName: user.user.firstName,
			lastName: user.user.lastName,
			isInternal: user.user.isInternal,
		}
	}

	public async refresh(req: express.Request) {
		const rawToken = req.cookies?.refreshToken
		const { ip, userAgent } = this.getClientInfo(req)

		if (!rawToken) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_REFRESH_TOKEN,
				'No refresh token provided.',
			)
		}

		const tokenHash = this.hashToken(rawToken)

		// Find and delete the used token atomically (rotation)
		const storedToken = await RefreshToken.findOneAndDelete({ tokenHash })
		console.log("🚀 ~ ProductController ~ refresh ~ storedToken:", storedToken)

		if (!storedToken) {
			// Token reuse detected — possible theft. Revoke all tokens for this user.
			logger.warn('Refresh token reuse detected — revoking all sessions', { ip })
			// We can't identify the user from an invalid token, so just reject.
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_REFRESH_TOKEN,
				'Invalid refresh token. Please log in again.',
			)
		}

		if (storedToken.expiresAt < new Date()) {
			logger.warn('Expired refresh token used', { userId: storedToken.userId, ip })
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.TOKEN_EXPIRED,
				'Refresh token has expired. Please log in again.',
			)
		}

		const user = await User.findById(storedToken.userId).lean()

		if (!user) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_CREDENTIALS,
				'User not found.',
			)
		}

		// Log IP change
		if (storedToken.ip !== ip) {
			logger.warn('IP address changed during refresh', {
				userId: user._id,
				previousIp: storedToken.ip,
				newIp: ip,
			})
		}

		// Issue new token pair
		const accessToken = this.generateAccessToken(user)
		const newRefreshToken = await this.createAndStoreRefreshToken(
			user._id.toString(),
			ip,
			userAgent,
		)

		logger.info('Token refreshed', { userId: user._id, ip })

		return { accessToken, refreshToken: newRefreshToken }
	}

	public async logout(req: express.Request) {
		const rawToken = req.cookies?.refreshToken
		if (!rawToken) return

		const tokenHash = this.hashToken(rawToken)
		const deleted = await RefreshToken.findOneAndDelete({ tokenHash })

		if (deleted) {
			logger.info('User logged out (current device)', { userId: deleted.userId })
		}
	}

	public async logoutAll(req: express.Request) {
		const rawToken = req.cookies?.refreshToken
		if (!rawToken) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_REFRESH_TOKEN,
				'No refresh token provided.',
			)
		}

		const tokenHash = this.hashToken(rawToken)
		const storedToken = await RefreshToken.findOne({ tokenHash })

		if (!storedToken) {
			throw new AuthenticationError(
				ERROR_CODES.AUTHORIZATION.INVALID_REFRESH_TOKEN,
				'Invalid refresh token.',
			)
		}

		const result = await RefreshToken.deleteMany({ userId: storedToken.userId })

		logger.info('User logged out from all devices', {
			userId: storedToken.userId,
			sessionsRevoked: result.deletedCount,
		})

		return { sessionsRevoked: result.deletedCount }
	}

	public async getProduct(
		productId: string,
		requestContext: RequestContext,
	): Promise<ProductRequestBody | null> {
		try {
			const product = await Product.findOne({ barcode: productId }).lean()
			if (!product) {
				logger.warn(`Product not found: ${productId}`)
				return null
			}
			const mappedProduct: ProductRequestBody = this.productsMapper.mapProduct(
				product,
				requestContext,
			)

			return mappedProduct
		} catch (error) {
			logger.error(`Error fetching product ${productId}:`, error)
			throw error
		}
	}

	public async postProduct(
		requestBody: ProductRequestBody,
		requestContext: RequestContext,
	): Promise<CreateProductResponse | null> {
		const productId = uuidv4()

		const { barcode, count, id, name, price, description } = requestBody
		const product = await Product.findOne({ name }).lean()
		if (product && name === product.name)
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Product already existed',
			)
		console.log(
			'🚀 ~ ProductController ~ postProduct ~ requestContext:',
			requestContext,
		)
		const createdBy = {
			_id: requestContext.userId as string,
			displayName: `${requestContext.user?.firstName} ${requestContext.user?.lastName}`,
			isInternal: requestContext.user?.isInternal,
		}
		console.log('🚀 ~ ProductController ~ postProduct ~ createdBy:', createdBy)
		const createdAt = new Date()
		const productData: ProductDocument = {
			productId: productId,
			id,
			name,
			barcode,
			price,
			count,
			createdBy,
			createdAt,
			description,
		}
		const createProductResponse = await Product.create(productData)

		if (!createProductResponse) {
			logger.warn(`Product not created: ${productId}`)
			return null
		}

		logger.info(`Product crested: ${productId}`)
		return { _id: createProductResponse.id }
	}

	public async getUser(userId: string) {
		try {
			const user = await Product.findOne({ id: userId }).lean()
			if (!user) {
				logger.warn(`User not found: ${userId}`)
				return null
			}
			return user
		} catch (error) {
			logger.error(`Error fetching user ${userId}:`, error)
			throw error
		}
	}

	public async patchProduct(
		productId: string,
		requestBody: Partial<Omit<ProductDocument, '_id'>>,
		requestContext: RequestContext,
	) {
		try {
			const productToUpdate = this.getProduct(productId, requestContext)

			if (!productToUpdate) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
					'Product not found',
				)
			}
			const fieldsToUpdate = Object.keys(requestBody)

			// Prevent _id/id updates
			const { id, ...allowedUpdates } = requestBody

			if (Object.keys(allowedUpdates).length === 0) {
				throw new Error('No valid fields to update')
			}

			const updatedProduct = await Product.findOneAndUpdate(
				{ id: productId },
				{ $set: allowedUpdates },
				{ new: true, runValidators: true },
			).lean()

			if (!updatedProduct) {
				logger.warn(`Product not found for update: ${productId}`)
				return null
			}

			logger.info(`Product updated: ${productId}`, { changes: allowedUpdates })
			return updatedProduct
		} catch (error) {
			logger.error(`Error updating product ${productId}:`, error)
			throw error
		}
	}
}
